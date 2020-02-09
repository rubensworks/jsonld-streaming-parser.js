import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";

/**
 * Handler for @container types.
 */
export interface IContainerHandler {

  /**
   * If this container type can be combined with @graph containers.
   */
  canCombineWithGraph(): boolean;

  /**
   * Process the given value that has the given container type.
   * @param containers The applicable container hash.
   * @param parsingContext The parsing context.
   * @param {Util} util A utility instance.
   * @param {string[]} keys The array of stack keys.
   * @param value The current value that is being parsed.
   * @param {number} depth The current stack depth.
   * @return {Promise<void>} A promise resolving when handling is done.
   */
  handle(containers: { [typeName: string]: boolean }, parsingContext: ParsingContext, util: Util,
         keys: string[], value: any, depth: number): Promise<void>;

}
