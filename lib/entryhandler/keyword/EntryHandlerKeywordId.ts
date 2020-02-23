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

  public isStackProcessor(): boolean {
    return false;
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // Determine the canonical place for this id.
    // For example, @nest parents should be ignored.
    const depthProperties: number = await util.getPropertiesDepth(keys, depth);

    // Error if an @id for this node already existed.
    if (parsingContext.idStack[depthProperties] !== undefined) {
      parsingContext.emitError(new Error(`Found duplicate @ids '${parsingContext
        .idStack[depthProperties][0].value}' and '${value}'`));
    }

    // Save our @id on the stack
    parsingContext.idStack[depthProperties] = util.nullableTermToArray(await util.resourceToTerm(
      await parsingContext.getContext(keys), value));
  }

}
