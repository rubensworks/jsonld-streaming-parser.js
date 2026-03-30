import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @included entries.
 */
export class EntryHandlerKeywordIncluded extends EntryHandlerKeyword {
  constructor() {
    super('@included');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number): Promise<any> {
    if (typeof value !== 'object') {
      parsingContext.emitError(new ErrorCoded(`Found illegal @included '${value}'`, ERROR_CODES.INVALID_INCLUDED_VALUE));
    }
    const valueUnliased = await util.unaliasKeywords(value, keys, depth, await parsingContext.getContext(keys));
    if ('@value' in valueUnliased) {
      parsingContext.emitError(new ErrorCoded(`Found an illegal @included @value node '${JSON.stringify(value)}'`, ERROR_CODES.INVALID_INCLUDED_VALUE));
    }
    if ('@list' in valueUnliased) {
      parsingContext.emitError(new ErrorCoded(`Found an illegal @included @list node '${JSON.stringify(value)}'`, ERROR_CODES.INVALID_INCLUDED_VALUE));
    }

    parsingContext.emittedStack[depth] = false;
  }
}
