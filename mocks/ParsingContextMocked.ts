import {IParsingContextOptions, ParsingContext} from "../lib/ParsingContext";

/**
 * A {@link ParsingContext} that has no parser.
 */
export class ParsingContextMocked extends ParsingContext {

  constructor(options?: IParsingContextOptions) {
    super({
      ...options,
      parser: null,
    });
  }

  public emitError(error: Error) {
    // Do nothing
  }

}
