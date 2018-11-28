import {JsonLdParser} from "../JsonLdParser";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @index.
 *
 * This will ignore the current key and add this entry to the parent node.
 */
export class ContainerHandlerIndex implements IContainerHandler {

  public async handle(parser: JsonLdParser, value: any, depth: number, keys: string[]): Promise<void> {
    await parser.newOnValueJob(value, depth - 1, keys);
  }

}
