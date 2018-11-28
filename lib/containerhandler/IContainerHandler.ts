import {JsonLdParser} from "../JsonLdParser";

/**
 * Handler for @container types.
 */
export interface IContainerHandler {

  /**
   * Process the given value that has the given container type.
   * @param parser The active parser.
   * @param value The current value that is being parsed.
   * @param {number} depth The current stack depth.
   * @param {string[]} keys The array of stac keys.
   * @return {Promise<void>} A promise resolving when handling is done.
   */
  handle(parser: JsonLdParser, value: any, depth: number, keys: string[]): Promise<void>;

}
