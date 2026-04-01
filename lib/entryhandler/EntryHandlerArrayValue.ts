import type * as RDF from '@rdfjs/types';
import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';
import type { ParsingContext } from '../ParsingContext';
import { Util } from '../Util';
import type { IEntryHandler } from './IEntryHandler';

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

  public async validate(
    parsingContext: ParsingContext,
    util: Util,
    keys: any[],
    depth: number,
    _inProperty: boolean,
  ): Promise<boolean> {
    return this.test(parsingContext, util, null, keys, depth);
  }

  public async test(
    _parsingContext: ParsingContext,
    _util: Util,
    _key: any,
    keys: any[],
    depth: number,
  ): Promise<boolean> {
    return typeof keys[depth] === 'number';
  }

  public async handle(
    parsingContext: ParsingContext,
    util: Util,
    _key: any,
    keys: any[],
    value: any,
    depth: number,
  ): Promise<any> {
    // eslint-disable-next-line ts/no-unsafe-assignment
    let parentKey = await util.unaliasKeywordParent(keys, depth);

    // Check if we have an anonymous list
    if (parentKey === '@list') {
      // Our value is part of an array

      // Determine the list root key
      let listRootKey: string | number | null = null;
      let listRootDepth = 0;
      for (let i = depth - 2; i > 0; i--) {
        // eslint-disable-next-line ts/no-unsafe-assignment
        const keyOption = keys[i];
        if (typeof keyOption === 'string' || typeof keyOption === 'number') {
          listRootDepth = i;
          listRootKey = keyOption;
          break;
        }
      }

      if (listRootKey !== null) {
        // Emit the given objects as list elements

        const listContext = await parsingContext.getContext(keys);
        const values = await util.valueToTerm(listContext, <string> listRootKey, value, depth, <string[]>keys);
        for (const object of values) {
          await this.handleListElement(
            parsingContext,
            util,
            object,
            value,
            depth,
<string[]>keys.slice(0, listRootDepth),
listRootDepth,
          );
        }

        // If no values were found, emit a falsy list element to force an empty RDF list to be emitted.
        if (values.length === 0) {
          await this.handleListElement(
            parsingContext,
            util,
            null,
            value,
            depth,
<string[]>keys.slice(0, listRootDepth),
listRootDepth,
          );
        }
      }
    } else if (parentKey === '@set') {
      // Our value is part of a set, so we just add it to the parent-parent
      await parsingContext.newOnValueJob(keys.slice(0, -2), value, depth - 2, false);
    } else if (parentKey !== undefined && parentKey !== '@type') {
      // Buffer our value using the parent key as predicate

      // Determine the first parent key that is *not* an array key
      // This is needed in case we have an @list container with nested arrays,
      // where each of them should produce nested RDF lists.
      for (let i = depth - 1; i > 0; i--) {
        if (typeof keys[i] !== 'number') {
          // eslint-disable-next-line ts/no-unsafe-assignment
          parentKey = await util.unaliasKeyword(<string>keys[i], <string[]>keys, i);
          break;
        }
      }

      // Check if the predicate is marked as an @list in the context
      const parentContext = await parsingContext.getContext(keys.slice(0, -1));
      // eslint-disable-next-line ts/no-unsafe-argument
      if ('@list' in Util.getContextValueContainer(parentContext, parentKey)) {
        // Our value is part of an array
        // Emit the given objects as list elements
        // Ensure the creation of bnodes for empty nodes
        parsingContext.emittedStack[depth + 1] = true;

        const values = await util.valueToTerm(
          await parsingContext.getContext(keys),
          <string>parentKey,
          value,
          depth,
          <string[]>keys,
        );

        for (const object of values) {
          await this.handleListElement(
            parsingContext,
            util,
            object,
            value,
            depth,
<string[]>keys.slice(0, -1),
depth - 1,
          );
        }

        // If no values were found, emit a falsy list element to force an empty RDF list to be emitted.
        if (values.length === 0) {
          await this.handleListElement(
            parsingContext,
            util,
            null,
            value,
            depth,
<string[]>keys.slice(0, -1),
depth - 1,
          );
        }
      } else {
        // Copy the stack values up one level so that the next job can access them.
        parsingContext.shiftStack(depth, 1);

        // Execute the job one level higher
        await parsingContext.newOnValueJob(keys.slice(0, -1), value, depth - 1, false);

        // Remove any defined contexts at this level to avoid it to propagate to the next array element.
        parsingContext.contextTree.removeContext(<string[]>keys.slice(0, -1));
      }
    }
  }

  protected async handleListElement(
    parsingContext: ParsingContext,
    util: Util,
    value: RDF.Term | null,
    valueOriginal: any,
    depth: number,
    listRootKeys: string[],
    listRootDepth: number,
  ): Promise<void> {
    // Buffer our value as an RDF list using the listRootKey as predicate
    let listPointer = parsingContext.listPointerStack[depth];

    // eslint-disable-next-line ts/no-unsafe-argument
    const unaliasedValue = await util.unaliasKeywords(valueOriginal, listRootKeys, depth);
    if (valueOriginal !== null && (<any>unaliasedValue)['@value'] !== null) {
      if (!listPointer || !listPointer.value) {
        const linkTerm: RDF.BlankNode = util.dataFactory.blankNode();
        listPointer = { value: linkTerm, listRootDepth, listId: linkTerm };
      } else {
        // Rdf:rest links are always emitted before the next element,
        // as the blank node identifier is only created at that point.
        // Because of this reason, the final rdf:nil is emitted when the stack depth is decreased.
        const newLinkTerm: RDF.Term = util.dataFactory.blankNode();
        parsingContext.emitQuad(
          depth,
          util.dataFactory.quad(listPointer.value, util.rdfRest, newLinkTerm, util.getDefaultGraph()),
        );

        // Update the list pointer for the next element
        listPointer.value = newLinkTerm;
      }

      // Emit a list element for the current value
      // Omit rdf:first if the value is invalid
      if (value) {
        parsingContext.emitQuad(
          depth,
          util.dataFactory.quad(<RDF.Term>listPointer.value, util.rdfFirst, value, util.getDefaultGraph()),
        );
      }
    } else if (!listPointer) {
      // A falsy list element if found.
      // Mark it as an rdf:nil list until another valid list element comes in
      listPointer = { listRootDepth, listId: util.rdfNil };
    }

    parsingContext.listPointerStack[depth] = listPointer;

    // Error if an annotation was defined
    if (parsingContext.rdfstar && parsingContext.annotationsBuffer[depth]) {
      parsingContext.emitError(new ErrorCoded(`Found an illegal annotation inside a list`, ERROR_CODES.INVALID_ANNOTATION));
    }
  }
}
