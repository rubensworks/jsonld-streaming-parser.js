import {ContainerHandlerIdentifier} from "../containerhandler/ContainerHandlerIdentifier";
import {ContainerHandlerIndex} from "../containerhandler/ContainerHandlerIndex";
import {ContainerHandlerLanguage} from "../containerhandler/ContainerHandlerLanguage";
import {ContainerHandlerType} from "../containerhandler/ContainerHandlerType";
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
    '@id': new ContainerHandlerIdentifier(),
    '@index': new ContainerHandlerIndex(),
    '@language': new ContainerHandlerLanguage(),
    '@type': new ContainerHandlerType(),
  };

  /**
   * Check if we are handling a value at the given depth
   * that is part of something that should be handled as a container.
   *
   * This will ignore any arrays in the key chain.
   *
   * @param {ParsingContext} parsingContext A parsing context.
   * @param {any[]} keys The array of keys.
   * @param {number} depth The current depth.
   * @return {Promise<boolean>} If we are in the scope of a container handler.
   */
  public static async isContainerHandler(parsingContext: ParsingContext, keys: any[], depth: number): Promise<boolean> {
    for (let i = depth - 1; i >= 0; i--) {
      if (typeof keys[i] !== 'number') { // Skip array keys
        return !!EntryHandlerContainer.CONTAINER_HANDLERS[Util.getContextValueContainer(
          await parsingContext.getContext(keys), keys[i - 1])];
      }
    }
    return false;
  }

  public isPropertyHandler(): boolean {
    return false;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
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
    return testResult.handle(parsingContext, util, keys, value, depth);
  }

}
