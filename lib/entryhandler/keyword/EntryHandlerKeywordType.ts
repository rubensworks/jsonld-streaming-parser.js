import { ERROR_CODES, ErrorCoded, JsonLdContextNormalized } from 'jsonld-context-parser';
import type { ParsingContext } from '../../ParsingContext';
import { Util } from '../../Util';
import { EntryHandlerPredicate } from '../EntryHandlerPredicate';
import { EntryHandlerKeyword } from './EntryHandlerKeyword';

/**
 * Handles @graph entries.
 */
export class EntryHandlerKeywordType extends EntryHandlerKeyword {
  public constructor() {
    super('@type');
  }

  public isStackProcessor(): boolean {
    return false;
  }

  public async handle(
    parsingContext: ParsingContext,
    util: Util,
    key: any,
    keys: any[],
    value: any,
    depth: number,
  ): Promise<any> {
    // eslint-disable-next-line ts/no-unsafe-assignment
    const keyOriginal = keys[depth];

    // The current identifier identifies an rdf:type predicate.
    // But we only emit it once the node closes,
    // as it's possible that the @type is used to identify the datatype of a literal, which we ignore here.
    const context = await parsingContext.getContext(keys);
    const predicate = util.rdfType;
    // eslint-disable-next-line ts/no-unsafe-assignment
    const parentKey = await util.unaliasKeywordParent(keys, depth);
    // eslint-disable-next-line ts/no-unsafe-argument
    const reverse = Util.isPropertyReverse(context, keyOriginal, parentKey);
    // eslint-disable-next-line ts/no-unsafe-argument
    const isEmbedded = Util.isPropertyInEmbeddedNode(parentKey);
    // eslint-disable-next-line ts/no-unsafe-argument
    util.validateReverseInEmbeddedNode(key, reverse, isEmbedded);
    // eslint-disable-next-line ts/no-unsafe-argument
    const isAnnotation = Util.isPropertyInAnnotationObject(parentKey);

    // Handle multiple values if the value is an array
    const elements = Array.isArray(value) ? value : [ value ];
    for (const element of elements) {
      if (typeof element !== 'string') {
        parsingContext.emitError(new ErrorCoded(`Found illegal @type '${element}'`, ERROR_CODES.INVALID_TYPE_VALUE));
      }

      const type = util.createVocabOrBaseTerm(context, <string>element);
      if (type) {
        await EntryHandlerPredicate.handlePredicateObject(
          parsingContext,
          util,
          <string[]>keys,
          depth,
          predicate,
          type,
          reverse,
          isEmbedded,
          isAnnotation,
        );
      }
    }

    // Collect type-scoped contexts if they exist
    let scopedContext: Promise<JsonLdContextNormalized> = Promise.resolve(context);
    let hasTypedScopedContext = false;
    // Spec requires lexicographical ordering
    for (const element of elements.sort((a, b) => String(a).localeCompare(String(b)))) {
      // eslint-disable-next-line ts/no-unsafe-assignment
      const typeContext = Util.getContextValue(context, '@context', <string>element, null);
      if (typeContext) {
        hasTypedScopedContext = true;
        // eslint-disable-next-line ts/no-unsafe-argument
        scopedContext = scopedContext.then(c => parsingContext.parseContext(typeContext, c.getContextRaw()));
      }
    }

    // Error if an out-of-order type-scoped context was found when support is not enabled.
    if (parsingContext.streamingProfile &&
      (hasTypedScopedContext || !parsingContext.streamingProfileAllowOutOfOrderPlainType) &&
      (parsingContext.processingStack[depth] || parsingContext.idStack[depth])) {
      parsingContext.emitError(
        new ErrorCoded('Found an out-of-order type-scoped context, while streaming is enabled.' +
          '(disable `streamingProfile`)', ERROR_CODES.INVALID_STREAMING_KEY_ORDER),
      );
    }

    // If at least least one type-scoped context applies, set them in the tree.
    if (hasTypedScopedContext) {
      // Do not propagate by default
      scopedContext = scopedContext.then((c) => {
        // Set the original context at this depth as a fallback
        // This is needed when a context was already defined at the given depth,
        // and this context needs to remain accessible from child nodes when propagation is disabled.
        if (c.getContextRaw()['@propagate'] !== true) {
          return new JsonLdContextNormalized({
            ...c.getContextRaw(),
            '@propagate': false,
            '@__propagateFallback': context.getContextRaw(),
          });
        }

        return c;
      });

      // Set the new context in the context tree
      parsingContext.contextTree.setContext(<string[]>keys.slice(0, -1), scopedContext);
    }

    // Flag that type has been processed at this depth
    parsingContext.processingType[depth] = true;
  }
}
