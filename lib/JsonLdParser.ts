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
  // L0: stack depth; L1: values
  private readonly unidentifiedValuesBuffer: { predicate: RDF.Term, object: RDF.Term }[][];

  private lastDepth: number;

  constructor(options?: IJsonLdParserOptions) {
    super({ objectMode: true });
    options = options || {};
    this.dataFactory = options.dataFactory || require('rdf-data-model');
    this.jsonParser = new Parser();
    this.idStack = [];
    this.unidentifiedValuesBuffer = [];

    this.lastDepth = 0;

    this.attachJsonParserListeners();
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    this.jsonParser.write(chunk);
    callback();
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
        const buffer: { predicate: RDF.Term, object: RDF.Term }[] = this.unidentifiedValuesBuffer[depth];
        if (buffer) {
          this.unidentifiedValuesBuffer[depth] = null;
          this.flushBuffer(id, buffer);
        }
      } else {
        if (this.idStack[depth]) {
          // Emit directly if the @id was already defined
          const id = this.idStack[depth];
          // TODO: identify term types
          this.push(this.dataFactory.triple(id,
            this.dataFactory.namedNode(key), this.dataFactory.namedNode(value)));
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

        // When we go up the, emit all unidentified values using a blank node subject
        if (depth < this.lastDepth) {
          const buffer = this.unidentifiedValuesBuffer[this.lastDepth];
          if (buffer) {
            this.flushBuffer(this.dataFactory.blankNode(), buffer);
          }
        }
      }

      this.lastDepth = depth;
    };
    this.jsonParser.onError = (error: Error) => {
      this.emit('error', error);
    };
  }

  protected flushBuffer(subject: RDF.Term, buffer: { predicate: RDF.Term, object: RDF.Term }[]) {
    for (const bufferedValue of buffer) {
      this.push(this.dataFactory.triple(subject, bufferedValue.predicate, bufferedValue.object));
    }
  }

}

/**
 * Constructor arguments for {@link JsonLdParser}
 */
export interface IJsonLdParserOptions {
  dataFactory?: RDF.DataFactory;
}
