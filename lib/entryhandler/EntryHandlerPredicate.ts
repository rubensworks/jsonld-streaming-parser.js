import * as RDF from "rdf-js";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IEntryHandler} from "./IEntryHandler";

/**
 * Interprets keys as predicates.
 * The most common case in JSON-LD processing.
 */
export class EntryHandlerPredicate implements IEntryHandler<boolean> {

  public isPropertyHandler(): boolean {
    return true;
  }

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    return keys[depth] && !!await util.predicateToTerm(await parsingContext.getContext(keys), keys[depth]);
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return keys[depth];
  }

  public async handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number,
                      testResult: boolean): Promise<any> {
    const keyOriginal = keys[depth];
    const parentKey = await util.unaliasKeywordParent(keys, depth);
    const context = await parsingContext.getContext(keys);

    const predicate = await util.predicateToTerm(context, key);
    if (predicate) {
      const objectContext = await parsingContext.getContext(keys, 0);
      let object = await util.valueToTerm(objectContext, key, value, depth, keys);
      if (object) {
        const reverse = Util.isPropertyReverse(context, keyOriginal, parentKey);
        // Special case if our term was defined as an @list, but does not occur in an array,
        // In that case we just emit it as an RDF list with a single element.
        const listValueContainer = Util.getContextValueContainer(context, key) === '@list';
        if (listValueContainer || value['@list']) {
          if ((listValueContainer || (value['@list'] && !Array.isArray(value['@list']))) && object !== util.rdfNil) {
            const listPointer: RDF.Term = util.dataFactory.blankNode();
            parsingContext.emitQuad(depth, util.dataFactory.triple(listPointer, util.rdfRest, util.rdfNil));
            parsingContext.emitQuad(depth, util.dataFactory.triple(listPointer, util.rdfFirst, object));
            object = listPointer;
          }

          // Lists are not allowed in @reverse'd properties
          if (reverse && !parsingContext.allowSubjectList) {
            throw new Error(`Found illegal list value in subject position at ${key}`);
          }
        }

        const depthProperties: number = depth - (parentKey === '@reverse' ? 1 : 0);
        const depthOffsetGraph = await util.getDepthOffsetGraph(depth, keys);
        const depthPropertiesGraph: number = depth - depthOffsetGraph;

        if (parsingContext.idStack[depthProperties]) {
          // Emit directly if the @id was already defined
          const subject = parsingContext.idStack[depthProperties];

          // Check if we're in a @graph context
          const atGraph = depthOffsetGraph >= 0;
          if (atGraph) {
            const graph: RDF.Term = parsingContext.idStack[depthPropertiesGraph - 1];
            if (graph) {
              // Emit our quad if graph @id is known
              if (reverse) {
                util.validateReverseSubject(object);
                parsingContext.emitQuad(depth, util.dataFactory.quad(object, predicate, subject, graph));
              } else {
                parsingContext.emitQuad(depth, util.dataFactory.quad(subject, predicate, object, graph));
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
            if (reverse) {
              util.validateReverseSubject(object);
              parsingContext.emitQuad(depth, util.dataFactory.triple(object, predicate, subject));
            } else {
              parsingContext.emitQuad(depth, util.dataFactory.triple(subject, predicate, object));
            }
          }
        } else {
          // Buffer until our @id becomes known, or we go up the stack
          if (reverse) {
            util.validateReverseSubject(object);
          }
          parsingContext.getUnidentifiedValueBufferSafe(depthProperties).push({predicate, object, reverse});
        }
      } else {
        // An invalid value was encountered, so we ignore it higher in the stack.
        parsingContext.emittedStack[depth] = false;
      }
    }
  }

}
