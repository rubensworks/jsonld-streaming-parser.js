import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {EntryHandlerKeyword} from "./EntryHandlerKeyword";
import { ERROR_CODES, ErrorCoded } from 'jsonld-context-parser';

/**
 * Handles @annotation entries.
 */
export class EntryHandlerKeywordAnnotation extends EntryHandlerKeyword {

  constructor() {
    super('@annotation');
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number)
    : Promise<any> {
    // Validate value
    if (typeof value === 'string' || (typeof value === 'object' && value['@value'])) {
      parsingContext.emitError(new ErrorCoded(`Found illegal annotation value: ${JSON.stringify(value)}`,
        ERROR_CODES.INVALID_ANNOTATION));
    }

    // Rest of the processing is done as regular nodes
  }

}
