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
      // Check needed for cases where entries don't have an explicit @id
      const entryHasIdentifier = !!parsingContext.idStack[depth + 1];

      // Handle the value of this node, which will also cause the type predicate from above to be emitted.
      if (!entryHasIdentifier) {
        delete parsingContext.idStack[depth]; // Force new (blank node) identifier
      }
      await parsingContext.newOnValueJob(keys, value, depth - 1, true);
      if (!entryHasIdentifier) {
        parsingContext.idStack[depth + 1] = parsingContext.idStack[depth]; // Copy the id to the child node, for @type
      }

      // Identify the type to emit.
      const keyOriginal = await util.getContainerKey(keys, depth);
      const type = keyOriginal !== null
        ? util.createVocabOrBaseTerm(await parsingContext.getContext(keys), keyOriginal)
        : null;
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
