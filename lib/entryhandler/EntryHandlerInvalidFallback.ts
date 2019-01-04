import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IEntryHandler} from "./IEntryHandler";

/**
 * A catch-all for properties, that will either emit an error or ignore,
 * depending on whether or not the `errorOnInvalidProperties` property is set.
 */
export class EntryHandlerInvalidFallback implements IEntryHandler<boolean> {

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number): Promise<boolean> {
    return false;
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return true;
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    parsingContext.emittedStack[depth] = false;
  }

}
