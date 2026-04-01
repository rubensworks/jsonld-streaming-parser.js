import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @annotation entries.
 */
export class EntryHandlerKeywordAnnotation extends EntryHandlerKeyword {
  public constructor() {
    super('@annotation');
  }

  public async handle(
    parsingContext: ParsingContext,
    _util: Util,
    _key: any,
    _keys: any[],
    value: any,
    _depth: number,
  ): Promise<any> {
    // Validate value
    if (typeof value === 'string' || (typeof value === 'object' && value['@value'])) {
      parsingContext.emitError(new ErrorCoded(`Found illegal annotation value: ${JSON.stringify(value)}`, ERROR_CODES.INVALID_ANNOTATION));
    }

    // Rest of the processing is done as regular nodes
  }
}
