import {EntryHandlerPredicate} from "../entryhandler/EntryHandlerPredicate";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @type.
 *
 * This will add this entry to the parent node, and use the current key as an rdf:type value.
 */
export class ContainerHandlerType implements IContainerHandler {

  public async handle(parsingContext: ParsingContext, util: Util, keys: string[], value: any, depth: number)
    : Promise<void> {
    if (!Array.isArray(value)) {
      // Handle the value of this node, which will also cause the type predicate from above to be emitted.
      await parsingContext.newOnValueJob(keys, value, depth - 1, true);

      // Identify the type to emit.
      const keyOriginal = keys[depth];
      const context = await parsingContext.getContext(keys);
      const type = util.createVocabOrBaseTerm(context, keyOriginal);
      if (type) {
        // Push the type to the stack using the rdf:type predicate
        await EntryHandlerPredicate.handlePredicateObject(parsingContext, util, keys, depth + 1,
          util.rdfType, type, false);
      }

      // Flush any pending flush buffers
      await parsingContext.handlePendingContainerFlushBuffers();
    }

    parsingContext.emittedStack[depth] = false; // Don't emit the predicate owning this container.
  }

}
