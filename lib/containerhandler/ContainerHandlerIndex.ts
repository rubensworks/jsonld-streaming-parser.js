import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @index.
 *
 * This will ignore the current key and add this entry to the parent node.
 */
export class ContainerHandlerIndex implements IContainerHandler {

  public canCombineWithGraph(): boolean {
    return true;
  }

  public async handle(containers: { [typeName: string]: boolean }, parsingContext: ParsingContext, util: Util,
                      keys: string[], value: any, depth: number)
    : Promise<void> {
    const graphContainer = '@graph' in containers;

    await parsingContext.newOnValueJob(keys, value, depth - (graphContainer ? 2 : 1), true);

    parsingContext.emittedStack[depth] = false; // We have emitted a level higher
  }

}
