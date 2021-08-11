import * as RDF from "@rdfjs/types";
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

  public canCombineWithGraph(): boolean {
    return true;
  }

  public async handle(containers: { [typeName: string]: boolean }, parsingContext: ParsingContext, util: Util,
                      keys: string[], value: any, depth: number)
    : Promise<void> {
    let id: RDF.Term;

    // First check if the child node already has a defined id.
    if (parsingContext.emittedStack[depth + 1] && parsingContext.idStack[depth + 1]) {
      // Use the existing identifier
      id = parsingContext.idStack[depth + 1][0];
    } else {
      // Create the identifier
      const keyUnaliased = await util.getContainerKey(keys[depth], keys, depth);
      const maybeId = keyUnaliased !== null
        ? await util.resourceToTerm(await parsingContext.getContext(keys), keys[depth])
        : util.dataFactory.blankNode();

      // Do nothing if the id is invalid
      if (!maybeId) {
        parsingContext.emittedStack[depth] = false; // Don't emit the predicate owning this container.
        return;
      }
      id = maybeId;

      // Insert the id into the stack so that buffered children can make us of it.
      parsingContext.idStack[depth + 1] = [id];

    }

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
