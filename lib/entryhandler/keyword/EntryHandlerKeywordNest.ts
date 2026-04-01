import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @nest entries.
 */
export class EntryHandlerKeywordNest extends EntryHandlerKeyword {
  public constructor() {
    super('@nest');
  }

  public async handle(
    parsingContext: ParsingContext,
    util: Util,
    key: any,
    keys: any[],
    value: any,
    depth: number,
  ): Promise<any> {
    if (typeof value !== 'object') {
      parsingContext.emitError(new ErrorCoded(`Found invalid @nest entry for '${key}': '${value}'`, ERROR_CODES.INVALID_NEST_VALUE));
    }
    const parentContext = await parsingContext.getContext(keys);
    // eslint-disable-next-line ts/no-unsafe-argument
    if ('@value' in await util.unaliasKeywords(value, <string[]>keys, depth, <any>parentContext)) {
      parsingContext.emitError(new ErrorCoded(`Found an invalid @value node for '${key}'`, ERROR_CODES.INVALID_NEST_VALUE));
    }

    parsingContext.emittedStack[depth] = false;
  }
}
