import {ERROR_CODES, ErrorCoded, JsonLdContextNormalized} from "jsonld-context-parser";
import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerPredicate} from "../EntryHandlerPredicate";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @nest entries.
 */
export class EntryHandlerKeywordNest extends EntryHandlerKeyword {

  constructor() {
    super('@nest');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    if (typeof value !== 'object') {
      parsingContext.emitError(new ErrorCoded(`Found invalid @nest entry for '${key}': '${value}'`,
        ERROR_CODES.INVALID_NEST_VALUE));
    }
    if ('@value' in await util.unaliasKeywords(value, keys, depth, await parsingContext.getContext(keys))) {
      parsingContext.emitError(new ErrorCoded(`Found an invalid @value node for '${key}'`,
        ERROR_CODES.INVALID_NEST_VALUE));
    }

    parsingContext.emittedStack[depth] = false;
  }

}
