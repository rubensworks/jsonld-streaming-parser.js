import {ERROR_CODES, ErrorCoded, Util as ContextUtil} from "jsonld-context-parser";
import {EntryHandlerPredicate} from "../entryhandler/EntryHandlerPredicate";
import {ParsingContext} from "../ParsingContext";
import {Util} from "../Util";
import {IContainerHandler} from "./IContainerHandler";

/**
 * Container handler for @index.
 *
 * This will ignore the current key and add this entry to the parent node.
 */
export class ContainerHandlerIndex implements IContainerHandler {

  public canCombineWithGraph(): boolean {
    return true;
  }

  public async handle(containers: { [typeName: string]: boolean }, parsingContext: ParsingContext, util: Util,
                      keys: string[], value: any, depth: number)
    : Promise<void> {
    if (!Array.isArray(value)) {
      const graphContainer = '@graph' in containers;

      // Check if the container is a property-based container by checking if there is a valid @index.
      const context = await parsingContext.getContext(keys);
      const indexKey = keys[depth - 1];
      const indexPropertyRaw = Util.getContextValueIndex(context, indexKey);
      if (indexPropertyRaw) {
        // Validate the @index value
        if (ContextUtil.isPotentialKeyword(indexPropertyRaw)) {
          throw new ErrorCoded(`Keywords can not be used as @index value, got: ${indexPropertyRaw}`,
            ERROR_CODES.INVALID_TERM_DEFINITION);
        }
        if (typeof indexPropertyRaw !== 'string') {
          throw new ErrorCoded(`@index values must be strings, got: ${indexPropertyRaw}`,
            ERROR_CODES.INVALID_TERM_DEFINITION);
        }

        // When @index is used, values must be node values, unless @type: @id is defined in the context
        if (typeof value !== 'object') {
          // Error if we don't have @type: @id
          if (Util.getContextValueType(context, indexKey) !== '@id') {
            throw new ErrorCoded(
              `Property-based index containers require nodes as values or strings with @type: @id, but got: ${value}`,
              ERROR_CODES.INVALID_VALUE_OBJECT);
          }

          // Add an @id to the stack, so our expanded @index value can make use of it
          const id = util.resourceToTerm(context, value);
          if (id) {
            parsingContext.idStack[depth + 1] = [id];
          }
        }

        // Expand the @index value
        const indexProperty = util.createVocabOrBaseTerm(context, indexPropertyRaw);
        if (indexProperty) {
          const indexValues = await util.valueToTerm(context, indexPropertyRaw,
            await util.getContainerKey(keys[depth], keys, depth), depth, keys);

          if (graphContainer) {
            // When we're in a graph container, attach the index to the graph identifier
            const graphId = await util.getGraphContainerValue(keys, depth + 1);
            for (const indexValue of indexValues) {
              parsingContext.emitQuad(depth, util.dataFactory.quad(graphId, indexProperty, indexValue,
                util.getDefaultGraph()));
            }
          } else {
            // Otherwise, attach the index to the node identifier
            for (const indexValue of indexValues) {
              await EntryHandlerPredicate.handlePredicateObject(parsingContext, util, keys, depth + 1,
                indexProperty, indexValue, false, false, false);
            }
          }
        }
      }

      const depthOffset = graphContainer ? 2 : 1;
      await parsingContext.newOnValueJob(keys.slice(0, keys.length - depthOffset), value, depth - depthOffset, true);

      // Flush any pending flush buffers
      await parsingContext.handlePendingContainerFlushBuffers();
    }

    parsingContext.emittedStack[depth] = false; // We have emitted a level higher
  }

}
