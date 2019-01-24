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
      let listRootKey = null;
      let listRootDepth;
      for (let i = depth - 2; i > 0; i--) {
        const keyOption = keys[i];
        if (typeof keyOption === 'string') {
          listRootDepth = i;
          listRootKey = keyOption;
          break;
        }
      }

      const object = await util.valueToTerm(await parsingContext.getContext(keys), listRootKey, value, depth, keys);

      if (listRootKey !== null) {
        await this.handleListElement(parsingContext, util, object, depth, keys.slice(0, listRootDepth), listRootDepth,
          listRootKey);
      }
    } else if (parentKey === '@set') {
      // Our value is part of a set, so we just add it to the parent-parent
      await parsingContext.newOnValueJob(keys.slice(0, -2), value, depth - 2);
    } else if (parentKey !== undefined && parentKey !== '@type') {
      // Buffer our value using the parent key as predicate

      // Check if the predicate is marked as an @list in the context
      const parentContext = await parsingContext.getContext(keys.slice(0, -1));
      if (Util.getContextValueContainer(parentContext, parentKey) === '@list') {
        // Our value is part of an array
        const object = await util.valueToTerm(await parsingContext.getContext(keys), parentKey, value, depth, keys);
        await this.handleListElement(parsingContext, util, object, depth, keys.slice(0, -1), depth - 1, parentKey);
      } else {
        await parsingContext.newOnValueJob(keys.slice(0, -1), value, depth - 1, () => {
          // Do this so that deeper values without @id can make use of this id when they are flushed
          if (parsingContext.idStack[depth]) {
            parsingContext.idStack[depth + 1] = parsingContext.idStack[depth];
          }
          parsingContext.emittedStack[depth] = false;
        });
      }
    }
  }

  protected async handleListElement(parsingContext: ParsingContext, util: Util, value: RDF.Term, depth: number,
                                    listRootKeys: string[], listRootDepth: number, listRootKey: string) {
        // Buffer our value as an RDF list using the listRootKey as predicate
    let listPointer = parsingContext.listPointerStack[depth];

    if (value) {
      if (!listPointer || !listPointer.term) {
        const linkTerm: RDF.BlankNode = util.dataFactory.blankNode();
        const predicate = await util.predicateToTerm(await parsingContext.getContext(listRootKeys), listRootKey);
        parsingContext.getUnidentifiedValueBufferSafe(listRootDepth)
          .push({ predicate, object: linkTerm, reverse: false });
        listPointer = { term: linkTerm, initialPredicate: null, listRootDepth };
      } else {
        // rdf:rest links are always emitted before the next element,
        // as the blank node identifier is only created at that point.
        // Because of this reason, the final rdf:nil is emitted when the stack depth is decreased.
        const newLinkTerm: RDF.Term = util.dataFactory.blankNode();
        parsingContext.emitQuad(depth, util.dataFactory.triple(listPointer.term, util.rdfRest, newLinkTerm));

        // Update the list pointer for the next element
        listPointer.term = newLinkTerm;
      }

      // Emit a list element for the current value
      parsingContext.emitQuad(depth, util.dataFactory.triple(listPointer.term, util.rdfFirst, value));
    } else {
      // A falsy list element if found.
      // Just enable the list flag for this depth if it has not been set before.
      if (!listPointer) {
        const predicate = await util.predicateToTerm(await parsingContext.getContext(listRootKeys), listRootKey);
        listPointer = { term: null, initialPredicate: predicate, listRootDepth };
      }
    }

    parsingContext.listPointerStack[depth] = listPointer;
  }

}
