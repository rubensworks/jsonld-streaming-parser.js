import {ParsingContext} from "../ParsingContext";

/**
 * Handler for @container types.
 */
export interface IContainerHandler {

  /**
   * Process the given value that has the given container type.
   * @param {string[]} keys The array of stack keys.
   * @param parsingContext The parsing context.
   * @param value The current value that is being parsed.
   * @param {number} depth The current stack depth.
   * @return {Promise<void>} A promise resolving when handling is done.
   */
  handle(parsingContext: ParsingContext, keys: string[], value: any, depth: number): Promise<void>;

}
