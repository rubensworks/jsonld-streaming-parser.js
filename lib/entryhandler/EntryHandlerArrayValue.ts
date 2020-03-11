import * as RDF from "rdf-js";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IEntryHandler} from "./IEntryHandler";

/**
 * Handles values that are part of an array.
 */
export class EntryHandlerArrayValue implements IEntryHandler<boolean> {

  public isPropertyHandler(): boolean {
    return false;
  }

  public isStackProcessor(): boolean {
    return true;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    return this.test(parsingContext, util, null, keys, depth);
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return typeof keys[depth] === 'number';
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    const parentKey = await util.unaliasKeywordParent(keys, depth);

    // Check if we have an anonymous list
    if (parentKey === '@list') {
      // Our value is part of an array

      // Determine the list root key
      let listRootKey: string | number | null = null;
      let listRootDepth = 0;
      for (let i = depth - 2; i > 0; i--) {
        const keyOption = keys[i];
        if (typeof keyOption === 'string' || typeof keyOption === 'number') {
          listRootDepth = i;
          listRootKey = keyOption;
          break;
        }
      }

      if (listRootKey !== null) {
        // Emit the given objects as list elements
        const values = await util.valueToTerm(await parsingContext.getContext(keys),
          <string> listRootKey, value, depth, keys);
        for (const object of values) {
          await this.handleListElement(parsingContext, util, object, depth,
            keys.slice(0, listRootDepth), listRootDepth);
        }

        // If no values were found, emit a falsy list element to force an empty RDF list to be emitted.
        if (values.length === 0) {
          await this.handleListElement(parsingContext, util, null, depth, keys.slice(0, listRootDepth), listRootDepth);
        }
      }
    } else if (parentKey === '@set') {
      // Our value is part of a set, so we just add it to the parent-parent
      await parsingContext.newOnValueJob(keys.slice(0, -2), value, depth - 2, false);
    } else if (parentKey !== undefined && parentKey !== '@type') {
      // Buffer our value using the parent key as predicate

      // Check if the predicate is marked as an @list in the context
      const parentContext = await parsingContext.getContext(keys.slice(0, -1));
      if ('@list' in Util.getContextValueContainer(parentContext, parentKey)) {
        // Our value is part of an array
        // Emit the given objects as list elements
        const values = await util.valueToTerm(await parsingContext.getContext(keys), parentKey, value, depth, keys);
        for (const object of values) {
          await this.handleListElement(parsingContext, util, object, depth, keys.slice(0, -1), depth - 1);
        }

        // If no values were found, emit a falsy list element to force an empty RDF list to be emitted.
        if (values.length === 0) {
          await this.handleListElement(parsingContext, util, null, depth, keys.slice(0, -1), depth - 1);
        }
      } else {
        // Copy the stack values up one level so that the next job can access them.
        parsingContext.shiftStack(depth, 1);

        // Execute the job one level higher
        await parsingContext.newOnValueJob(keys.slice(0, -1), value, depth - 1, false);

        // Remove any defined contexts at this level to avoid it to propagate to the next array element.
        parsingContext.contextTree.removeContext(keys.slice(0, -1));
      }
    }
  }

  protected async handleListElement(parsingContext: ParsingContext, util: Util, value: RDF.Term | null, depth: number,
                                    listRootKeys: string[], listRootDepth: number) {
    // Buffer our value as an RDF list using the listRootKey as predicate
    let listPointer = parsingContext.listPointerStack[depth];

    if (value) {
      if (!listPointer || !listPointer.value) {
        const linkTerm: RDF.BlankNode = util.dataFactory.blankNode();
        listPointer = { value: linkTerm, listRootDepth, listId: linkTerm };
      } else {
        // rdf:rest links are always emitted before the next element,
        // as the blank node identifier is only created at that point.
        // Because of this reason, the final rdf:nil is emitted when the stack depth is decreased.
        const newLinkTerm: RDF.Term = util.dataFactory.blankNode();
        parsingContext.emitQuad(depth, util.dataFactory.quad(listPointer.value, util.rdfRest, newLinkTerm,
          util.getDefaultGraph()));

        // Update the list pointer for the next element
        listPointer.value = newLinkTerm;
      }

      // Emit a list element for the current value
      parsingContext.emitQuad(depth, util.dataFactory.quad(<RDF.Term> listPointer.value, util.rdfFirst, value,
        util.getDefaultGraph()));
    } else {
      // A falsy list element if found.
      // Mark it as an rdf:nil list until another valid list element comes in
      if (!listPointer) {
        listPointer = { listRootDepth, listId: util.rdfNil };
      }
    }

    parsingContext.listPointerStack[depth] = listPointer;
  }

}
