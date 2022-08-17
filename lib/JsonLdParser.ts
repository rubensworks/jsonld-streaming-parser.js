import * as RDF from "@rdfjs/types";
import {ERROR_CODES, ErrorCoded, IDocumentLoader, JsonLdContext, Util as ContextUtil} from "jsonld-context-parser";
// @ts-ignore The types are not updated yet
import {PassThrough, Transform, Stream, pipeline} from "readable-stream";
import {EntryHandlerArrayValue} from "./entryhandler/EntryHandlerArrayValue";
import {EntryHandlerContainer} from "./entryhandler/EntryHandlerContainer";
import {EntryHandlerInvalidFallback} from "./entryhandler/EntryHandlerInvalidFallback";
import {EntryHandlerPredicate} from "./entryhandler/EntryHandlerPredicate";
import {IEntryHandler} from "./entryhandler/IEntryHandler";
import {EntryHandlerKeywordContext} from "./entryhandler/keyword/EntryHandlerKeywordContext";
import {EntryHandlerKeywordGraph} from "./entryhandler/keyword/EntryHandlerKeywordGraph";
import {EntryHandlerKeywordId} from "./entryhandler/keyword/EntryHandlerKeywordId";
import {EntryHandlerKeywordIncluded} from "./entryhandler/keyword/EntryHandlerKeywordIncluded";
import EventEmitter = NodeJS.EventEmitter;
import {EntryHandlerKeywordNest} from "./entryhandler/keyword/EntryHandlerKeywordNest";
import {EntryHandlerKeywordType} from "./entryhandler/keyword/EntryHandlerKeywordType";
import {EntryHandlerKeywordUnknownFallback} from "./entryhandler/keyword/EntryHandlerKeywordUnknownFallback";
import {EntryHandlerKeywordValue} from "./entryhandler/keyword/EntryHandlerKeywordValue";
import {ParsingContext} from "./ParsingContext";
import {Util} from "./Util";
import {parse as parseLinkHeader} from "http-link-header";
import {JsonEventParser} from "json-event-parser";
import {JsonEvent} from "json-event-parser/lib/JsonEventParser";


/**
 * A stream transformer that parses JSON-LD (text) streams to an {@link RDF.Stream}.
 */
export class JsonLdParser extends Transform implements RDF.Sink<EventEmitter, RDF.Stream> {

  public static readonly DEFAULT_PROCESSING_MODE: string = '1.1';
  public static readonly ENTRY_HANDLERS: IEntryHandler<any>[] = [
    new EntryHandlerArrayValue(),
    new EntryHandlerKeywordContext(),
    new EntryHandlerKeywordId(),
    new EntryHandlerKeywordIncluded(),
    new EntryHandlerKeywordGraph(),
    new EntryHandlerKeywordNest(),
    new EntryHandlerKeywordType(),
    new EntryHandlerKeywordValue(),
    new EntryHandlerContainer(),
    new EntryHandlerKeywordUnknownFallback(),
    new EntryHandlerPredicate(),
    new EntryHandlerInvalidFallback(),
  ];

  private readonly options: IJsonLdParserOptions;
  private readonly parsingContext: ParsingContext;
  private readonly util: Util;

  // Jobs that are not started yet that process a @context (only used if streamingProfile is false)
  private readonly contextJobs: (() => Promise<void>)[][];
  // Jobs that are not started yet that process a @type (only used if streamingProfile is false)
  private readonly typeJobs: { job: () => Promise<void>, keys: (string | number)[] }[];
  // Jobs that are not started yet because of a missing @context or @type (only used if streamingProfile is false)
  private readonly contextAwaitingJobs: { job: () => Promise<void>, keys: string[] }[];

  // The last depth that was processed.
  private lastDepth: number;
  // The last keys that were processed.
  private lastKeys: any[];
  // A promise representing the last job
  private lastOnValueJob: Promise<void>;
  // The keys inside of the JSON tree
  private readonly jsonKeyStack: (string | number)[];
  // The value inside of the JSON tree
  private readonly jsonValueStack: any[];

  constructor(options?: IJsonLdParserOptions) {
    super({ readableObjectMode: true, writableObjectMode: true });
    options = options || {};
    this.options = options;
    this.parsingContext = new ParsingContext({ parser: this, ...options });
    this.util = new Util({ dataFactory: options.dataFactory, parsingContext: this.parsingContext });

    this.contextJobs = [];
    this.typeJobs = [];
    this.contextAwaitingJobs = [];

    this.lastDepth = 0;
    this.lastKeys = [];
    this.lastOnValueJob = Promise.resolve();
    this.jsonKeyStack = [];
    this.jsonValueStack = [];
  }

  /**
   * Construct a JsonLdParser from the given HTTP response.
   *
   * This will throw an error if no valid JSON response is received
   * (application/ld+json, application/json, or something+json).
   *
   * For raw JSON responses, exactly one link header pointing to a JSON-LD context is required.
   *
   * This method is not responsible for handling redirects.
   *
   * @param baseIRI The URI of the received response.
   * @param mediaType The received content type.
   * @param headers Optional HTTP headers.
   * @param options Optional parser options.
   */
  public static fromHttpResponse(baseIRI: string, mediaType: string,
                                 headers?: Headers, options?: IJsonLdParserOptions): JsonLdParser {
    let context: JsonLdContext | undefined;
    // Special cases when receiving something else than the JSON-LD media type
    if (mediaType !== 'application/ld+json') {
      // Only accept JSON or JSON extension types
      if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
        throw new ErrorCoded(`Unsupported JSON-LD media type ${mediaType}`,
          ERROR_CODES.LOADING_DOCUMENT_FAILED);
      }

      // We need exactly one JSON-LD context in the link header
      if (headers && headers.has('Link')) {
        headers.forEach((value, key) => {
          if (key === 'link') {
            const linkHeader = parseLinkHeader(value);
            for (const link of linkHeader.get('rel', 'http://www.w3.org/ns/json-ld#context')) {
              if (context) {
                throw new ErrorCoded('Multiple JSON-LD context link headers were found on ' + baseIRI,
                  ERROR_CODES.MULTIPLE_CONTEXT_LINK_HEADERS);
              }
              context = link.uri;
            }
          }
        });
      }
      if (!context && !options?.ignoreMissingContextLinkHeader) {
        throw new ErrorCoded(`Missing context link header for media type ${mediaType} on ${baseIRI}`,
          ERROR_CODES.LOADING_DOCUMENT_FAILED);
      }
    }

    // Check if the streaming profile is present
    let streamingProfile: boolean | undefined;
    if (headers && headers.has('Content-Type')) {
      const contentType = <string> headers.get('Content-Type');
      const match = /; *profile=([^"]*)/.exec(contentType);
      if (match && match[1] === 'http://www.w3.org/ns/json-ld#streaming') {
        streamingProfile = true;
      }
    }

    return new JsonLdParser({
      baseIRI,
      context,
      streamingProfile,
      ... options ? options : {},
    });
  }

  /**
   * Parses the given text stream into a quad stream.
   * @param {NodeJS.EventEmitter} stream A text stream.
   * @return {RDF.Stream} A quad stream.
   */
  public import(stream: EventEmitter): RDF.Stream {
    let input: Stream = (<Stream>stream);
    if(!('pipe' in stream)) {
      input = new PassThrough({ readableObjectMode: true });
      stream.on('error', (error) => input.emit('error', error));
      stream.on('data', (data) => input.push(data));
      stream.on('end', () => input.push(null));
    }
    return pipeline(input, new JsonEventParser(), new JsonLdParser(this.options), (err: any) => {
      // We ignore the error?
    });
  }

  public _transform(event: any, _encoding: string, callback: (error?: Error | null, data?: any) => void): void {
    this.onJsonEvent(event);
    this.lastOnValueJob
      .then(() => callback(), (error) => callback(error));
  }

  /**
   * Start a new job for parsing the given value.
   *
   * This will let the first valid {@link IEntryHandler} handle the entry.
   *
   * @param {any[]} keys The stack of keys.
   * @param value The value to parse.
   * @param {number} depth The depth to parse at.
   * @param {boolean} lastDepthCheck If the lastDepth check should be done for buffer draining.
   * @return {Promise<void>} A promise resolving when the job is done.
   */
  public async newOnValueJob(keys: any[], value: any, depth: number, lastDepthCheck: boolean) {
    let flushStacks: boolean = true;

    // When we go up the stack, emit all unidentified values
    // We need to do this before the new job, because the new job may require determined values from the flushed jobs.
    if (lastDepthCheck && depth < this.lastDepth) {
      // Check if we had any RDF lists that need to be terminated with an rdf:nil
      const listPointer = this.parsingContext.listPointerStack[this.lastDepth];
      if (listPointer) {
        // Terminate the list if the had at least one value
        if (listPointer.value) {
          this.push(this.util.dataFactory.quad(listPointer.value, this.util.rdfRest, this.util.rdfNil,
            this.util.getDefaultGraph()));
        }

        // Add the list id to the id stack, so it can be used higher up in the stack
        (<any> listPointer.listId).listHead = true;
        this.parsingContext.idStack[listPointer.listRootDepth + 1] = [ listPointer.listId ];

        this.parsingContext.listPointerStack.splice(this.lastDepth, 1);
      }

      // Flush the buffer for lastDepth
      // If the parent key is a special type of container, postpone flushing until that parent is handled.
      if (await EntryHandlerContainer.isBufferableContainerHandler(this.parsingContext, this.lastKeys, this.lastDepth)) {
        this.parsingContext.pendingContainerFlushBuffers
          .push({ depth: this.lastDepth, keys: this.lastKeys.slice(0, this.lastKeys.length) });
        flushStacks = false;
      } else {
        await this.flushBuffer(this.lastDepth, this.lastKeys);
      }
    }

    const key = await this.util.unaliasKeyword(keys[depth], keys, depth);
    const parentKey = await this.util.unaliasKeywordParent(keys, depth);
    this.parsingContext.emittedStack[depth] = true;
    let handleKey = true;

    // Keywords inside @reverse is not allowed apart from @context
    if (ContextUtil.isValidKeyword(key) && parentKey === '@reverse' && key !== '@context') {
      this.emit('error', new ErrorCoded(`Found the @id '${value}' inside an @reverse property`,
          ERROR_CODES.INVALID_REVERSE_PROPERTY_MAP));
    }

    // Skip further processing if one of the parent nodes are invalid.
    // We use the validationStack to reuse validation results that were produced before with common key stacks.
    let inProperty: boolean = false;
    if (this.parsingContext.validationStack.length > 1) {
      inProperty = this.parsingContext.validationStack[this.parsingContext.validationStack.length - 1].property;
    }
    for (let i = Math.max(1, this.parsingContext.validationStack.length - 1); i < keys.length - 1; i++) {
      const validationResult = this.parsingContext.validationStack[i]
        || (this.parsingContext.validationStack[i] = await this.validateKey(keys.slice(0, i + 1), i, inProperty));
      if (!validationResult.valid) {
        this.parsingContext.emittedStack[depth] = false;
        handleKey = false;
        break;
      } else if (!inProperty && validationResult.property) {
        inProperty = true;
      }
    }

    // Skip further processing if this node is part of a literal
    if (this.util.isLiteral(depth)) {
      handleKey = false;
    }

    // Get handler
    if (handleKey) {
      for (const entryHandler of JsonLdParser.ENTRY_HANDLERS) {
        const testResult = await entryHandler.test(this.parsingContext, this.util, key, keys, depth);
        if (testResult) {
          // Pass processing over to the handler
          await entryHandler.handle(this.parsingContext, this.util, key, keys, value, depth, testResult);

          // Flag that this depth is processed
          if (entryHandler.isStackProcessor()) {
            this.parsingContext.processingStack[depth] = true;
          }

          break;
        }
      }
    }

    // Validate value indexes on the root.
    if (depth === 0 && Array.isArray(value)) {
      await this.util.validateValueIndexes(value);
    }

    // When we go up the stack, flush the old stack
    if (flushStacks && depth < this.lastDepth) {
      // Reset our stacks
      this.flushStacks(this.lastDepth);
    }
    this.lastDepth = depth;
    this.lastKeys = keys;

    // Clear the keyword cache at this depth, and everything underneath.
    this.parsingContext.unaliasedKeywordCacheStack.splice(depth - 1);
  }

  /**
   * Flush the processing stacks at the given depth.
   * @param {number} depth A depth.
   */
  public flushStacks(depth: number) {
    this.parsingContext.processingStack.splice(depth, 1);
    this.parsingContext.processingType.splice(depth, 1);
    this.parsingContext.emittedStack.splice(depth, 1);
    this.parsingContext.idStack.splice(depth, 1);
    this.parsingContext.graphStack.splice(depth + 1, 1);
    this.parsingContext.graphContainerTermStack.splice(depth, 1);
    this.parsingContext.jsonLiteralStack.splice(depth, 1);
    this.parsingContext.validationStack.splice(depth - 1, 2);
    this.parsingContext.literalStack.splice(depth, this.parsingContext.literalStack.length - depth);
    // TODO: just like the literal stack, splice all other stack until the end as well?
  }

  /**
   * Flush buffers for the given depth.
   *
   * This should be called after the last entry at a given depth was processed.
   *
   * @param {number} depth A depth.
   * @param {any[]} keys A stack of keys.
   * @return {Promise<void>} A promise resolving if flushing is done.
   */
  public async flushBuffer(depth: number, keys: any[]) {
    let subjects: RDF.Term[] = this.parsingContext.idStack[depth];
    if (!subjects) {
      subjects = this.parsingContext.idStack[depth] = [ this.util.dataFactory.blankNode() ];
    }

    // Flush values at this level
    const valueBuffer: { predicate: RDF.Term, object: RDF.Term, reverse: boolean }[] =
      this.parsingContext.unidentifiedValuesBuffer[depth];
    if (valueBuffer) {
      for (const subject of subjects) {
        const depthOffsetGraph = await this.util.getDepthOffsetGraph(depth, keys);
        const graphs: RDF.Term[] = (this.parsingContext.graphStack[depth] || depthOffsetGraph >= 0)
          ? this.parsingContext.idStack[depth - depthOffsetGraph - 1]
          : [ await this.util.getGraphContainerValue(keys, depth) ];
        if (graphs) {
          for (const graph of graphs) {
            // Flush values to stream if the graph @id is known
            this.parsingContext.emittedStack[depth] = true;
            for (const bufferedValue of valueBuffer) {
              if (bufferedValue.reverse) {
                this.parsingContext.emitQuad(depth, this.util.dataFactory.quad(
                  bufferedValue.object, bufferedValue.predicate, subject, graph));
              } else {
                this.parsingContext.emitQuad(depth, this.util.dataFactory.quad(
                  subject, bufferedValue.predicate, bufferedValue.object, graph));
              }
            }
          }
        } else {
          // Place the values in the graphs buffer if the graph @id is not yet known
          const subGraphBuffer = this.parsingContext.getUnidentifiedGraphBufferSafe(
            depth - await this.util.getDepthOffsetGraph(depth, keys) - 1);
          for (const bufferedValue of valueBuffer) {
            if (bufferedValue.reverse) {
              subGraphBuffer.push({
                object: subject,
                predicate: bufferedValue.predicate,
                subject: bufferedValue.object,
              });
            } else {
              subGraphBuffer.push({
                object: bufferedValue.object,
                predicate: bufferedValue.predicate,
                subject,
              });
            }
          }
        }
      }
      this.parsingContext.unidentifiedValuesBuffer.splice(depth, 1);
      this.parsingContext.literalStack.splice(depth, 1);
      this.parsingContext.jsonLiteralStack.splice(depth, 1);
    }

    // Flush graphs at this level
    const graphBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[] =
      this.parsingContext.unidentifiedGraphsBuffer[depth];
    if (graphBuffer) {
      for (const subject of subjects) {
        // A @graph statement at the root without @id relates to the default graph,
        // unless there are top-level properties,
        // others relate to blank nodes.
        const graph: RDF.Term = depth === 1 && subject.termType === 'BlankNode'
        && !this.parsingContext.topLevelProperties ? this.util.getDefaultGraph() : subject;
        this.parsingContext.emittedStack[depth] = true;
        for (const bufferedValue of graphBuffer) {
          this.parsingContext.emitQuad(depth, this.util.dataFactory.quad(
            bufferedValue.subject, bufferedValue.predicate, bufferedValue.object, graph));
        }
      }
      this.parsingContext.unidentifiedGraphsBuffer.splice(depth, 1);
    }
  }

  /**
   * Check if at least one {@link IEntryHandler} validates the entry to true.
   * @param {any[]} keys A stack of keys.
   * @param {number} depth A depth.
   * @param {boolean} inProperty If the current depth is part of a valid property node.
   * @return {Promise<{ valid: boolean, property: boolean }>} A promise resolving to true or false.
   */
  protected async validateKey(keys: any[], depth: number, inProperty: boolean)
    : Promise<{ valid: boolean, property: boolean }> {
    for (const entryHandler of JsonLdParser.ENTRY_HANDLERS) {
      if (await entryHandler.validate(this.parsingContext, this.util, keys, depth, inProperty)) {
        return { valid: true, property: inProperty || entryHandler.isPropertyHandler() };
      }
    }
    return { valid: false, property: false };
  }

  /**
   * Attach all required listeners to the JSON parser.
   *
   * This should only be called once.
   */
  protected onJsonEvent(event: JsonEvent) {
    let key: any;
    let value: any;
    switch (event.type) {
    case 'open-object':
      this.insertInStack(event.key, {}, true);
      return;
    case 'open-array':
      this.insertInStack(event.key, [], true);
      return;
    case 'value':
      this.insertInStack(event.key, event.value, false);
      key = event.key;
      value = event.value;
      break;
    case 'close-object':
    case 'close-array':
      key = this.jsonKeyStack[this.jsonKeyStack.length - 1];
      value = this.jsonValueStack[this.jsonValueStack.length - 1];
    }

    const depth = this.jsonKeyStack.length;
    const keys = <string[]><any[]>[undefined, ...this.jsonKeyStack];

    if (!this.isParsingContextInner()) { // Don't parse inner nodes inside @context
      const valueJobCb = () => this.newOnValueJob(keys, value, depth, true);
      if (!this.parsingContext.streamingProfile
          && !this.parsingContext.contextTree.getContext(keys.slice(0, -1))) {
          // If an out-of-order context is allowed,
          // we have to buffer everything.
          // We store jobs for @context's and @type's separately,
          // because at the end, we have to process them first.
          // We also handle @type because these *could* introduce a type-scoped context.
        if (key === '@context') {
          let jobs = this.contextJobs[depth];
          if (!jobs) {
            jobs = this.contextJobs[depth] = [];
          }
          jobs.push(valueJobCb);
        } else if (key === '@type'
            || typeof key === 'number' && this.jsonKeyStack[this.jsonKeyStack.length - 2] === '@type') { // Also capture @type with array values
            // Remove @type from keys, because we want it to apply to parent later on
          this.typeJobs.push({ job: valueJobCb, keys: keys.slice(0, keys.length - 1) });
        } else {
          this.contextAwaitingJobs.push({ job: valueJobCb, keys });
        }
      } else {
          // Make sure that our value jobs are chained synchronously
        this.lastOnValueJob = this.lastOnValueJob.then(valueJobCb);
      }

        // Execute all buffered jobs on deeper levels
      if (!this.parsingContext.streamingProfile && depth === 0) {
        this.lastOnValueJob = this.lastOnValueJob
            .then(() => this.executeBufferedJobs());
      }
    }

    switch (event.type) {
    case 'close-object':
    case 'close-array':
      this.jsonValueStack.pop();
    case "value":
      this.jsonKeyStack.pop();
    }
  }

  /**
   * Check if the parser is currently parsing an element that is part of an @context entry.
   * @return {boolean} A boolean.
   */
  protected isParsingContextInner() {
    return this.jsonKeyStack.slice(0, -1).includes('@context');
  }

  /**
   * Execute all buffered jobs.
   * @return {Promise<void>} A promise resolving if all jobs are finished.
   */
  protected async executeBufferedJobs() {
    // Handle context jobs
    for (const jobs of this.contextJobs) {
      if (jobs) {
        for (const job of jobs) {
          await job();
        }
      }
    }

    // Clear the keyword cache.
    this.parsingContext.unaliasedKeywordCacheStack.splice(0);

    // Handle non-context jobs
    for (const job of this.contextAwaitingJobs) {
      // Check if we have a type (with possible type-scoped context) that should be handled before.
      // We check all possible parent nodes for the current job, from root to leaves.
      if (this.typeJobs.length > 0) {
        // First collect all applicable type jobs
        const applicableTypeJobs: { job: () => Promise<void>, keys: (string | number)[] }[] = [];
        const applicableTypeJobIds: number[] = [];
        for (let i = 0; i < this.typeJobs.length; i++) {
          const typeJob = this.typeJobs[i];
          if (Util.isPrefixArray(typeJob.keys, job.keys)) {
            applicableTypeJobs.push(typeJob);
            applicableTypeJobIds.push(i);
          }
        }

        // Next, sort the jobs from short to long key length (to ensure types higher up in the tree to be handled first)
        const sortedTypeJobs = applicableTypeJobs.sort((job1, job2) => job1.keys.length - job2.keys.length);

        // Finally, execute the jobs in order
        for (const typeJob of sortedTypeJobs) {
          await typeJob.job();
        }

        // Remove the executed type jobs
        // Sort first, so we can efficiently splice
        const sortedApplicableTypeJobIds = applicableTypeJobIds.sort().reverse();
        for (const jobId of sortedApplicableTypeJobIds) {
          this.typeJobs.splice(jobId, 1);
        }
      }

      await job.job();
    }
  }

  private insertInStack(key: string | number | undefined, value: any, push: boolean): void {
    if (typeof key === 'string') {
      this.jsonKeyStack.push(key);
      this.jsonValueStack[this.jsonValueStack.length - 1][key] = value;
    } else if (typeof key === 'number') {
      this.jsonKeyStack.push(key);
      this.jsonValueStack[this.jsonValueStack.length - 1].push(value);
    }
    if (push) {
      this.jsonValueStack.push(value);
    }
  }
}

/**
 * Constructor arguments for {@link JsonLdParser}
 */
export interface IJsonLdParserOptions {
  /**
   * A data factory.
   */
  dataFactory?: RDF.DataFactory<RDF.BaseQuad>;
  /**
   * The root context.
   */
  context?: JsonLdContext;
  /**
   * The base IRI.
   */
  baseIRI?: string;
  /**
   * If this parser can assume that parsed documents follow the streaming JSON-LD profile.
   * If true, and a non-streaming document is detected, an error may be thrown.
   * If false, non-streaming documents will be handled by preemptively buffering entries,
   * which will lose many of the streaming benefits of this parser.
   *
   * Concretely, if true, @context definitions must come as first object entries,
   * followed by @type (if they define a type-scoped context).
   *
   * Defaults to false for spec-compliance.
   */
  streamingProfile?: boolean;
  /**
   * Loader for remote contexts.
   */
  documentLoader?: IDocumentLoader;
  /**
   * If the lack of JSON-LD context link headers on raw JSON documents should NOT result in an error.
   * If true, raw JSON documents can be considered first-class JSON-LD documents.
   */
  ignoreMissingContextLinkHeader?: boolean;
  /**
   * If blank node predicates should be allowed,
   * they will be ignored otherwise.
   * Defaults to false.
   */
  produceGeneralizedRdf?: boolean;
  /**
   * The maximum JSON-LD version that should be processable by this parser.
   * Defaults to JsonLdParser.DEFAULT_PROCESSING_MODE.
   */
  processingMode?: string;
  /**
   * By default, JSON-LD requires that
   * all properties (or @id's) that are not URIs,
   * are unknown keywords,
   * and do not occur in the context
   * should be silently dropped.
   * When setting this value to true,
   * an error will be thrown when such properties occur.
   *
   * This also applies to invalid values such as language tags.
   *
   * Defaults to false.
   */
  strictValues?: boolean;
  /**
   * If RDF lists can appear in the subject position.
   * Defaults to false.
   */
  allowSubjectList?: boolean;
  /**
   * If @index inside array nodes should be validated.
   * I.e., nodes inside the same array with the same @id,
   * should have equal @index values.
   * This is not applicable to this parser as we don't do explicit flattening,
   * but it is required to be spec-compliant.
   * Defaults to false.
   *
   * Spec-compliance: to be fully spec-compliant,
   * this must be explicitly set to true.
   */
  validateValueIndexes?: boolean;
  /**
   * The graph to use as default graph when no explicit @graph is set.
   * Defaults to dataFactory.defaultGraph().
   */
  defaultGraph?: RDF.NamedNode | RDF.BlankNode | RDF.DefaultGraph;
  /**
   * The mode by which the values with a certain base direction should be transformed into RDF.
   * * 'i18n-datatype': objects have a https://www.w3.org/ns/i18n# datatype.
   * * 'compound-literal': reified values using rdf:value, rdf:direction and rdf:language.
   */
  rdfDirection?: 'i18n-datatype' | 'compound-literal';
  /**
   * If language tags should be normalized to lowercase.
   * This is always true for JSON-LD 1.0,
   * but false by default for all following versions.
   */
  normalizeLanguageTags?: boolean;
  /**
   * When the streaming profile flag is enabled,
   * `@type` entries MUST come before other properties since they may defined a type-scoped context.
   * However, when this flag is enabled, `@type` entries that do NOT
   * define a type-scoped context may appear anywhere just like a regular property.
   */
  streamingProfileAllowOutOfOrderPlainType?: boolean;
  /**
   * If JSON-LD context validation should be skipped.
   *
   * This is useful when parsing large contexts that are known to be valid.
   */
  skipContextValidation?: boolean;
}
