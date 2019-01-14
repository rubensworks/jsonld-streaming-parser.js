import {ContainerHandlerIndex} from "../containerhandler/ContainerHandlerIndex";
import {ContainerHandlerLanguage} from "../containerhandler/ContainerHandlerLanguage";
import {IContainerHandler} from "../containerhandler/IContainerHandler";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IEntryHandler} from "./IEntryHandler";

/**
 * Handles values that are part of a container type (like @index),
 * as specified by {@link IContainerHandler}.
 */
export class EntryHandlerContainer implements IEntryHandler<IContainerHandler> {

  public static readonly CONTAINER_HANDLERS: {[id: string]: IContainerHandler} = {
    '@index': new ContainerHandlerIndex(),
    '@language': new ContainerHandlerLanguage(),
  };

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number)
    : Promise<boolean> {
    return !!await this.test(parsingContext, util, null, keys, depth);
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<IContainerHandler> {
    return EntryHandlerContainer.CONTAINER_HANDLERS[Util.getContextValueContainer(
      await parsingContext.getContext(keys), keys[depth - 1])];
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number,
                      testResult: IContainerHandler): Promise<any> {
    parsingContext.emittedStack[depth] = false; // We will emit a level higher
    return testResult.handle(parsingContext, keys, value, depth);
  }

}
