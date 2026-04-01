import type { JsonLdContextNormalized } from 'jsonld-context-parser';
import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @context entries.
 */
export class EntryHandlerKeywordContext extends EntryHandlerKeyword {
  public constructor() {
    super('@context');
  }

  public isStackProcessor(): boolean {
    return false;
  }

  public async handle(
    parsingContext: ParsingContext,
    _util: Util,
    _key: any,
    keys: any[],
    value: any,
    depth: number,
  ): Promise<any> {
    // Error if an out-of-order context was found when support is not enabled.
    if (parsingContext.streamingProfile &&
      (parsingContext.processingStack[depth] ||
        parsingContext.processingType[depth] ||
        parsingContext.idStack[depth] !== undefined)) {
      parsingContext.emitError(new ErrorCoded('Found an out-of-order context, while streaming is enabled.' +
        '(disable `streamingProfile`)', ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
    }

    // Find the parent context to inherit from.
    // We actually request a context for the current depth (with fallback to parent)
    // because we want to take into account any property-scoped contexts that are defined for this depth.
    const parentContext: Promise<JsonLdContextNormalized> = parsingContext.getContext(keys);

    // Set the context for this scope
    // eslint-disable-next-line ts/no-unsafe-argument
    const context = parsingContext.parseContext(value, (await parentContext).getContextRaw());
    parsingContext.contextTree.setContext(keys.slice(0, -1), context);
    // eslint-disable-next-line ts/no-unsafe-argument
    parsingContext.emitContext(value);
    // eslint-disable-next-line ts/await-thenable
    await parsingContext.validateContext(await context);
  }
}
