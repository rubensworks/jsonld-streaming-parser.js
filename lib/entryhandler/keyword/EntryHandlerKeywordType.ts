import {IJsonLdContextNormalized} from "jsonld-context-parser/lib/JsonLdContext";
import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerPredicate} from "../EntryHandlerPredicate";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @graph entries.
 */
export class EntryHandlerKeywordType extends EntryHandlerKeyword {

  constructor() {
    super('@type');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    const keyOriginal = keys[depth];

    // The current identifier identifies an rdf:type predicate.
    // But we only emit it once the node closes,
    // as it's possible that the @type is used to identify the datatype of a literal, which we ignore here.
    const context = await parsingContext.getContext(keys);
    const predicate = util.rdfType;
    const reverse = Util.isPropertyReverse(context, keyOriginal, await util.unaliasKeywordParent(keys, depth));

    // Handle multiple values if the value is an array
    const elements = Array.isArray(value) ? value : [ value ];
    for (const element of elements) {
      const type = util.createVocabOrBaseTerm(context, element);
      if (type) {
        await EntryHandlerPredicate.handlePredicateObject(parsingContext, util, keys, depth,
          predicate, type, reverse);
      }
    }

    // Collect type-scoped contexts if they exist
    let scopedContext: Promise<IJsonLdContextNormalized> = Promise.resolve(context);
    let hasTypedScopedContext = false;
    for (const element of elements.sort()) { // Spec requires lexicographical ordering
      const typeContext = Util.getContextValue(context, '@context', element, null);
      if (typeContext) {
        hasTypedScopedContext = true;
        scopedContext = scopedContext.then((c) => parsingContext.parseContext(typeContext, c));
      }
    }
    // If at least least one type-scoped context applies, set them in the tree.
    if (hasTypedScopedContext) {
      // Error if an out-of-order type-scoped context was found when support is not enabled.
      if (!parsingContext.allowOutOfOrderContext && parsingContext.processingStack[depth]) {
        parsingContext.emitError(new Error('Found an out-of-order type-scoped context, while support is not enabled.' +
          '(enable with `allowOutOfOrderContext`)'));
      }

      // Do not propagate by default
      scopedContext = scopedContext.then((c) => {
        if (!('@propagate' in c)) {
          c['@propagate'] = false;
        }

        // Set the original context at this depth as a fallback
        // This is needed when a context was already defined at the given depth,
        // and this context needs to remain accessible from child nodes when propagation is disabled.
        if (c['@propagate'] === false) {
          c['@__propagateFallback'] = context;
        }

        return c;
      });

      // Set the new context in the context tree
      parsingContext.contextTree.setContext(keys.slice(0, keys.length - 1), scopedContext);
    }
  }

}
