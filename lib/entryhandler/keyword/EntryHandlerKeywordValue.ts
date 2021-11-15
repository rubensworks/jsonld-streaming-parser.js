import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @value entries.
 */
export class EntryHandlerKeywordValue extends EntryHandlerKeyword {

  constructor() {
    super('@value');
  }

  async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean): Promise<boolean> {
    // If this is @value, mark it so in the stack so that no deeper handling of nodes occurs.
    const key = keys[depth];
    if (key && !parsingContext.literalStack[depth] && await this.test(parsingContext, util, key, keys, depth)) {
      parsingContext.literalStack[depth] = true;
    }

    return super.validate(parsingContext, util, keys, depth, inProperty);
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return await util.unaliasKeyword(keys[depth], keys.slice(0, keys.length - 1), depth - 1, true) === '@value';
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // If the value is valid, indicate that we are processing a literal.
    // The actual value will be determined at the parent level when the @value is part of an object,
    // because we may want to take into account additional entries such as @language.
    // See {@link Util.valueToTerm}

    // Indicate that we are processing a literal, and that no later predicates should be parsed at this depth.
    parsingContext.literalStack[depth] = true;

    // Void any buffers that we may have accumulated up until now
    delete parsingContext.unidentifiedValuesBuffer[depth];
    delete parsingContext.unidentifiedGraphsBuffer[depth];

    // Indicate that we have not emitted at this depth
    parsingContext.emittedStack[depth] = false;
  }

}
