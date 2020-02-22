import {ContextParser, IExpandOptions, IJsonLdContextNormalized} from "jsonld-context-parser";
import {ERROR_CODES, ErrorCoded} from "jsonld-context-parser/lib/ErrorCoded";
import {JsonLdContext} from "jsonld-context-parser/lib/JsonLdContext";
import * as RDF from "rdf-js";
import {ContextTree} from "./ContextTree";
import {IJsonLdParserOptions, JsonLdParser} from "./JsonLdParser";

/**
 * Data holder for parsing information.
 */
export class ParsingContext {

  public static EXPAND_OPTIONS: {[version: number]: IExpandOptions} = {
    1.0: {
      allowNonGenDelimsIfPrefix: false,
      allowReverseRelativeToVocab: false,
      allowVocabRelativeToBase: false,
    },
    1.1: {
      allowNonGenDelimsIfPrefix: true,
      allowReverseRelativeToVocab: false,
      allowVocabRelativeToBase: true,
    },
  };

  public readonly contextParser: ContextParser;
  public readonly allowOutOfOrderContext: boolean;
  public readonly baseIRI?: string;
  public readonly produceGeneralizedRdf: boolean;
  public readonly allowSubjectList: boolean;
  public readonly processingMode: string;
  public readonly errorOnInvalidProperties: boolean;
  public readonly validateValueIndexes: boolean;
  public readonly strictRanges: boolean;
  public readonly rootContext: Promise<IJsonLdContextNormalized>;
  public readonly defaultGraph?: RDF.NamedNode | RDF.BlankNode | RDF.DefaultGraph;
  public readonly rdfDirection?: 'i18n-datatype' | 'compound-literal';
  public readonly normalizeLanguageTags?: boolean;

  // Stack of indicating if a depth has been touched.
  public readonly processingStack: boolean[];
  // Stack of indicating if triples have been emitted (or will be emitted) at each depth.
  public readonly emittedStack: boolean[];
  // Stack of identified ids (each entry can have multiple ids), tail can be null if unknown
  public readonly idStack: RDF.Term[][];
  // Stack of graph flags (if they point to an @graph in a parent node)
  public readonly graphStack: boolean[];
  // Stack of graph overrides when in an @container: @graph
  public readonly graphContainerTermStack: ({ [index: string]: RDF.NamedNode | RDF.BlankNode })[];
  // Stack of RDF list pointers (for @list)
  public readonly listPointerStack
    : ({ term: RDF.Term, listRootDepth: number } | { initialPredicate: RDF.Term, listRootDepth: number })[];
  // Stack of active contexts
  public readonly contextTree: ContextTree;
  // Stack of flags indicating if the node is a literal
  public readonly literalStack: boolean[];
  // Stack with validation results.
  public readonly validationStack: { valid: boolean, property: boolean }[];
  // Stack with cached unaliased keywords.
  public readonly unaliasedKeywordCacheStack: any[];
  // Stack of flags indicating if the node is a JSON literal
  public readonly jsonLiteralStack: boolean[];
  // Triples that don't know their subject @id yet.
  // L0: stack depth; L1: values
  public readonly unidentifiedValuesBuffer: { predicate: RDF.Term, object: RDF.Term, reverse: boolean }[][];
  // Quads that don't know their graph @id yet.
  // L0: stack depth; L1: values
  public readonly unidentifiedGraphsBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[][];

  // Depths that should be still flushed
  public pendingContainerFlushBuffers: { depth: number, keys: any[] }[];

  // If there are top-level properties
  public topLevelProperties: boolean;
  // The processing mode that was defined in the document's context
  public activeProcessingMode: number;

  private readonly parser: JsonLdParser;

  constructor(options: IParsingContextOptions) {
    // Initialize settings
    this.contextParser = new ContextParser({ documentLoader: options.documentLoader });
    this.allowOutOfOrderContext = !!options.allowOutOfOrderContext;
    this.baseIRI = options.baseIRI;
    this.produceGeneralizedRdf = !!options.produceGeneralizedRdf;
    this.allowSubjectList = !!options.allowSubjectList;
    this.processingMode = options.processingMode || JsonLdParser.DEFAULT_PROCESSING_MODE;
    this.errorOnInvalidProperties = !!options.errorOnInvalidIris;
    this.validateValueIndexes = !!options.validateValueIndexes;
    this.strictRanges = !!options.strictRanges;
    this.defaultGraph = options.defaultGraph;
    this.rdfDirection = options.rdfDirection;
    this.normalizeLanguageTags = options.normalizeLanguageTags;

    this.topLevelProperties = false;
    this.activeProcessingMode = parseFloat(this.processingMode);

    // Initialize stacks
    this.processingStack = [];
    this.emittedStack = [];
    this.idStack = [];
    this.graphStack = [];
    this.graphContainerTermStack = [];
    this.listPointerStack = [];
    this.contextTree = new ContextTree();
    this.literalStack = [];
    this.validationStack = [];
    this.unaliasedKeywordCacheStack = [];
    this.jsonLiteralStack = [];
    this.unidentifiedValuesBuffer = [];
    this.unidentifiedGraphsBuffer = [];

    this.pendingContainerFlushBuffers = [];

    this.parser = options.parser;
    if (options.context) {
      this.rootContext = this.parseContext(options.context);
      this.rootContext.then((context) => this.validateContext(context));
    } else {
      this.rootContext = Promise.resolve(this.baseIRI ? { '@base': this.baseIRI } : {});
    }
  }

  /**
   * Parse the given context with the configured options.
   * @param {JsonLdContext} context A context to parse.
   * @param {IJsonLdContextNormalized} parentContext An optional parent context.
   * @return {Promise<IJsonLdContextNormalized>} A promise resolving to the parsed context.
   */
  public async parseContext(context: JsonLdContext, parentContext?: IJsonLdContextNormalized)
    : Promise<IJsonLdContextNormalized> {
    return this.contextParser.parse(context, {
      baseIRI: this.baseIRI,
      normalizeLanguageTags: this.normalizeLanguageTags,
      parentContext,
      processingMode: this.activeProcessingMode,
    });
  }

  /**
   * Check if the given context is valid.
   * If not, an error will be thrown.
   * @param {IJsonLdContextNormalized} context A context.
   */
  public validateContext(context: IJsonLdContextNormalized) {
    const activeVersion: number = <number> <any> context['@version'];
    if (activeVersion) {
      if (this.activeProcessingMode && activeVersion > this.activeProcessingMode) {
        throw new ErrorCoded(`Unsupported JSON-LD version '${activeVersion}' under active processing mode ${
          this.activeProcessingMode}.`, ERROR_CODES.PROCESSING_MODE_CONFLICT);
      } else {
        if (this.activeProcessingMode && activeVersion < this.activeProcessingMode) {
          throw new ErrorCoded(`Invalid JSON-LD version ${activeVersion} under active processing mode ${
            this.activeProcessingMode}.`, ERROR_CODES.INVALID_VERSION_VALUE);
        }
        this.activeProcessingMode = activeVersion;
      }
    }
  }

  /**
   * Get the context at the given path.
   * @param {keys} keys The path of keys to get the context at.
   * @param {number} offset The path offset, defaults to 1.
   * @return {Promise<IJsonLdContextNormalized>} A promise resolving to a context.
   */
  public async getContext(keys: string[], offset = 1): Promise<IJsonLdContextNormalized> {
    const keysOriginal = keys;

    // Handle offset on keys
    if (offset) {
      keys = keys.slice(0, -offset);
    }

    // Determine the closest context
    const contextData = await this.getContextPropagationAware(keys);
    let context: IJsonLdContextNormalized = contextData.context;

    // Process property-scoped contexts (high-to-low)
    for (let i = contextData.depth; i < keysOriginal.length - offset; i++) {
      const key = keysOriginal[i];
      const contextKeyEntry = context[key];
      if (contextKeyEntry && typeof contextKeyEntry === 'object' && '@context' in contextKeyEntry) {
        const scopedContext = await this.parseContext(contextKeyEntry, context);
        const propagate = scopedContext[key]['@context']['@propagate']; // Propagation is true by default

        if (propagate !== false || i === keysOriginal.length - 1 - offset) {
          if (propagate !== false) {
            this.contextTree.setContext(keysOriginal.slice(0, i + offset), Promise.resolve(scopedContext));
          }
          context = scopedContext;

          // Clean up final context
          delete context['@propagate'];
          context[key] = { ...context[key] };
          delete context[key]['@context'];
        }
      }
    }

    return context;
  }

  /**
   * Get the context at the given path.
   * Non-propagating contexts will be skipped,
   * unless the context at that exact depth is retrieved.
   *
   * This ONLY takes into account context propagation logic,
   * so this should usually not be called directly,
   * call {@link #getContext} instead.
   *
   * @param keys The path of keys to get the context at.
   * @return {Promise<{ context: IJsonLdContextNormalized, depth: number }>} A context and its depth.
   */
  public async getContextPropagationAware(keys: string[]):
    Promise<{ context: IJsonLdContextNormalized, depth: number }> {
    const originalDepth = keys.length;
    let contextData: { context: IJsonLdContextNormalized, depth: number } | null = null;
    do {
      // If we had a previous iteration, jump to the parent of context depth.
      // We must do this because once we get here, last context had propagation disabled,
      // so we check its first parent instead.
      if (contextData) {
        keys = keys.slice(0, contextData.depth - 1);
      }

      contextData = await this.contextTree.getContext(keys) || { context: await this.rootContext, depth: 0 };
    } while (contextData.depth > 0
    && contextData.context['@propagate'] === false
    && contextData.depth !== originalDepth);

    // Special case for root context that does not allow propagation.
    // Fallback to empty context in that case.
    if (contextData.depth === 0 && contextData.context['@propagate'] === false && contextData.depth !== originalDepth) {
      contextData.context = {};
    }

    return contextData;
  }

  /**
   * Start a new job for parsing the given value.
   * @param {any[]} keys The stack of keys.
   * @param value The value to parse.
   * @param {number} depth The depth to parse at.
   * @param {boolean} lastDepthCheck If the lastDepth check should be done for buffer draining.
   * @return {Promise<void>} A promise resolving when the job is done.
   */
  public async newOnValueJob(keys: any[], value: any, depth: number, lastDepthCheck: boolean) {
    await this.parser.newOnValueJob(keys, value, depth, lastDepthCheck);
  }

  /**
   * Flush the pending container flush buffers
   * @return {boolean} If any pending buffers were flushed.
   */
  public async handlePendingContainerFlushBuffers(): Promise<boolean> {
    if (this.pendingContainerFlushBuffers.length > 0) {
      for (const pendingFlushBuffer of this.pendingContainerFlushBuffers) {
        await this.parser.flushBuffer(pendingFlushBuffer.depth, pendingFlushBuffer.keys);
        this.parser.flushStacks(pendingFlushBuffer.depth);
      }
      this.pendingContainerFlushBuffers.splice(0, this.pendingContainerFlushBuffers.length);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Emit the given quad into the output stream.
   * @param {number} depth The depth the quad was generated at.
   * @param {Quad} quad A quad to emit.
   */
  public emitQuad(depth: number, quad: RDF.BaseQuad) {
    if (depth === 1) {
      this.topLevelProperties = true;
    }
    this.parser.push(quad);
  }

  /**
   * Emit the given error into the output stream.
   * @param {Error} error An error to emit.
   */
  public emitError(error: Error) {
    this.parser.emit('error', error);
  }

  /**
   * Emit the given context into the output stream under the 'context' event.
   * @param {JsonLdContext} context A context to emit.
   */
  public emitContext(context: JsonLdContext) {
    this.parser.emit('context', context);
  }

  /**
   * Safely get or create the depth value of {@link ParsingContext.unidentifiedValuesBuffer}.
   * @param {number} depth A depth.
   * @return {{predicate: Term; object: Term; reverse: boolean}[]} An element of
   *                                                               {@link ParsingContext.unidentifiedValuesBuffer}.
   */
  public getUnidentifiedValueBufferSafe(depth: number): { predicate: RDF.Term, object: RDF.Term, reverse: boolean }[] {
    let buffer = this.unidentifiedValuesBuffer[depth];
    if (!buffer) {
      buffer = [];
      this.unidentifiedValuesBuffer[depth] = buffer;
    }
    return buffer;
  }

  /**
   * Safely get or create the depth value of {@link ParsingContext.unidentifiedGraphsBuffer}.
   * @param {number} depth A depth.
   * @return {{predicate: Term; object: Term; reverse: boolean}[]} An element of
   *                                                               {@link ParsingContext.unidentifiedGraphsBuffer}.
   */
  public getUnidentifiedGraphBufferSafe(depth: number): { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[] {
    let buffer = this.unidentifiedGraphsBuffer[depth];
    if (!buffer) {
      buffer = [];
      this.unidentifiedGraphsBuffer[depth] = buffer;
    }
    return buffer;
  }

  /**
   * @return IExpandOptions The expand options for the active processing mode.
   */
  public getExpandOptions(): IExpandOptions {
    return ParsingContext.EXPAND_OPTIONS[this.activeProcessingMode];
  }

  /**
   * Shift the stack at the given offset to the given depth.
   *
   * This will override anything in the stack at `depth`,
   * and this will remove anything at `depth + depthOffset`
   *
   * @param depth The target depth.
   * @param depthOffset The origin depth, relative to `depth`.
   */
  public shiftStack(depth: number, depthOffset: number) {
    // Copy the id stack value up one level so that the next job can access the id.
    const deeperIdStack = this.idStack[depth + depthOffset];
    if (deeperIdStack) {
      this.idStack[depth] = deeperIdStack;
      this.emittedStack[depth] = true;
      delete this.idStack[depth + depthOffset];
    }

    // Shorten key stack
    if (this.pendingContainerFlushBuffers.length) {
      for (const buffer of this.pendingContainerFlushBuffers) {
        if (buffer.depth >= depth + depthOffset) {
          buffer.depth -= depthOffset;
          buffer.keys.splice(depth, depthOffset);
        }
      }
    }

    // Splice stacks
    if (this.unidentifiedValuesBuffer[depth + depthOffset]) {
      this.unidentifiedValuesBuffer[depth] = this.unidentifiedValuesBuffer[depth + depthOffset];
      delete this.unidentifiedValuesBuffer[depth + depthOffset];
    }

    // TODO: also do the same for other stacks
  }

}

/**
 * Constructor arguments for {@link ParsingContext}
 */
export interface IParsingContextOptions extends IJsonLdParserOptions {
  /**
   * The parser instance.
   */
  parser: JsonLdParser;
}
