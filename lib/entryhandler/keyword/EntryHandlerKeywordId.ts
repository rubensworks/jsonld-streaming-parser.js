import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @id entries.
 */
export class EntryHandlerKeywordId extends EntryHandlerKeyword {

  constructor() {
    super('@id');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // Error if an @id for this node already existed.
    if (parsingContext.idStack[depth]) {
      parsingContext.emitError(new Error(`Found duplicate @ids '${parsingContext
        .idStack[depth].value}' and '${value}'`));
    }

    // Save our @id on the stack
    parsingContext.idStack[depth] = await util.resourceToTerm(await parsingContext.getContext(depth), value);
  }

}
