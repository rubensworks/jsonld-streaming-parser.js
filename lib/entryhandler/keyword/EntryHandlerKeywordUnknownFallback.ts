import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {IEntryHandler} from "../IEntryHandler";

/**
 * A catch-all for keywords, that will either emit an error or ignore,
 * depending on whether or not the `errorOnInvalidIris` property is set.
 */
export class EntryHandlerKeywordUnknownFallback implements IEntryHandler<boolean> {

  private static readonly VALID_KEYWORDS: string[] = [
    '@list',
    '@set',
    '@reverse',
    '@value',
  ];

  public isPropertyHandler(): boolean {
    return false;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    const key = await util.unaliasKeyword(keys[depth], keys, depth);
    if (Util.isKeyword(key)) {
      // Don't emit anything inside free-floating lists
      if (!inProperty) {
        if (key === '@list') {
          return false;
        }
      }

      return true;
    }
    return false;
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return Util.isKeyword(key);
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    if (parsingContext.errorOnInvalidProperties
      && EntryHandlerKeywordUnknownFallback.VALID_KEYWORDS.indexOf(key) < 0) {
      parsingContext.emitError(new Error(`Unknown keyword '${key}' with value '${value}'`));
    } else {
      parsingContext.emittedStack[depth] = false;
    }
  }

}
