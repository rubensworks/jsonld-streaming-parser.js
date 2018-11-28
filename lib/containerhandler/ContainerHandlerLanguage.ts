import {JsonLdParser} from "../JsonLdParser";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @language.
 */
export class ContainerHandlerLanguage implements IContainerHandler {

  public async handle(parser: JsonLdParser, value: any, depth: number, keys: string[]): Promise<void> {
    value = { '@value': value, '@language': keys[depth] };
    await parser.newOnValueJob(value, depth - 1, keys);
  }

}
