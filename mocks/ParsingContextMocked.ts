import * as RDF from "@rdfjs/types";
import {IParsingContextOptions, ParsingContext} from "../lib/ParsingContext";

/**
 * A {@link ParsingContext} that has no parser.
 */
export class ParsingContextMocked extends ParsingContext {

  public readonly emittedQuads: RDF.BaseQuad[];

  constructor(options?: IParsingContextOptions) {
    super({
      ...options,
      parser: <any> null,
    });
    this.emittedQuads = [];
  }

  public emitError(error: Error) {
    // Do nothing
  }

  public emitQuad(depth: number, quad: RDF.BaseQuad) {
    this.emittedQuads.push(quad);
  }

}
