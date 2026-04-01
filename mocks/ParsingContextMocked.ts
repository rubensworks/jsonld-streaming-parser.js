import type * as RDF from '@rdfjs/types';
import type { IParsingContextOptions } from '../lib/ParsingContext';
import { ParsingContext } from '../lib/ParsingContext';

/**
 * A {@link ParsingContext} that has no parser.
 */
export class ParsingContextMocked extends ParsingContext {
  public readonly emittedQuads: RDF.BaseQuad[];

  public constructor(options?: IParsingContextOptions) {
    super({
      ...options,
      // eslint-disable-next-line ts/no-unsafe-assignment
      parser: <any> null,
    });
    this.emittedQuads = [];
  }

  public emitError(_error: Error): void {
    // Do nothing
  }

  public emitQuad(depth: number, quad: RDF.BaseQuad): void {
    this.emittedQuads.push(quad);
  }
}
