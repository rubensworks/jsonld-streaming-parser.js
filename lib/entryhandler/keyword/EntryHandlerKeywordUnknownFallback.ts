import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {IEntryHandler} from "../IEntryHandler";

/**
 * A catch-all for keywords, that will either emit an error or ignore,
 * depending on whether or not the `errorOnInvalidIris` property is set.
 */
export class EntryHandlerKeywordUnknownFallback implements IEntryHandler<boolean> {

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number): Promise<boolean> {
    return Util.isKeyword(await util.unaliasKeyword(keys[depth], depth));
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return Util.isKeyword(key);
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    if (parsingContext.errorOnInvalidProperties) {
      parsingContext.emitError(new Error(`Unknown keyword '${key}' with value '${value}'`));
    } else {
      parsingContext.emittedStack[depth] = false;
    }
  }

}
