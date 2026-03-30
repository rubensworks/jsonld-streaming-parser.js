import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../ParsingContext';
import type { Util } from '../Util';
import type { IContainerHandler } from './IContainerHandler';

/**
 * Container handler for @language.
 *
 * It assumes that the current key is the language of the current value.
 * This will add this value to the parent node.
 */
export class ContainerHandlerLanguage implements IContainerHandler {
  public canCombineWithGraph(): boolean {
    return false;
  }

  public async handle(containers: Record<string, boolean>, parsingContext: ParsingContext,
    util: Util, keys: string[], value: any, depth: number): Promise<void> {
    // eslint-disable-next-line ts/no-unsafe-assignment
    const language = await util.getContainerKey(keys[depth], keys, depth);

    if (Array.isArray(value)) {
      // No type-checking needed, will be handled on each value when this handler is called recursively.
      // eslint-disable-next-line ts/no-unsafe-assignment
      value = value.map(subValue => ({ '@value': subValue, '@language': language }));
    } else {
      if (typeof value !== 'string') {
        throw new ErrorCoded(
          `Got invalid language map value, got '${JSON.stringify(value)}', but expected string`,
          ERROR_CODES.INVALID_LANGUAGE_MAP_VALUE,
        );
      }
      // eslint-disable-next-line ts/no-unsafe-assignment
      value = { '@value': value, '@language': language };
    }
    await parsingContext.newOnValueJob(keys.slice(0, -1), value, depth - 1, true);

    // We have emitted a level higher
    parsingContext.emittedStack[depth] = false;
  }
}
