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

  public isStackProcessor(): boolean {
    return false;
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // Error if an out-of-order context was found when support is not enabled.
    if (!parsingContext.allowOutOfOrderContext && parsingContext.processingStack[depth]) {
      parsingContext.emitError(new Error('Found an out-of-order context, while support is not enabled.' +
        '(enable with `allowOutOfOrderContext`)'));
    }

    // Find the parent context to inherit from.
    // We actually request a context for the current depth (with fallback to parent)
    // because we want to take into account any property-scoped contexts that are defined for this depth.
    const parentContext: Promise<IJsonLdContextNormalized> = parsingContext.getContext(keys);

    // Set the context for this scope
    const context = parsingContext.parseContext(value, await parentContext);
    parsingContext.contextTree.setContext(keys.slice(0, -1), context);
    parsingContext.emitContext(value);
    await parsingContext.validateContext(await context);
  }

}
