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

  public async handle(parsingContext: ParsingContext, util: Util, keys: string[], value: any, depth: number)
    : Promise<void> {
    const language = await util.getContainerKey(keys, depth);

    if (Array.isArray(value)) {
      value = value.map((subValue) => ({ '@value': subValue, '@language': language }));
    } else {
      value = { '@value': value, '@language': language };
    }
    await parsingContext.newOnValueJob(keys, value, depth - 1, true);

    parsingContext.emittedStack[depth] = false; // We have emitted a level higher
  }

}
