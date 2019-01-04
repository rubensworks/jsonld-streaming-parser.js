import {IJsonLdContextNormalized} from "jsonld-context-parser";
import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @context entries.
 */
export class EntryHandlerKeywordContext extends EntryHandlerKeyword {

  constructor() {
    super('@context');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // Error if an out-of-order context was found when support is not enabled.
    if (!parsingContext.allowOutOfOrderContext && parsingContext.processingStack[depth]) {
      parsingContext.emitError(new Error('Found an out-of-order context, while support is not enabled.' +
        '(enable with `allowOutOfOrderContext`)'));
    }

    // Find the parent context to inherit from
    const parentContext: Promise<IJsonLdContextNormalized> = parsingContext.getContext(depth - 1);

    // Set the context for this scope
    parsingContext.contextStack[depth] = parsingContext.contextParser.parse(
      value, parsingContext.baseIRI, await parentContext);
    await parsingContext.validateContext(await parsingContext.contextStack[depth]);
  }

}
