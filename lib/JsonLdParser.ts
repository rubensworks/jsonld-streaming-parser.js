import * as RDF from "rdf-js";
// tslint:disable-next-line:no-var-requires
const Parser = require('jsonparse');
import {Transform, TransformCallback} from "stream";

/**
 * A stream transformer that parses JSON-LD (text) streams to an {@link RDF.Stream}.
 */
export class JsonLdParser extends Transform {

  private readonly dataFactory: RDF.DataFactory;
  private readonly jsonParser: any;
  // Stack of identified ids, tail can be null if unknown
  private readonly idStack: RDF.NamedNode[];
  // Stack of graph flags
  private readonly graphStack: boolean[];
  // Triples that don't know their subject @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedValuesBuffer: { predicate: RDF.Term, object: RDF.Term }[][];
  // Quads that don't know their graph @id yet.
  // L0: stack depth; L1: values
  private readonly unidentifiedGraphsBuffer: { subject: RDF.Term, predicate: RDF.Term, object: RDF.Term }[][];

  private lastDepth: number;

  constructor(options?: IJsonLdParserOptions) {
    super({ objectMode: true });
    options = options || {};
    this.dataFactory = options.dataFactory || require('rdf-data-model');
    this.jsonParser = new Parser();
    this.idStack = [];
    this.graphStack = [];
    this.unidentifiedValuesBuffer = [];
    this.unidentifiedGraphsBuffer = [];

    this.lastDepth = 0;

    this.attachJsonParserListeners();
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    this.jsonParser.write(chunk);
    callback();
  }

  /**
   * @return {boolean} If the parser at its current depth is in the context of a @graph key.
   */
  public isParserAtGraph() {
    const entry = this.jsonParser.stack[this.jsonParser.stack.length - 1];
    return entry && entry.key === '@graph';
  }

  protected attachJsonParserListeners() {
    // Listen to json parser events
    this.jsonParser.onValue = (value: any) => {
      const depth = this.jsonParser.stack.length;

      const key = this.jsonParser.key;
      if (key === '@id') {
        // Error if an @id for this node already existed.
        if (this.idStack[depth]) {
          throw new Error(`Found duplicate @ids '${this.idStack[depth].value}' and '${value}'`);
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
      } else {
        if (this.idStack[depth]) {
          // Emit directly if the @id was already defined
          const subject = this.idStack[depth];
          // TODO: identify term types
          const predicate = this.dataFactory.namedNode(key);
          const object = this.dataFactory.namedNode(value);

          // Check if we're in a @graph context
          if (this.isParserAtGraph()) {
            const graph: RDF.Term = this.idStack[depth - 1];
            if (graph) {
              // Emit our quad if graph @id is known
              this.push(this.dataFactory.quad(subject, predicate, object, graph));
            } else {
              // Buffer our triple if graph @id is not known yet.
              let subGraphBuffer = this.unidentifiedGraphsBuffer[depth - 1];
              if (!subGraphBuffer) {
                subGraphBuffer = [];
                this.unidentifiedGraphsBuffer[depth - 1] = subGraphBuffer;
              }
              subGraphBuffer.push({ subject, predicate, object });
            }
          } else {
            // Emit if no @graph was applicable
            this.push(this.dataFactory.triple(subject, predicate, object));
          }
        } else {
          // Buffer until our @id becomes known, or we go up the stack
          let buffer = this.unidentifiedValuesBuffer[depth];
          if (!buffer) {
            buffer = [];
            this.unidentifiedValuesBuffer[depth] = buffer;
          }
          // TODO: identify term types
          buffer.push({ predicate: this.dataFactory.namedNode(key), object: this.dataFactory.namedNode(value) });
        }
      }

      // When we go up the, emit all unidentified values using the known id or a blank node subject
      if (depth < this.lastDepth) {
        this.flushBuffer(this.idStack[this.lastDepth] || this.dataFactory.blankNode(), this.lastDepth);

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
        let subGraphBuffer = this.unidentifiedGraphsBuffer[depth - 1];
        if (!subGraphBuffer) {
          subGraphBuffer = [];
          this.unidentifiedGraphsBuffer[depth - 1] = subGraphBuffer;
        }
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
