import {ERROR_CODES, ErrorCoded, Util as ContextUtil} from "jsonld-context-parser";
import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {IEntryHandler} from "../IEntryHandler";

/**
 * A catch-all for keywords, that will either emit an error or ignore,
 * depending on whether or not the `strictValues` property is set.
 */
export class EntryHandlerKeywordUnknownFallback implements IEntryHandler<boolean> {

  private static readonly VALID_KEYWORDS_TYPES: {[id: string]: { type: string, errorCode: string } | null} = {
    '@index': { type: 'string', errorCode: ERROR_CODES.INVALID_INDEX_VALUE },
    '@list': null,
    '@reverse': { type: 'object', errorCode: ERROR_CODES.INVALID_REVERSE_VALUE },
    '@set': null,
    '@value': null,
  };

  public isPropertyHandler(): boolean {
    return false;
  }

  public isStackProcessor(): boolean {
    return true;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    const key = await util.unaliasKeyword(keys[depth], keys, depth);
    if (ContextUtil.isPotentialKeyword(key)) {
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
    return ContextUtil.isPotentialKeyword(key);
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    const keywordType = EntryHandlerKeywordUnknownFallback.VALID_KEYWORDS_TYPES[key];
    if (keywordType !== undefined) {
      if (keywordType && typeof value !== keywordType.type) {
        parsingContext.emitError(new ErrorCoded(`Invalid value type for '${key}' with value '${value}'`,
          keywordType.errorCode));
      }
    } else if (parsingContext.strictValues) {
      parsingContext.emitError(new Error(`Unknown keyword '${key}' with value '${value}'`));
    }
    parsingContext.emittedStack[depth] = false;
  }

}
