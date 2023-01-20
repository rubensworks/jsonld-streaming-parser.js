import {ERROR_CODES, ErrorCoded} from "jsonld-context-parser";
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
    if (typeof value !== 'string') {
      // JSON-LD-star allows @id object values
      if (parsingContext.rdfstar && typeof value === 'object') {
        const valueKeys = Object.keys(value);
        if (valueKeys.length === 1 && valueKeys[0] === '@id') {
          parsingContext.emitError(new ErrorCoded(`Invalid embedded node without property with @id ${value['@id']}`,
            ERROR_CODES.INVALID_EMBEDDED_NODE));
        }
      } else {
        parsingContext.emitError(new ErrorCoded(`Found illegal @id '${value}'`, ERROR_CODES.INVALID_ID_VALUE));
      }
      return;
    }

    // Determine the canonical place for this id.
    // For example, @nest parents should be ignored.
    const depthProperties: number = await util.getPropertiesDepth(keys, depth);

    // Error if an @id for this node already existed.
    if (parsingContext.idStack[depthProperties] !== undefined) {
      if ((<any> parsingContext.idStack[depthProperties][0]).listHead) {
        // Error if an @list was already defined for this node
        parsingContext.emitError(new ErrorCoded(
          `Found illegal neighbouring entries next to @list for key: '${keys[depth - 1]}'`,
          ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
      } else {
        // Otherwise, the previous id was just because of an @id entry.
        parsingContext.emitError(new ErrorCoded(`Found duplicate @ids '${parsingContext
          .idStack[depthProperties][0].value}' and '${value}'`, ERROR_CODES.COLLIDING_KEYWORDS));
      }
    }

    // Error if an annotation was defined
    if (parsingContext.rdfstar && parsingContext.annotationsBuffer[depth]) {
      for (const annotation of parsingContext.annotationsBuffer[depth]) {
        if (annotation.depth === depth) {
          parsingContext.emitError(new ErrorCoded(`Found an illegal @id inside an annotation: ${value}`,
            ERROR_CODES.INVALID_ANNOTATION));
        }
      }
    }

    // Save our @id on the stack
    parsingContext.idStack[depthProperties] = util.nullableTermToArray(await util.resourceToTerm(
      await parsingContext.getContext(keys), value));
  }

}
