import {ERROR_CODES, ErrorCoded} from "jsonld-context-parser";
import * as RDF from "rdf-js";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IEntryHandler} from "./IEntryHandler";

/**
 * Interprets keys as predicates.
 * The most common case in JSON-LD processing.
 */
export class EntryHandlerPredicate implements IEntryHandler<boolean> {

  /**
   * Handle the given predicate-object by either emitting it,
   * or by placing it in the appropriate stack for later emission when no @graph and/or @id has been defined.
   * @param {ParsingContext} parsingContext A parsing context.
   * @param {Util} util A utility instance.
   * @param {any[]} keys A stack of keys.
   * @param {number} depth The current depth.
   * @param {Term} predicate The predicate.
   * @param {Term} object The object.
   * @param {boolean} reverse If the property is reversed.
   * @return {Promise<void>} A promise resolving when handling is done.
   */
  public static async handlePredicateObject(parsingContext: ParsingContext, util: Util, keys: any[], depth: number,
                                            predicate: RDF.Term, object: RDF.Term, reverse: boolean) {
    const depthProperties: number = await util.getPropertiesDepth(keys, depth);
    const depthOffsetGraph = await util.getDepthOffsetGraph(depth, keys);
    const depthPropertiesGraph: number = depth - depthOffsetGraph;

    const subjects = parsingContext.idStack[depthProperties];
    if (subjects) {
      // Emit directly if the @id was already defined
      for (const subject of subjects) {
        // Check if we're in a @graph context
        const atGraph = depthOffsetGraph >= 0;
        if (atGraph) {
          const graphs = parsingContext.idStack[depthPropertiesGraph - 1];
          if (graphs) {
            for (const graph of graphs) {
              // Emit our quad if graph @id is known
              if (reverse) {
                util.validateReverseSubject(object);
                parsingContext.emitQuad(depth, util.dataFactory.quad(object, predicate, subject, graph));
              } else {
                parsingContext.emitQuad(depth, util.dataFactory.quad(subject, predicate, object, graph));
              }
            }
          } else {
            // Buffer our triple if graph @id is not known yet.
            if (reverse) {
              util.validateReverseSubject(object);
              parsingContext.getUnidentifiedGraphBufferSafe(depthPropertiesGraph - 1).push(
                {subject: object, predicate, object: subject});
            } else {
              parsingContext.getUnidentifiedGraphBufferSafe(depthPropertiesGraph - 1)
                .push({subject, predicate, object});
            }
          }
        } else {
          // Emit if no @graph was applicable
          const graph = await util.getGraphContainerValue(keys, depthProperties);
          if (reverse) {
            util.validateReverseSubject(object);
            parsingContext.emitQuad(depth, util.dataFactory.quad(object, predicate, subject, graph));
          } else {
            parsingContext.emitQuad(depth, util.dataFactory.quad(subject, predicate, object, graph));
          }
        }
      }
    } else {
      // Buffer until our @id becomes known, or we go up the stack
      if (reverse) {
        util.validateReverseSubject(object);
      }
      parsingContext.getUnidentifiedValueBufferSafe(depthProperties).push({predicate, object, reverse});
    }
  }

  public isPropertyHandler(): boolean {
    return true;
  }

  public isStackProcessor(): boolean {
    return true;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    const key = keys[depth];
    if (key) {
      const context = await parsingContext.getContext(keys);
      if (await util.predicateToTerm(context, keys[depth])) {
        // If this valid predicate is of type @json, mark it so in the stack so that no deeper handling of nodes occurs.
        if (Util.getContextValueType(context, key) === '@json') {
          parsingContext.jsonLiteralStack[depth + 1] = true;
        }
        return true;
      }
    }
    return false;
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return keys[depth];
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number,
                      testResult: boolean): Promise<any> {
    const keyOriginal = keys[depth];
    const context = await parsingContext.getContext(keys);

    const predicate = await util.predicateToTerm(context, key);
    if (predicate) {
      const objects = await util.valueToTerm(context, key, value, depth, keys);
      if (objects.length) {
        for (let object of objects) {
          const reverse = Util.isPropertyReverse(context, keyOriginal, await util.unaliasKeywordParent(keys, depth));

          if (value) {
            // Special case if our term was defined as an @list, but does not occur in an array,
            // In that case we just emit it as an RDF list with a single element.
            const listValueContainer = '@list' in Util.getContextValueContainer(context, key);
            if (listValueContainer || value['@list']) {
              if (((listValueContainer && !Array.isArray(value) && !value['@list'])
                || (value['@list'] && !Array.isArray(value['@list'])))
                && object !== util.rdfNil) {
                const listPointer: RDF.Term = util.dataFactory.blankNode();
                parsingContext.emitQuad(depth, util.dataFactory.quad(listPointer, util.rdfRest, util.rdfNil,
                  util.getDefaultGraph()));
                parsingContext.emitQuad(depth, util.dataFactory.quad(listPointer, util.rdfFirst, object,
                  util.getDefaultGraph()));
                object = listPointer;
              }

              // Lists are not allowed in @reverse'd properties
              if (reverse && !parsingContext.allowSubjectList) {
                throw new ErrorCoded(`Found illegal list value in subject position at ${key}`,
                  ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE);
              }
            }
          }

          await EntryHandlerPredicate.handlePredicateObject(parsingContext, util, keys, depth,
            predicate, object, reverse);
        }
      } else {
        // An invalid value was encountered, so we ignore it higher in the stack.
        parsingContext.emittedStack[depth] = false;
      }
    }
  }

}
