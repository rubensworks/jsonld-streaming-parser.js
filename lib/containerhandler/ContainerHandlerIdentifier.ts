import * as RDF from "rdf-js";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @id.
 *
 * It assumes that the current key is the identifier of the current value.
 * This will add this value to the parent node.
 */
export class ContainerHandlerIdentifier implements IContainerHandler {

  public async handle(parsingContext: ParsingContext, util: Util, keys: string[], value: any, depth: number)
    : Promise<void> {
    // Create the identifier
    const id = await util.resourceToTerm(await parsingContext.getContext(keys), keys[depth]);

    // Do nothing if the id is invalid
    if (!id) {
      parsingContext.emittedStack[depth] = false; // Don't emit the predicate owning this container.
      return;
    }

    // Insert the id into the stack so that buffered children can make us of it.
    parsingContext.idStack[depth + 1] = [ id ];

    // Insert the id into the stack so that parents can make use of it.
    // Insert it as an array because multiple id container entries may exist
    let ids: RDF.Term[] = parsingContext.idStack[depth];
    if (!ids) {
      ids = parsingContext.idStack[depth] = [];
    }
    // Only insert the term if it does not exist yet in the array.
    if (!ids.some((term) => term.equals(id))) {
      ids.push(id);
    }

    // Flush any pending flush buffers
    if (!await parsingContext.handlePendingContainerFlushBuffers()) {
      parsingContext.emittedStack[depth] = false; // Don't emit the predicate owning this container.
    }
  }

}
