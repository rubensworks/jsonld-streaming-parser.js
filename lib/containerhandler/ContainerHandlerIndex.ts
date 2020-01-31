import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @index.
 *
 * This will ignore the current key and add this entry to the parent node.
 */
export class ContainerHandlerIndex implements IContainerHandler {

  public async handle(parsingContext: ParsingContext, util: Util, keys: string[], value: any, depth: number)
    : Promise<void> {
    await parsingContext.newOnValueJob(keys, value, depth - 1, true);

    parsingContext.emittedStack[depth] = false; // We have emitted a level higher
  }

}
