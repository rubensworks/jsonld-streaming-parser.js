import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";

/**
 * Handles @graph entries.
 */
export class EntryHandlerKeywordGraph extends EntryHandlerKeyword {

  constructor() {
    super('@graph');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // The current identifier identifies a graph for the deeper level.
    parsingContext.graphStack[depth + 1] = true;
  }

}
