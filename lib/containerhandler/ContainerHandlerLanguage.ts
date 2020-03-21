import {ERROR_CODES, ErrorCoded} from "jsonld-context-parser";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

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

  public async handle(containers: { [typeName: string]: boolean }, parsingContext: ParsingContext, util: Util,
                      keys: string[], value: any, depth: number)
    : Promise<void> {
    const language = await util.getContainerKey(keys[depth], keys, depth);

    if (Array.isArray(value)) {
      // No type-checking needed, will be handled on each value when this handler is called recursively.
      value = value.map((subValue) => ({ '@value': subValue, '@language': language }));
    } else {
      if (typeof value !== 'string') {
        throw new ErrorCoded(
          `Got invalid language map value, got '${JSON.stringify(value)}', but expected string`,
          ERROR_CODES.INVALID_LANGUAGE_MAP_VALUE);
      }
      value = { '@value': value, '@language': language };
    }
    await parsingContext.newOnValueJob(keys.slice(0, keys.length - 1), value, depth - 1, true);

    parsingContext.emittedStack[depth] = false; // We have emitted a level higher
  }

}
