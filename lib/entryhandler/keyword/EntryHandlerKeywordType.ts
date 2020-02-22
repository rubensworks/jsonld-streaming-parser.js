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
  }

}
