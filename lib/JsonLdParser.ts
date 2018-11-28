import * as RDF from "rdf-js";
// tslint:disable-next-line:no-var-requires
const Parser = require('jsonparse');
import {ContextParser, IDocumentLoader, IJsonLdContextNormalized, JsonLdContext} from "jsonld-context-parser";
import {Transform, TransformCallback} from "stream";

/**
 * A stream transformer that parses JSON-LD (text) streams to an {@link RDF.Stream}.
 */
export class JsonLdParser extends Transform {

  public static readonly DEFAULT_PROCESSING_MODE: string = '1.0';
  public static readonly XSD: string = 'http://www.w3.org/2001/XMLSchema#';
  public static readonly XSD_BOOLEAN: string = JsonLdParser.XSD + 'boolean';
  public static readonly XSD_INTEGER: string = JsonLdParser.XSD + 'integer';
  public static readonly XSD_DOUBLE: string = JsonLdParser.XSD + 'double';
  public static readonly RDF: string = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

  private readonly dataFactory: RDF.DataFactory;
  private readonly contextParser: ContextParser;
  private readonly allowOutOfOrderContext: boolean;
  private readonly baseIRI: string;
  private readonly produceGeneralizedRdf: boolean;
  private readonly processingMode: string;

  private readonly jsonParser: any;
  // Stack of indicating if a depth has been touched.
  private readonly processingStack: boolean[];
  // Stack of indicating if triples have been emitted (or will be emitted) at each depth.
  private readonly emittedStack: boolean[];
  // Stack of identified ids, tail can be null if unknown
  private readonly idStack: RDF.Term[];
  // Stack of graph flags
  private readonly graphStack: boolean[];
  // Stack of RDF list pointers (for @list)
  private readonly listPointerStack: RDF.Term[];
  // Stack of active contexts
  private readonly contextStack: Promise<IJsonLdContextNormalized>[];
  // Stack of flags indicating if the node is a literal
  private readonly literalStack: boolean[];
  // Triples that don't know their subject @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedValuesBuffer: { predicate: RDF.Term, object: RDF.Term, reverse: boolean }[][];
  // Quads that don't know their graph @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedGraphsBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[][];
  // Jobs that are not started yet because of a missing @context
  private readonly contextAwaitingJobs: (() => Promise<void>)[];
  // Jobs that are not started yet that process a @context
  private readonly contextJobs: (() => Promise<void>)[];

  private readonly rdfFirst: RDF.NamedNode;
  private readonly rdfRest: RDF.NamedNode;
  private readonly rdfNil: RDF.NamedNode;
  private readonly rdfType: RDF.NamedNode;

  private rootContext: Promise<IJsonLdContextNormalized>;
  private lastDepth: number;
  private lastOnValueJob: Promise<void>;

  constructor(options?: IJsonLdParserOptions) {
    super({ objectMode: true });
    options = options || {};
    this.dataFactory = options.dataFactory || require('@rdfjs/data-model');
    this.contextParser = new ContextParser({ documentLoader: options.documentLoader });
    this.allowOutOfOrderContext = options.allowOutOfOrderContext;
    this.baseIRI = options.baseIRI;
    this.produceGeneralizedRdf = options.produceGeneralizedRdf;
    this.processingMode = options.processingMode || JsonLdParser.DEFAULT_PROCESSING_MODE;

    this.jsonParser = new Parser();
    this.processingStack = [];
    this.emittedStack = [];
    this.idStack = [];
    this.graphStack = [];
    this.listPointerStack = [];
    this.contextStack = [];
    this.literalStack = [];
    this.unidentifiedValuesBuffer = [];
    this.unidentifiedGraphsBuffer = [];
    this.contextAwaitingJobs = [];
    this.contextJobs = [];

    this.lastDepth = 0;
    if (options.context) {
      this.rootContext = this.contextParser.parse(options.context, options.baseIRI);
      this.rootContext.then((context) => this.validateContext(context));
    } else {
      this.rootContext = Promise.resolve({ '@base': this.baseIRI });
    }
    this.lastOnValueJob = Promise.resolve();

    this.rdfFirst = this.dataFactory.namedNode(JsonLdParser.RDF + 'first');
    this.rdfRest = this.dataFactory.namedNode(JsonLdParser.RDF + 'rest');
    this.rdfNil = this.dataFactory.namedNode(JsonLdParser.RDF + 'nil');
    this.rdfType = this.dataFactory.namedNode(JsonLdParser.RDF + 'type');

    this.attachJsonParserListeners();
  }

  /**
   * Helper function to get the value of a context entry,
   * or fallback to a certain value.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} contextKey A pre-defined JSON-LD key in context entries.
   * @param {string} key A context entry key.
   * @param {string} fallback A fallback value for when the given contextKey
   *                          could not be found in the value with the given key.
   * @return {string} The value of the given contextKey in the entry behind key in the given context,
   *                  or the given fallback value.
   */
  public static getContextValue(context: IJsonLdContextNormalized, contextKey: string,
                                key: string, fallback: string): string {
    const entry = context[key];
    if (!entry) {
      return fallback;
    }
    const type = entry[contextKey];
    return type === undefined ? fallback : type;
  }

  /**
   * Get the container type of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The container type.
   */
  public static getContextValueContainer(context: IJsonLdContextNormalized, key: string): string {
    return JsonLdParser.getContextValue(context, '@container', key, '@set');
  }

  /**
   * Get the node type of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueType(context: IJsonLdContextNormalized, key: string): string {
    return JsonLdParser.getContextValue(context, '@type', key, null);
  }

  /**
   * Get the node type of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueLanguage(context: IJsonLdContextNormalized, key: string): string {
    return JsonLdParser.getContextValue(context, '@language', key, context['@language'] || null);
  }

  /**
   * Check if the given key in the context is a reversed property.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {boolean} If the context value has a @reverse key.
   */
  public static isContextValueReverse(context: IJsonLdContextNormalized, key: string): boolean {
    return !!JsonLdParser.getContextValue(context, '@reverse', key, null);
  }

  /**
   * Check if the given key refers to a reversed property.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The property key.
   * @param {string} parentKey The parent key.
   * @return {boolean} If the property must be reversed.
   */
  public static isPropertyReverse(context: IJsonLdContextNormalized, key: string, parentKey: string): boolean {
    return parentKey === '@reverse' || JsonLdParser.isContextValueReverse(context, key);
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    this.jsonParser.write(chunk);
    this.lastOnValueJob
      .then(() => callback(), (error) => callback(error));
  }

  /**
   * Convert a given JSON key to an RDF predicate term,
   * based on @vocab.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node.
   */
  public predicateToTerm(context: IJsonLdContextNormalized, key: string): RDF.Term {
    const expanded: string = ContextParser.expandTerm(key, context, true);
    if (expanded.startsWith('_:')) {
      if (this.produceGeneralizedRdf) {
        return this.dataFactory.blankNode(expanded.substr(2));
      } else {
        return null;
      }
    }
    return this.dataFactory.namedNode(expanded);
  }

  /**
   * Convert a given JSON key to an RDF resource term or blank node,
   * based on @base.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node.
   */
  public resourceToTerm(context: IJsonLdContextNormalized, key: string): RDF.Term {
    if (key.startsWith('_:')) {
      return this.dataFactory.blankNode(key.substr(2));
    }
    return this.dataFactory.namedNode(ContextParser.expandTerm(key, context, false));
  }

  /**
   * Convert a given JSON value to an RDF term.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param value A JSON value.
   * @param {number} depth The depth the value is at.
   * @return {RDF.Term} An RDF term.
   */
  public valueToTerm(context: IJsonLdContextNormalized, key: string, value: any, depth: number): RDF.Term {
    const type: string = typeof value;
    switch (type) {
    case 'object':
      if ("@id" in value) {
        return this.resourceToTerm(context, value["@id"]);
      } else if (value["@value"]) {
        this.literalStack[depth + 1] = true;
        if (value["@language"]) {
          return this.dataFactory.literal(value["@value"], value["@language"]);
        } else if (value["@type"]) {
          return this.dataFactory.literal(value["@value"],
            <RDF.NamedNode> this.resourceToTerm(context, value["@type"]));
        }
        return this.dataFactory.literal(value["@value"]);
      } else if (Array.isArray(value)) {
        // We handle arrays at value level so we can emit earlier, so this is handled already when we get here.
        // Empty context-based lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if (JsonLdParser.getContextValueContainer(context, key) === '@list' && value.length === 0) {
          return this.rdfNil;
        }
        return null;
      } else if (value["@list"]) {
        // We handle lists at value level so we can emit earlier, so this is handled already when we get here.
        // Empty anonymous lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if (value["@list"].length === 0) {
          return this.rdfNil;
        }
        return null;
      } else if (value["@reverse"]) {
        // We handle reverse properties at value level so we can emit earlier,
        // so this is handled already when we get here.
        return null;
      } else {
        // Only make a blank node if at least one triple was emitted at the value's level.
        if (this.emittedStack[depth + 1]) {
          return this.idStack[depth + 1] = this.dataFactory.blankNode();
        } else {
          return null;
        }
      }
    case 'string':
      return this.stringValueToTerm(context, key, value, null);
    case 'boolean':
      return this.stringValueToTerm(context, key, Boolean(value).toString(),
        this.dataFactory.namedNode(JsonLdParser.XSD_BOOLEAN));
    case 'number':
      const integer = value % 1 === 0;
      if (Number.isFinite(value)) {
        value = Number(value).toString();
        if (!integer) {
          value += 'E0';
        }
      } else {
        value = value > 0 ? 'INF' : '-INF';
      }
      return this.stringValueToTerm(context, key, value, this.dataFactory.namedNode(
        integer ? JsonLdParser.XSD_INTEGER : JsonLdParser.XSD_DOUBLE));
    default:
      this.emit('error', new Error(`Could not determine the RDF type of a ${type}`));
    }
  }

  /**
   * Convert a given JSON string value to an RDF term.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param {string} value A JSON value.
   * @param {NamedNode} defaultDatatype The default datatype for the given value.
   * @return {RDF.Term} An RDF term.
   */
  public stringValueToTerm(context: IJsonLdContextNormalized, key: string, value: string,
                           defaultDatatype: RDF.NamedNode): RDF.Term {
    const contextType = JsonLdParser.getContextValueType(context, key);
    if (contextType) {
      if (contextType === '@id') {
        return this.resourceToTerm(context, value);
      } else {
        return this.dataFactory.literal(value, this.dataFactory.namedNode(contextType));
      }
    }

    if (!defaultDatatype) {
      const contextLanguage = JsonLdParser.getContextValueLanguage(context, key);
      if (contextLanguage) {
        return this.dataFactory.literal(value, contextLanguage);
      }
    }

    return this.dataFactory.literal(value, defaultDatatype);
  }

  public getContext(depth: number): Promise<IJsonLdContextNormalized> {
    for (let i = depth; i >= 0; i--) {
      if (this.contextStack[i]) {
        return this.contextStack[i];
      }
    }
    return this.rootContext;
  }

  protected async validateContext(context: IJsonLdContextNormalized) {
    const activeVersion: string = <string> <any> context['@version'];
    if (activeVersion && parseFloat(activeVersion) > parseFloat(this.processingMode)) {
      throw new Error(`Unsupported JSON-LD processing mode: ${activeVersion}`);
    }
  }

  protected getUnidentifiedValueBufferSafe(depth: number) {
    let buffer = this.unidentifiedValuesBuffer[depth];
    if (!buffer) {
      buffer = [];
      this.unidentifiedValuesBuffer[depth] = buffer;
    }
    return buffer;
  }

  protected getUnidentifiedGraphBufferSafe(depth: number) {
    let buffer = this.unidentifiedGraphsBuffer[depth];
    if (!buffer) {
      buffer = [];
      this.unidentifiedGraphsBuffer[depth] = buffer;
    }
    return buffer;
  }

  protected attachJsonParserListeners() {
    // Listen to json parser events
    this.jsonParser.onValue = (value: any) => {
      const depth = this.jsonParser.stack.length;
      const keys = (new Array(depth + 1).fill(0)).map((v, i) => {
        return i === depth ? this.jsonParser.key : this.jsonParser.stack[i].key;
      });

      if (!this.isParsingContextInner(depth)) { // Don't parse inner nodes inside @context
        const valueJobCb = () => this.newOnValueJob(value, depth, keys);
        if (this.allowOutOfOrderContext && !this.contextStack[depth]) {
          // If an out-of-order context is allowed,
          // we have to buffer everything.
          // We store jobs for @context's separately,
          // because at the end, we have to process them first.
          if (keys[depth] === '@context') {
            this.contextJobs[depth] = valueJobCb;
          } else {
            this.contextAwaitingJobs.push(valueJobCb);
          }
        } else {
          // Make sure that our value jobs are chained synchronously
          this.lastOnValueJob = this.lastOnValueJob.then(valueJobCb);
        }

        // Execute all buffered jobs on deeper levels
        if (this.allowOutOfOrderContext && depth === 0) {
          this.lastOnValueJob = this.lastOnValueJob
            .then(() => this.executeBufferedJobs());
        }
      }
    };
    this.jsonParser.onError = (error: Error) => {
      this.emit('error', error);
    };
  }

  protected isParsingContextInner(depth: number) {
    for (let i = depth; i > 0; i--) {
      if (this.jsonParser.stack[i - 1].key === '@context') {
        return true;
      }
    }
    return false;
  }

  protected async handleListElement(value: RDF.Term, depth: number, listRootDepth: number, listRootKey: string) {
    const predicate = await this.predicateToTerm(await this.getContext(listRootDepth), listRootKey);
    if (!predicate) {
      // Don't emit anything if the predicate can not be determined (usually when the predicate is a bnode)
      return;
    }

    // Buffer our value as an RDF list using the listRootKey as predicate
    let listPointer: RDF.Term = this.listPointerStack[depth];

    // Link our list to the subject
    if (!listPointer) {
      listPointer = this.dataFactory.blankNode();
      this.getUnidentifiedValueBufferSafe(listRootDepth).push(
        { predicate, object: listPointer, reverse: false });
    } else {
      // rdf:rest links are always emitted before the next element,
      // as the blank node identifier is only created at that point.
      // Because of this reason, the final rdf:nil is emitted when the stack depth is decreased.
      const newListPointer: RDF.Term = this.dataFactory.blankNode();
      this.emit('data', this.dataFactory.triple(listPointer, this.rdfRest, newListPointer));
      listPointer = newListPointer;
    }

    this.emit('data', this.dataFactory.triple(listPointer, this.rdfFirst, value));

    this.listPointerStack[depth] = listPointer;
  }

  /**
   * Check how many parents should be skipped for checking the @graph for the given node.
   *
   * @param {number} depth The depth of the node.
   * @param {any[]} keys An array of keys.
   * @return {number} The graph depth offset.
   */
  protected getDepthOffsetGraph(depth: number, keys: any[]): number {
    for (let i = depth - 1; i > 0; i--) {
      if (keys[i] === '@graph') {
        return depth - i - 1;
      }
    }
    return -1;
  }

  protected async newOnValueJob(value: any, depth: number, keys: any[]) {
    const key = keys[depth];
    const parentKey = depth > 0 && keys[depth - 1];
    const depthOffsetGraph = this.getDepthOffsetGraph(depth, keys);
    this.emittedStack[depth] = true;

    // Keywords inside @reverse is not allowed
    if (typeof key === 'string' && key.startsWith('@') && parentKey === '@reverse') {
      this.emit('error', new Error(`Found the @id '${value}' inside an @reverse property`));
    }

    if (key === '@context') {
      // Error if an out-of-order context was found when support is not enabled.
      if (!this.allowOutOfOrderContext && this.processingStack[depth]) {
        this.emit('error', new Error('Found an out-of-order context, while support is not enabled.' +
          '(enable with `allowOutOfOrderContext`)'));
      }

      // Find the parent context to inherit from
      const parentContext: Promise<IJsonLdContextNormalized> = this.getContext(depth - 1);
      // Set the context for this scope
      this.contextStack[depth] = this.contextParser.parse(value, this.baseIRI, await parentContext);
      await this.validateContext(await this.contextStack[depth]);
    } else if (key === '@id') {
      // Error if an @id for this node already existed.
      if (this.idStack[depth]) {
        this.emit('error', new Error(`Found duplicate @ids '${this.idStack[depth].value}' and '${value}'`));
      }

      // Save our @id on the stack
      const id: RDF.Term = await this.resourceToTerm(await this.getContext(depth), value);
      this.idStack[depth] = id;
    } else if (key === '@graph') {
      // The current identifier identifies a graph for the deeper level.
      this.graphStack[depth + 1] = true;
    } else if (key === '@type') {
      // The current identifier identifies an rdf:type predicate.
      // But we only emit it once the node closes,
      // as it's possible that the @type is used to identify the datatype of a literal, which we ignore here.
      const context = await this.getContext(depth);
      const predicate = this.rdfType;
      const reverse = JsonLdParser.isPropertyReverse(context, key, parentKey);
      if (Array.isArray(value)) {
        for (const element of value) {
          this.getUnidentifiedValueBufferSafe(depth).push(
            { predicate, object: this.resourceToTerm(context, element), reverse });
        }
      } else {
        this.getUnidentifiedValueBufferSafe(depth).push(
          { predicate, object: this.resourceToTerm(context, value), reverse });
      }
    } else if (typeof key === 'number') {
      // Check if we have an anonymous list
      if (parentKey === '@list') {
        // Our value is part of an array
        const object = this.valueToTerm(await this.getContext(depth), parentKey, value, depth);
        await this.handleListElement(object, depth, depth - 2, keys[depth - 2]);
      } else if (parentKey && parentKey !== '@type') {
        // Buffer our value using the parent key as predicate

        // Check if the predicate is marked as an @list in the context
        const parentContext = await this.getContext(depth - 1);
        if (JsonLdParser.getContextValueContainer(parentContext, parentKey) === '@list') {
          // Our value is part of an array
          const object = this.valueToTerm(await this.getContext(depth), parentKey, value, depth);
          await this.handleListElement(object, depth, depth - 1, parentKey);
        } else {
          await this.newOnValueJob(value, depth - 1, keys);
        }
      }
    } else if (key && !key.startsWith('@')) {
      const context = await this.getContext(depth);
      const predicate = await this.predicateToTerm(context, key);
      if (predicate) {
        const object = this.valueToTerm(context, key, value, depth);
        if (object) {
          const reverse = JsonLdParser.isPropertyReverse(context, key, parentKey);
          const depthProperties: number = depth - (parentKey === '@reverse' ? 1 : 0);
          const depthPropertiesGraph: number = depth - depthOffsetGraph;

          if (this.idStack[depthProperties]) {
            // Emit directly if the @id was already defined
            const subject = this.idStack[depthProperties];

            // Check if we're in a @graph context
            const atGraph = depthOffsetGraph >= 0;
            if (atGraph) {
              const graph: RDF.Term = this.idStack[depthPropertiesGraph - 1];
              if (graph) {
                // Emit our quad if graph @id is known
                if (reverse) {
                  this.push(this.dataFactory.quad(object, predicate, subject, graph));
                } else {
                  this.push(this.dataFactory.quad(subject, predicate, object, graph));
                }
              } else {
                // Buffer our triple if graph @id is not known yet.
                if (reverse) {
                  this.getUnidentifiedGraphBufferSafe(depthPropertiesGraph - 1).push(
                    { subject: object, predicate, object: subject });
                } else {
                  this.getUnidentifiedGraphBufferSafe(depthPropertiesGraph - 1)
                    .push({ subject, predicate, object });
                }
              }
            } else {
              // Emit if no @graph was applicable
              if (reverse) {
                this.push(this.dataFactory.triple(object, predicate, subject));
              } else {
                this.push(this.dataFactory.triple(subject, predicate, object));
              }
            }
          } else {
            // Buffer until our @id becomes known, or we go up the stack
            this.getUnidentifiedValueBufferSafe(depthProperties).push({ predicate, object, reverse });
          }
        } else {
          // An invalid value was encountered, so we ignore it higher in the stack.
          this.emittedStack[depth] = false;
        }
      }
    } else {
      // Unknown keyword, or usage of a keyword at the incorrect place
      this.emittedStack[depth] = false;
    }

    // Flag that this depth is processed
    this.processingStack[depth] = true;

    // When we go up the stack, emit all unidentified values
    if (depth < this.lastDepth) {
      this.flushBuffer(this.lastDepth, keys);

      // Check if we had any RDF lists that need to be terminated with an rdf:nil
      if (this.listPointerStack[this.lastDepth]) {
        this.emit('data', this.dataFactory.triple(this.listPointerStack[this.lastDepth], this.rdfRest, this.rdfNil));
        delete this.listPointerStack[this.lastDepth];
      }

      // Reset our stack
      delete this.processingStack[this.lastDepth];
      delete this.emittedStack[this.lastDepth];
      delete this.idStack[this.lastDepth];
      delete this.graphStack[this.lastDepth + 1];
      if (!this.allowOutOfOrderContext) {
        // Only delete context if no out-of-order context is allowed,
        // because otherwise, we handle them in a different order.
        delete this.contextStack[this.lastDepth];
      }
    }
    this.lastDepth = depth;
  }

  protected async executeBufferedJobs() {
    // Handle context jobs
    for (const job of this.contextJobs) {
      if (job) {
        await job();
      }
    }

    // Handle non-context jobs
    for (const job of this.contextAwaitingJobs) {
      await job();
    }
  }

  protected flushBuffer(depth: number, keys: any[]) {
    const subject: RDF.Term = this.idStack[depth] || this.dataFactory.blankNode();

    // Flush values at this level
    const valueBuffer: { predicate: RDF.Term, object: RDF.Term, reverse: boolean }[] =
      this.unidentifiedValuesBuffer[depth];
    if (valueBuffer) {
      const graph: RDF.Term = this.graphStack[depth] || this.getDepthOffsetGraph(depth, keys) >= 0
        ? this.idStack[depth - this.getDepthOffsetGraph(depth, keys) - 1] : this.dataFactory.defaultGraph();
      const isLiteral: boolean = this.literalStack[depth];
      if (graph) {
        // Flush values to stream if the graph @id is known
        for (const bufferedValue of valueBuffer) {
          if (!isLiteral || !bufferedValue.predicate.equals(this.rdfType)) { // Skip @type on literals with an @value
            if (bufferedValue.reverse) {
              this.push(this.dataFactory.quad(bufferedValue.object, bufferedValue.predicate, subject, graph));
            } else {
              this.push(this.dataFactory.quad(subject, bufferedValue.predicate, bufferedValue.object, graph));
            }
          }
        }
      } else {
        // Place the values in the graphs buffer if the graph @id is not yet known
        const subGraphBuffer = this.getUnidentifiedGraphBufferSafe(depth - this.getDepthOffsetGraph(depth, keys) - 1);
        for (const bufferedValue of valueBuffer) {
          if (!isLiteral || !bufferedValue.predicate.equals(this.rdfType)) { // Skip @type on literals with an @value
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
      delete this.unidentifiedValuesBuffer[depth];
      delete this.literalStack[depth];
    }

    // Flush graphs at this level
    const graphBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[] =
      this.unidentifiedGraphsBuffer[depth];
    if (graphBuffer) {
      // A @graph statement at the root without @id relates to the default graph,
      // others relate to blank nodes.
      const graph: RDF.Term = depth === 1 && subject.termType === 'BlankNode'
        ? this.dataFactory.defaultGraph() : subject;
      for (const bufferedValue of graphBuffer) {
        this.push(this.dataFactory.quad(bufferedValue.subject, bufferedValue.predicate, bufferedValue.object, graph));
      }
      delete this.unidentifiedGraphsBuffer[depth];
    }
  }
}

/**
 * Constructor arguments for {@link JsonLdParser}
 */
export interface IJsonLdParserOptions {
  dataFactory?: RDF.DataFactory;
  context?: JsonLdContext;
  baseIRI?: string;
  /**
   * If @context definitions should be allowed as non-first object entries.
   * When enabled, streaming results may not come as soon as possible,
   * and will be buffered until the end when no context is defined at all.
   * Defaults to false.
   */
  allowOutOfOrderContext?: boolean;
  /**
   * Loader for remote contexts.
   */
  documentLoader?: IDocumentLoader;
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
}
