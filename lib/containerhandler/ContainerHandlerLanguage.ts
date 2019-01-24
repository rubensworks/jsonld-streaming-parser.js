import {ParsingContext} from "../ParsingContext";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @language.
 *
 * It assumes that the current key is the language of the current value.
 * This will add this value to the parent node.
 */
export class ContainerHandlerLanguage implements IContainerHandler {

  public async handle(parsingContext: ParsingContext, keys: string[], value: any, depth: number): Promise<void> {
    if (Array.isArray(value)) {
      value = value.map((subValue) => ({ '@value': subValue, '@language': keys[depth] }));
    } else {
      value = { '@value': value, '@language': keys[depth] };
    }
    await parsingContext.newOnValueJob(keys, value, depth - 1);
  }

}
