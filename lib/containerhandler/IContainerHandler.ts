import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";

/**
 * Handler for @container types.
 */
export interface IContainerHandler {

  /**
   * Process the given value that has the given container type.
   * @param parsingContext The parsing context.
   * @param {Util} util A utility instance.
   * @param {string[]} keys The array of stack keys.
   * @param value The current value that is being parsed.
   * @param {number} depth The current stack depth.
   * @return {Promise<void>} A promise resolving when handling is done.
   */
  handle(parsingContext: ParsingContext, util: Util, keys: string[], value: any, depth: number): Promise<void>;

}
