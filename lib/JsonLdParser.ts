import * as RDF from "rdf-js";
// tslint:disable-next-line:no-var-requires
const Parser = require('jsonparse');
import {Transform, TransformCallback} from "stream";

/**
 * A stream transformer that parses JSON-LD (text) streams to an {@link RDF.Stream}.
 */
export class JsonLdParser extends Transform {

  public static readonly XSD: string = 'http://www.w3.org/2001/XMLSchema#';
  public static readonly XSD_BOOLEAN: string = JsonLdParser.XSD + 'boolean';
  public static readonly XSD_INTEGER: string = JsonLdParser.XSD + 'integer';
  public static readonly XSD_DOUBLE: string = JsonLdParser.XSD + 'double';
  public static readonly RDF: string = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

  private readonly dataFactory: RDF.DataFactory;
  private readonly jsonParser: any;
  // Stack of identified ids, tail can be null if unknown
  private readonly idStack: RDF.Term[];
  // Stack of graph flags
  private readonly graphStack: boolean[];
  // Stack of RDF list pointers (for @list)
  private readonly listPointerStack: RDF.Term[];
  // Triples that don't know their subject @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedValuesBuffer: { predicate: RDF.Term, object: RDF.Term }[][];
  // Quads that don't know their graph @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedGraphsBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[][];
  private readonly rdfFirst: RDF.NamedNode;
  private readonly rdfRest: RDF.NamedNode;
  private readonly rdfNil: RDF.NamedNode;

  private lastDepth: number;

  constructor(options?: IJsonLdParserOptions) {
    super({ objectMode: true });
    options = options || {};
    this.dataFactory = options.dataFactory || require('rdf-data-model');
    this.jsonParser = new Parser();
    this.idStack = [];
    this.graphStack = [];
    this.listPointerStack = [];
    this.unidentifiedValuesBuffer = [];
    this.unidentifiedGraphsBuffer = [];

    this.lastDepth = 0;
    this.rdfFirst = this.dataFactory.namedNode(JsonLdParser.RDF + 'first');
    this.rdfRest = this.dataFactory.namedNode(JsonLdParser.RDF + 'rest');
    this.rdfNil = this.dataFactory.namedNode(JsonLdParser.RDF + 'nil');

    this.attachJsonParserListeners();
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    this.jsonParser.write(chunk);
    callback();
  }

  /**
   * Convert a given JSON value to an RDF term.
   * @param value A JSON value.
   * @param {number} depth The depth the value is at.
   * @return {RDF.Term} An RDF term.
   */
  public valueToTerm(value: any, depth: number): RDF.Term {
    const type: string = typeof value;
    switch (type) {
    case 'object':
      if (value["@id"]) {
        return this.dataFactory.namedNode(value["@id"]);
      } else if (value["@value"]) {
        if (value["@language"]) {
          return this.dataFactory.literal(value["@value"], value["@language"]);
        } else if (value["@type"]) {
          return this.dataFactory.literal(value["@value"], this.dataFactory.namedNode(value["@type"]));
        }
        return this.dataFactory.literal(value["@value"]);
      } else if (Array.isArray(value)) {
        // We handle arrays at value level so we can emit earlier, so this is handled already when we get here.
        return null;
      } else if (value["@list"]) {
        // We handle lists at value level so we can emit earlier, so this is handled already when we get here.
        return null;
      } else {
        return this.idStack[depth + 1] = this.dataFactory.blankNode();
      }
    case 'string':
      return this.dataFactory.literal(value);
    case 'boolean':
      return this.dataFactory.literal(Boolean(value).toString(), this.dataFactory.namedNode(JsonLdParser.XSD_BOOLEAN));
    case 'number':
      return this.dataFactory.literal(Number(value).toString(), this.dataFactory.namedNode(
        value % 1 === 0 ? JsonLdParser.XSD_INTEGER : JsonLdParser.XSD_DOUBLE));
    default:
      this.emit('error', new Error(`Could not determine the RDF type of a ${type}`));
    }
  }

  /**
   * @return {boolean} If the parser at its current depth is in the context of a @graph key.
   */
  protected isParserAtGraph() {
    const entry = this.jsonParser.stack[this.jsonParser.stack.length - 1];
    return entry && entry.key === '@graph';
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

      const key = this.jsonParser.key;
      if (key === '@id') {
        // Error if an @id for this node already existed.
        if (this.idStack[depth]) {
          this.emit('error', new Error(`Found duplicate @ids '${this.idStack[depth].value}' and '${value}'`));
        }

        // Check if value is really a string/URL
        // TODO?

        // Save our @id on the stack
        const id: RDF.NamedNode = this.dataFactory.namedNode(value);
        this.idStack[depth] = id;

        // Emit all buffered values that did not have an @id up until now
        this.flushBuffer(id, depth);
      } else if (key === '@graph') {
        // The current identifier identifies a graph for the deeper level.
        this.graphStack[depth + 1] = true;
      } else if (typeof key === 'number') {
        // Our value is part of an array
        const object = this.valueToTerm(value, depth);

        const list: boolean = this.jsonParser.stack[depth - 1].key === '@list';
        if (list) {
          // Buffer our value as an RDF list using the parent-parent key as predicate

          const targetDepth = depth - 2;
          let listPointer: RDF.Term = this.listPointerStack[depth];

          // Link our list to the subject
          if (!listPointer) {
            const predicate = this.dataFactory.namedNode(this.jsonParser.stack[targetDepth].key);
            listPointer = this.dataFactory.blankNode();
            this.getUnidentifiedValueBufferSafe(targetDepth).push({ predicate, object: listPointer });
          } else {
            // rdf:rest links are always emitted before the next element,
            // as the blank node identifier is only created at that point.
            // Because of this reason, the final rdf:nil is emitted when the stack depth is decreased.
            const newListPointer: RDF.Term = this.dataFactory.blankNode();
            this.emit('data', this.dataFactory.triple(listPointer, this.rdfRest, newListPointer));
            listPointer = newListPointer;
          }

          this.emit('data', this.dataFactory.triple(listPointer, this.rdfFirst, object));

          this.listPointerStack[depth] = listPointer;
        } else {
          // Buffer our value using the parent key as predicate
          const predicate = this.dataFactory.namedNode(this.jsonParser.stack[depth - 1].key);
          this.getUnidentifiedValueBufferSafe(depth - 1).push({ predicate, object });
        }
      } else if (key && !key.startsWith('@')) {
        const predicate = this.dataFactory.namedNode(key);
        const object = this.valueToTerm(value, depth);
        if (object) {
          if (this.idStack[depth]) {
            // Emit directly if the @id was already defined
            const subject = this.idStack[depth];

            // Check if we're in a @graph context
            if (this.isParserAtGraph()) {
              const graph: RDF.Term = this.idStack[depth - 1];
              if (graph) {
                // Emit our quad if graph @id is known
                this.push(this.dataFactory.quad(subject, predicate, object, graph));
              } else {
                // Buffer our triple if graph @id is not known yet.
                this.getUnidentifiedGraphBufferSafe(depth - 1).push({subject, predicate, object});
              }
            } else {
              // Emit if no @graph was applicable
              this.push(this.dataFactory.triple(subject, predicate, object));
            }
          } else {
            // Buffer until our @id becomes known, or we go up the stack
            this.getUnidentifiedValueBufferSafe(depth).push({predicate, object});
          }
        }
      }

      // When we go up the, emit all unidentified values using the known id or a blank node subject
      if (depth < this.lastDepth) {
        this.flushBuffer(this.idStack[this.lastDepth] || this.dataFactory.blankNode(), this.lastDepth);

        // Check if we had any RDF lists that need to be terminated with an rdf:nil
        if (this.listPointerStack[this.lastDepth]) {
          this.emit('data', this.dataFactory.triple(this.listPointerStack[this.lastDepth], this.rdfRest, this.rdfNil));
          delete this.listPointerStack[this.lastDepth];
        }

        // Reset our stack
        delete this.idStack[this.lastDepth];
        delete this.graphStack[this.lastDepth + 1];
      }

      this.lastDepth = depth;
    };
    this.jsonParser.onError = (error: Error) => {
      this.emit('error', error);
    };
  }

  protected flushBuffer(subject: RDF.Term, depth: number) {
    // Flush values at this level
    const valueBuffer: { predicate: RDF.Term, object: RDF.Term }[] = this.unidentifiedValuesBuffer[depth];
    if (valueBuffer) {
      const graph: RDF.Term = this.graphStack[depth] || this.isParserAtGraph()
        ? this.idStack[depth - 1] : this.dataFactory.defaultGraph();
      if (graph) {
        // Flush values to stream if the graph @id is known
        for (const bufferedValue of valueBuffer) {
          this.push(this.dataFactory.quad(subject, bufferedValue.predicate, bufferedValue.object, graph));
        }
      } else {
        // Place the values in the graphs buffer if the graph @id is not yet known
        const subGraphBuffer = this.getUnidentifiedGraphBufferSafe(depth - 1);
        for (const bufferedValue of valueBuffer) {
          subGraphBuffer.push({ subject, predicate: bufferedValue.predicate, object: bufferedValue.object });
        }
      }
      delete this.unidentifiedValuesBuffer[depth];
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
}
