import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @graph entries.
 */
export class EntryHandlerKeywordGraph extends EntryHandlerKeyword {
  public constructor() {
    super('@graph');
  }

  public async handle(
    parsingContext: ParsingContext,
    _util: Util,
    _key: any,
    _keys: any[],
    _value: any,
    depth: number,
  ): Promise<any> {
    // The current identifier identifies a graph for the deeper level.
    parsingContext.graphStack[depth + 1] = true;
  }
}
