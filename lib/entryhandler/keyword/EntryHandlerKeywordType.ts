import {ERROR_CODES, ErrorCoded, JsonLdContextNormalized} from "jsonld-context-parser";
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

  public isStackProcessor(): boolean {
    return false;
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    const keyOriginal = keys[depth];

    // The current identifier identifies an rdf:type predicate.
    // But we only emit it once the node closes,
    // as it's possible that the @type is used to identify the datatype of a literal, which we ignore here.
    const context = await parsingContext.getContext(keys);
    const predicate = util.rdfType;
    const parentKey = await util.unaliasKeywordParent(keys, depth);
    const reverse = Util.isPropertyReverse(context, keyOriginal, parentKey);
    const isEmbedded = Util.isPropertyInEmbeddedNode(parentKey);
    util.validateReverseInEmbeddedNode(key, reverse, isEmbedded);
    const isAnnotation = Util.isPropertyInAnnotationObject(parentKey);

    // Handle multiple values if the value is an array
    const elements = Array.isArray(value) ? value : [ value ];
    for (const element of elements) {
      if (typeof element !== 'string') {
        parsingContext.emitError(new ErrorCoded(`Found illegal @type '${element}'`, ERROR_CODES.INVALID_TYPE_VALUE));
      }
      const type = util.createVocabOrBaseTerm(context, element);
      if (type) {
        await EntryHandlerPredicate.handlePredicateObject(parsingContext, util, keys, depth,
          predicate, type, reverse, isEmbedded, isAnnotation);
      }
    }

    // Collect type-scoped contexts if they exist
    let scopedContext: Promise<JsonLdContextNormalized> = Promise.resolve(context);
    let hasTypedScopedContext = false;
    for (const element of elements.sort()) { // Spec requires lexicographical ordering
      const typeContext = Util.getContextValue(context, '@context', element, null);
      if (typeContext) {
        hasTypedScopedContext = true;
        scopedContext = scopedContext.then((c) => parsingContext.parseContext(typeContext, c.getContextRaw()));
      }
    }

    // Error if an out-of-order type-scoped context was found when support is not enabled.
    if (parsingContext.streamingProfile
      && (hasTypedScopedContext || !parsingContext.streamingProfileAllowOutOfOrderPlainType)
      && (parsingContext.processingStack[depth] || parsingContext.idStack[depth])) {
      parsingContext.emitError(
        new ErrorCoded('Found an out-of-order type-scoped context, while streaming is enabled.' +
          '(disable `streamingProfile`)', ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
    }

    // If at least least one type-scoped context applies, set them in the tree.
    if (hasTypedScopedContext) {
      // Do not propagate by default
      scopedContext = scopedContext.then((c) => {
        let rawContext = c.getContextRaw();

        // Set the original context at this depth as a fallback
        // This is needed when a context was already defined at the given depth,
        // and this context needs to remain accessible from child nodes when propagation is disabled.
        if (rawContext['@propagate'] !== true) {
          rawContext = { ...rawContext, '@propagate': false, '@__propagateFallback': context.getContextRaw() };
        }

        return new JsonLdContextNormalized(rawContext);
      });

      // Set the new context in the context tree
      parsingContext.contextTree.setContext(keys.slice(0, keys.length - 1), scopedContext);
    }

    // Flag that type has been processed at this depth
    parsingContext.processingType[depth] = true;
  }

}
