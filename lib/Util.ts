import {ContextParser, ERROR_CODES, ErrorCoded, JsonLdContextNormalized,
  Util as ContextUtil} from "jsonld-context-parser";
import * as RDF from "rdf-js";
import {EntryHandlerContainer} from "./entryhandler/EntryHandlerContainer";
import {ParsingContext} from "./ParsingContext";

// tslint:disable-next-line:no-var-requires
const canonicalizeJson = require('canonicalize');

/**
 * Utility functions and methods.
 */
export class Util {

  public static readonly XSD: string = 'http://www.w3.org/2001/XMLSchema#';
  public static readonly XSD_BOOLEAN: string = Util.XSD + 'boolean';
  public static readonly XSD_INTEGER: string = Util.XSD + 'integer';
  public static readonly XSD_DOUBLE: string = Util.XSD + 'double';
  public static readonly RDF: string = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

  public readonly dataFactory: RDF.DataFactory;
  public readonly rdfFirst: RDF.NamedNode;
  public readonly rdfRest: RDF.NamedNode;
  public readonly rdfNil: RDF.NamedNode;
  public readonly rdfType: RDF.NamedNode;
  public readonly rdfJson: RDF.NamedNode;

  private readonly parsingContext: ParsingContext;

  constructor(options: { parsingContext: ParsingContext, dataFactory?: RDF.DataFactory }) {
    this.parsingContext = options.parsingContext;
    this.dataFactory = options.dataFactory || require('@rdfjs/data-model');

    this.rdfFirst = this.dataFactory.namedNode(Util.RDF + 'first');
    this.rdfRest = this.dataFactory.namedNode(Util.RDF + 'rest');
    this.rdfNil = this.dataFactory.namedNode(Util.RDF + 'nil');
    this.rdfType = this.dataFactory.namedNode(Util.RDF + 'type');
    this.rdfJson = this.dataFactory.namedNode(Util.RDF + 'JSON');
  }

  /**
   * Helper function to get the value of a context entry,
   * or fallback to a certain value.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} contextKey A pre-defined JSON-LD key in context entries.
   * @param {string} key A context entry key.
   * @param {string} fallback A fallback value for when the given contextKey
   *                          could not be found in the value with the given key.
   * @return {string} The value of the given contextKey in the entry behind key in the given context,
   *                  or the given fallback value.
   */
  public static getContextValue<FB>(context: JsonLdContextNormalized, contextKey: string,
                                    key: string, fallback: FB): string | any | FB {
    const entry = context.getContextRaw()[key];
    if (!entry) {
      return fallback;
    }
    const type = entry[contextKey];
    return type === undefined ? fallback : type;
  }

  /**
   * Get the container type of the given key in the context.
   *
   * Should any context-scoping bugs should occur related to this in the future,
   * it may be required to increase the offset from the depth at which the context is retrieved by one (to 2).
   * This is because containers act 2 levels deep.
   *
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The container type.
   */
  public static getContextValueContainer(context: JsonLdContextNormalized, key: string):
    { [typeName: string]: boolean } {
    return Util.getContextValue(context, '@container', key, { '@set': true });
  }

  /**
   * Get the value type of the given key in the context.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueType(context: JsonLdContextNormalized, key: string): string | null {
    const valueType = Util.getContextValue(context, '@type', key, null);
    if (valueType === '@none') {
      return null;
    }
    return valueType;
  }

  /**
   * Get the language of the given key in the context.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueLanguage(context: JsonLdContextNormalized, key: string): string | null {
    return Util.getContextValue(context, '@language', key, context.getContextRaw()['@language'] || null);
  }

  /**
   * Get the direction of the given key in the context.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueDirection(context: JsonLdContextNormalized, key: string): string {
    return Util.getContextValue(context, '@direction', key, context.getContextRaw()['@direction'] || null);
  }

  /**
   * Check if the given key in the context is a reversed property.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {boolean} If the context value has a @reverse key.
   */
  public static isContextValueReverse(context: JsonLdContextNormalized, key: string): boolean {
    return !!Util.getContextValue(context, '@reverse', key, null);
  }

  /**
   * Get the @index of the given key in the context.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The index.
   */
  public static getContextValueIndex(context: JsonLdContextNormalized, key: string): any | null {
    return Util.getContextValue(context, '@index', key, context.getContextRaw()['@index'] || null);
  }

  /**
   * Check if the given key refers to a reversed property.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The property key.
   * @param {string} parentKey The parent key.
   * @return {boolean} If the property must be reversed.
   */
  public static isPropertyReverse(context: JsonLdContextNormalized, key: string, parentKey: string): boolean {
    // '!==' is needed because reversed properties in a @reverse container should cancel each other out.
    return parentKey === '@reverse' !== Util.isContextValueReverse(context, key);
  }

  /**
   * Check if the given IRI is valid.
   * @param {string} iri A potential IRI.
   * @return {boolean} If the given IRI is valid.
   */
  public static isValidIri(iri: string | null): boolean {
    return iri !== null && ContextUtil.isValidIri(iri);
  }

  /**
   * Check if the given first array (needle) is a prefix of the given second array (haystack).
   * @param needle An array to check if it is a prefix.
   * @param haystack An array to look in.
   */
  public static isPrefixArray(needle: string[], haystack: string[]): boolean {
    if (needle.length > haystack.length) {
      return false;
    }
    for (let i = 0; i < needle.length; i++) {
      if (needle[i] !== haystack[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Make sure that @id-@index pairs are equal over all array values.
   * Reject otherwise.
   * @param {any[]} value An array value.
   * @return {Promise<void>} A promise rejecting if conflicts are present.
   */
  public async validateValueIndexes(value: any[]): Promise<void> {
    if (this.parsingContext.validateValueIndexes) {
      const indexHashes: {[id: string]: any} = {};
      for (const entry of value) {
        if (entry && typeof entry === 'object') {
          const id = entry['@id'];
          const index = entry['@index'];
          if (id && index) {
            const existingIndexValue = indexHashes[id];
            if (existingIndexValue && existingIndexValue !== index) {
              throw new Error(`Conflicting @index value for ${id}`);
            }
            indexHashes[id] = index;
          }
        }
      }
    }
  }

  /**
   * Convert a given JSON value to an RDF term.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param value A JSON value.
   * @param {number} depth The depth the value is at.
   * @param {string[]} keys The path of keys.
   * @return {Promise<RDF.Term[]>} An RDF term array.
   */
  public async valueToTerm(context: JsonLdContextNormalized, key: string,
                           value: any, depth: number, keys: string[]): Promise<RDF.Term[]> {
    // Skip further processing if we have an @type: @json
    if (Util.getContextValueType(context, key) === '@json') {
      return [ this.dataFactory.literal(this.valueToJsonString(value), this.rdfJson) ];
    }

    const type: string = typeof value;
    switch (type) {
    case 'object':
      // Skip if we have a null or undefined object
      if (value === null || value === undefined) {
        return [];
      }

      // Special case for arrays
      if (Array.isArray(value)) {
        // We handle arrays at value level so we can emit earlier, so this is handled already when we get here.
        // Empty context-based lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if ('@list' in Util.getContextValueContainer(context, key)) {
          if (value.length === 0) {
            return [ this.rdfNil ];
          } else {
            return this.parsingContext.idStack[depth + 1] || [];
          }
        }
        await this.validateValueIndexes(value);
        return [];
      }

      // Handle property-scoped contexts
      context = await this.getContextSelfOrPropertyScoped(context, key);

      // Handle local context in the value
      if ('@context' in value) {
        context = await this.parsingContext.parseContext(value['@context'],
          (await this.parsingContext.getContext(keys, 0)).getContextRaw());
      }

      // In all other cases, we have a hash
      value = await this.unaliasKeywords(value, keys, depth, context); // Un-alias potential keywords in this hash
      if ('@value' in value) {
        let val;
        let valueLanguage;
        let valueDirection;
        let valueType;
        let valueIndex; // We don't use the index, but we need to check its type for spec-compliance
        for (key in value) {
          const subValue = value[key];
          switch (key) {
          case '@value':
            val = subValue;
            break;
          case '@language':
            valueLanguage = subValue;
            break;
          case '@direction':
            valueDirection = subValue;
            break;
          case '@type':
            valueType = subValue;
            break;
          case '@index':
            valueIndex = subValue;
            break;
          default:
            throw new Error(`Unknown value entry '${key}' in @value: ${JSON.stringify(value)}`);
          }
        }

        // Skip further processing if we have an @type: @json
        if (await this.unaliasKeyword(valueType, keys, depth, true, context) === '@json') {
          return [ this.dataFactory.literal(this.valueToJsonString(val), this.rdfJson) ];
        }

        // Validate @value
        if (val === null) {
          return [];
        }
        if (typeof val === 'object') {
          throw new ErrorCoded(`The value of an '@value' can not be an object, got '${JSON.stringify(val)}'`,
            ERROR_CODES.INVALID_VALUE_OBJECT_VALUE);
        }

        // Validate @index
        if (this.parsingContext.validateValueIndexes && valueIndex && typeof valueIndex !== 'string') {
          throw new ErrorCoded(`The value of an '@index' must be a string, got '${JSON.stringify(valueIndex)}'`,
            ERROR_CODES.INVALID_INDEX_VALUE);
        }

        // Validate @language and @direction
        if (valueLanguage) {
          if (typeof val !== 'string') {
            throw new ErrorCoded(
              `When an '@language' is set, the value of '@value' must be a string, got '${JSON.stringify(val)}'`,
              ERROR_CODES.INVALID_LANGUAGE_MAP_VALUE);
          }

          if (!ContextParser.validateLanguage(valueLanguage, this.parsingContext.strictValues,
            ERROR_CODES.INVALID_LANGUAGE_TAGGED_STRING)) {
            return [];
          }

          // Language tags are always normalized to lowercase in 1.0.
          if (this.parsingContext.normalizeLanguageTags || this.parsingContext.activeProcessingMode === 1.0) {
            valueLanguage = valueLanguage.toLowerCase();
          }
        }
        if (valueDirection) {
          if (typeof val !== 'string') {
            throw new Error(
              `When an '@direction' is set, the value of '@value' must be a string, got '${JSON.stringify(val)}'`);
          }

          if (!ContextParser.validateDirection(valueDirection, this.parsingContext.strictValues)) {
            return [];
          }
        }

        // Check @language and @direction
        if (valueLanguage && valueDirection && this.parsingContext.rdfDirection) {
          if (valueType) {
            throw new Error(`Can not have '@language', '@direction' and '@type' in a value: '
            ${JSON.stringify(value)}'`);
          }

          return this.nullableTermToArray(this
            .createLanguageDirectionLiteral(depth, val, valueLanguage, valueDirection));
        } else if (valueLanguage) { // Check @language
          if (valueType) {
            throw new Error(`Can not have both '@language' and '@type' in a value: '${JSON.stringify(value)}'`);
          }

          return [ this.dataFactory.literal(val, valueLanguage) ];
        } else if (valueDirection && this.parsingContext.rdfDirection) { // Check @direction
          if (valueType) {
            throw new Error(`Can not have both '@direction' and '@type' in a value: '${JSON.stringify(value)}'`);
          }

          return this.nullableTermToArray(this
            .createLanguageDirectionLiteral(depth, val, valueLanguage, valueDirection));
        } else if (valueType) { // Validate @type
          if (typeof valueType !== 'string') {
            throw new Error(`The value of an '@type' must be a string, got '${JSON.stringify(valueType)}'`);
          }
          const typeTerm = this.createVocabOrBaseTerm(context, valueType);
          if (!typeTerm) {
            throw new ErrorCoded(`Invalid '@type' value, got '${JSON.stringify(valueType)}'`,
              ERROR_CODES.INVALID_TYPED_VALUE);
          }
          if (typeTerm.termType !== 'NamedNode') {
            throw new Error(`Illegal value type (${typeTerm.termType}): ${valueType}`);
          }
          return [ this.dataFactory.literal(val, typeTerm) ];
        }
        // We don't pass the context, because context-based things like @language should be ignored
        return await this.valueToTerm(new JsonLdContextNormalized({}), key, val, depth, keys);
      } else if ('@set' in value) {
        // No other entries are allow in this value
        if (Object.keys(value).length > 1) {
          throw new Error(`Found illegal neighbouring entries next to @set in value: ${JSON.stringify(value)}`);
        }

        // No need to do anything here, this is handled at the deeper level.
        return [];
      } else if ('@list' in value) {
        // No other entries are allowed in this value
        if (Object.keys(value).length > 1) {
          throw new Error(`Found illegal neighbouring entries next to @set in value: ${JSON.stringify(value)}`);
        }

        const listValue = value["@list"];
        // We handle lists at value level so we can emit earlier, so this is handled already when we get here.
        // Empty anonymous lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if (Array.isArray(listValue)) {
          if (listValue.length === 0) {
            return [ this.rdfNil ];
          } else {
            return this.parsingContext.idStack[depth + 1] || [];
          }
        } else {
          // We only have a single list element here, so emit this directly as single element
          return await this.valueToTerm(await this.parsingContext.getContext(keys),
            key, listValue, depth - 1, keys.slice(0, -1));
        }
      } else if ('@reverse' in value) {
        // We handle reverse properties at value level so we can emit earlier,
        // so this is handled already when we get here.
        return [];
      } else if ('@graph' in Util.getContextValueContainer(await this.parsingContext.getContext(keys), key)) {
        // We are processing a graph container
        const graphContainerEntries = this.parsingContext.graphContainerTermStack[depth + 1];
        return graphContainerEntries ? Object.values(graphContainerEntries) : [ this.dataFactory.blankNode() ];
      } else if ("@id" in value) {
        // Use deeper context if the value node contains other properties next to @id.
        if (Object.keys(value).length > 1) {
          context = await this.parsingContext.getContext(keys, 0);
        }
        // Handle local context in the value
        if ('@context' in value) {
          context = await this.parsingContext.parseContext(value['@context'], context.getContextRaw());
        }

        if (value["@type"] === '@vocab') {
          return this.nullableTermToArray(this.createVocabOrBaseTerm(context, value["@id"]));
        } else {
          return this.nullableTermToArray(this.resourceToTerm(context, value["@id"]));
        }
      } else {
        // Only make a blank node if at least one triple was emitted at the value's level.
        if (this.parsingContext.emittedStack[depth + 1]) {
          return (this.parsingContext.idStack[depth + 1]
            || (this.parsingContext.idStack[depth + 1] = [ this.dataFactory.blankNode() ]));
        } else {
          return [];
        }
      }
    case 'string':
      return this.nullableTermToArray(this.stringValueToTerm(depth,
        await this.getContextSelfOrPropertyScoped(context, key), key, value, null));
    case 'boolean':
      return this.nullableTermToArray(this.stringValueToTerm(depth,
        await this.getContextSelfOrPropertyScoped(context, key), key, Boolean(value).toString(),
        this.dataFactory.namedNode(Util.XSD_BOOLEAN)));
    case 'number':
      return this.nullableTermToArray(this.stringValueToTerm(depth,
        await this.getContextSelfOrPropertyScoped(context, key), key, value, this.dataFactory.namedNode(
        value % 1 === 0 && value < 1e21 ? Util.XSD_INTEGER : Util.XSD_DOUBLE)));
    default:
      this.parsingContext.emitError(new Error(`Could not determine the RDF type of a ${type}`));
      return [];
    }
  }

  /**
   * If the context defines a property-scoped context for the given key,
   * that context will be returned.
   * Otherwise, the given context will be returned as-is.
   *
   * This should be used for valueToTerm cases that are not objects.
   * @param context A context.
   * @param key A JSON key.
   */
  public async getContextSelfOrPropertyScoped(context: JsonLdContextNormalized, key: string)
    : Promise<JsonLdContextNormalized> {
    const contextKeyEntry = context.getContextRaw()[key];
    if (contextKeyEntry && typeof contextKeyEntry === 'object' && '@context' in contextKeyEntry) {
      context = await this.parsingContext.parseContext(contextKeyEntry, context.getContextRaw(), true);
    }
    return context;
  }

  /**
   * If the given term is null, return an empty array, otherwise return an array with the single given term.
   * @param term A term.
   */
  public nullableTermToArray(term: RDF.Term | null): RDF.Term[] {
    return term ? [ term ] : [];
  }

  /**
   * Convert a given JSON key to an RDF predicate term,
   * based on @vocab.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node.
   */
  public predicateToTerm(context: JsonLdContextNormalized, key: string): RDF.Term | null {
    const expanded: string | null = context.expandTerm(key, true, this.parsingContext.getExpandOptions());

    // Immediately return if the predicate was disabled in the context
    if (!expanded) {
      return null;
    }

    // Check if the predicate is a blank node
    if (expanded[0] === '_' && expanded[1] === ':') {
      if (this.parsingContext.produceGeneralizedRdf) {
        return this.dataFactory.blankNode(expanded.substr(2));
      } else {
        return null;
      }
    }

    // Check if the predicate is a valid IRI
    if (Util.isValidIri(expanded)) {
      return this.dataFactory.namedNode(expanded);
    } else {
      if (expanded && this.parsingContext.strictValues) {
        this.parsingContext.emitError(new ErrorCoded(`Invalid predicate IRI: ${expanded}`,
          ERROR_CODES.INVALID_IRI_MAPPING));
      } else {
        return null;
      }
    }

    return null;
  }

  /**
   * Convert a given JSON key to an RDF resource term or blank node,
   * based on @base.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node or null.
   */
  public resourceToTerm(context: JsonLdContextNormalized, key: string): RDF.NamedNode | RDF.BlankNode | null {
    if (key.startsWith('_:')) {
      return this.dataFactory.blankNode(key.substr(2));
    }
    const iri = context.expandTerm(key, false, this.parsingContext.getExpandOptions());
    if (!Util.isValidIri(iri)) {
      if (iri && this.parsingContext.strictValues) {
        this.parsingContext.emitError(new Error(`Invalid resource IRI: ${iri}`));
      } else {
        return null;
      }
    }
    return this.dataFactory.namedNode(<string> iri);
  }

  /**
   * Convert a given JSON key to an RDF resource term.
   * It will do this based on the @vocab,
   * and fallback to @base.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node or null.
   */
  public createVocabOrBaseTerm(context: JsonLdContextNormalized, key: string): RDF.Term | null {
    if (key.startsWith('_:')) {
      return this.dataFactory.blankNode(key.substr(2));
    }
    const expandOptions = this.parsingContext.getExpandOptions();
    let expanded = context.expandTerm(key, true, expandOptions);
    if (expanded === key) {
      expanded = context.expandTerm(key, false, expandOptions);
    }
    if (!Util.isValidIri(expanded)) {
      if (expanded && this.parsingContext.strictValues) {
        this.parsingContext.emitError(new Error(`Invalid term IRI: ${expanded}`));
      } else {
        return null;
      }
    }
    return this.dataFactory.namedNode(<string> expanded);
  }

  /**
   * Ensure that the given value becomes a string.
   * @param {string | number} value A string or number.
   * @param {NamedNode} datatype The intended datatype.
   * @return {string} The returned string.
   */
  public intToString(value: string | number, datatype: RDF.NamedNode | null): string {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        const isInteger = value % 1 === 0;
        if (isInteger && (!datatype || datatype.value !== Util.XSD_DOUBLE)) {
          return Number(value).toString();
        } else {
          return value.toExponential(15).replace(/(\d)0*e\+?/, '$1E');
        }
      } else {
        return value > 0 ? 'INF' : '-INF';
      }
    } else {
      return value;
    }
  }

  /**
   * Convert a given JSON string value to an RDF term.
   * @param {number} depth The current stack depth.
   * @param {JsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param {string} value A JSON value.
   * @param {NamedNode} defaultDatatype The default datatype for the given value.
   * @return {RDF.Term} An RDF term or null.
   */
  public stringValueToTerm(depth: number, context: JsonLdContextNormalized, key: string, value: string | number,
                           defaultDatatype: RDF.NamedNode | null): RDF.Term | null {
    // Check the datatype from the context
    const contextType = Util.getContextValueType(context, key);
    if (contextType) {
      if (contextType === '@id') {
        if (!defaultDatatype) {
          return this.resourceToTerm(context, this.intToString(value, defaultDatatype));
        }
      } else if (contextType === '@vocab') {
        if (!defaultDatatype) {
          return this.createVocabOrBaseTerm(context, this.intToString(value, defaultDatatype));
        }
      } else {
        defaultDatatype = this.dataFactory.namedNode(contextType);
      }
    }

    // If we don't find such a datatype, check the language from the context
    if (!defaultDatatype) {
      const contextLanguage = Util.getContextValueLanguage(context, key);
      const contextDirection = Util.getContextValueDirection(context, key);
      if (contextDirection && this.parsingContext.rdfDirection) {
        return this.createLanguageDirectionLiteral(depth, this.intToString(value, defaultDatatype),
          contextLanguage, contextDirection);
      } else {
        return this.dataFactory.literal(this.intToString(value, defaultDatatype),
          <string | RDF.NamedNode> contextLanguage);
      }
    }

    // If all else fails, make a literal based on the default content type
    return this.dataFactory.literal(this.intToString(value, defaultDatatype), defaultDatatype);
  }

  /**
   * Create a literal for the given value with the given language and direction.
   * Auxiliary quads may be emitted.
   * @param {number} depth The current stack depth.
   * @param {string} value A string value.
   * @param {string} language A language tag.
   * @param {string} direction A direction.
   * @return {Term} An RDF term.
   */
  public createLanguageDirectionLiteral(depth: number, value: string, language: string | null, direction: string)
    : RDF.Term {
    if (this.parsingContext.rdfDirection === 'i18n-datatype') {
      // Create a datatyped literal, by encoding the language and direction into https://www.w3.org/ns/i18n#.
      if (!language) {
        language = '';
      }
      return this.dataFactory.literal(value,
        this.dataFactory.namedNode(`https://www.w3.org/ns/i18n#${language}_${direction}`));
    } else {
      // Reify the literal.
      const valueNode = this.dataFactory.blankNode();
      const graph = this.getDefaultGraph();
      this.parsingContext.emitQuad(depth, this.dataFactory.quad(valueNode,
        this.dataFactory.namedNode(Util.RDF + 'value'), this.dataFactory.literal(value), graph));
      if (language) {
        this.parsingContext.emitQuad(depth, this.dataFactory.quad(valueNode,
          this.dataFactory.namedNode(Util.RDF + 'language'), this.dataFactory.literal(language), graph));
      }
      this.parsingContext.emitQuad(depth, this.dataFactory.quad(valueNode,
        this.dataFactory.namedNode(Util.RDF + 'direction'), this.dataFactory.literal(direction), graph));
      return valueNode;
    }
  }

  /**
   * Stringify the given JSON object to a canonical JSON string.
   * @param value Any valid JSON value.
   * @return {string} A canonical JSON string.
   */
  public valueToJsonString(value: any): string {
    return canonicalizeJson(value);
  }

  /**
   * If the key is not a keyword, try to check if it is an alias for a keyword,
   * and if so, un-alias it.
   * @param {string} key A key, can be falsy.
   * @param {string[]} keys The path of keys.
   * @param {number} depth The depth to
   * @param {boolean} disableCache If the cache should be disabled
   * @param {JsonLdContextNormalized} context A context to unalias with,
   *                                           will fallback to retrieving the context for the given keys.
   * @return {Promise<string>} A promise resolving to the key itself, or another key.
   */
  public async unaliasKeyword(key: any, keys: string[], depth: number, disableCache?: boolean,
                              context?: JsonLdContextNormalized): Promise<any> {
    // Numbers can not be an alias
    if (Number.isInteger(key)) {
      return key;
    }

    // Try to grab from cache if it was already un-aliased before.
    if (!disableCache) {
      const cachedUnaliasedKeyword = this.parsingContext.unaliasedKeywordCacheStack[depth];
      if (cachedUnaliasedKeyword) {
        return cachedUnaliasedKeyword;
      }
    }

    if (!ContextUtil.isPotentialKeyword(key)) {
      context = context || await this.parsingContext.getContext(keys);
      let unliased = context.getContextRaw()[key];
      if (unliased && typeof unliased === 'object') {
        unliased = unliased['@id'];
      }
      if (ContextUtil.isValidKeyword(unliased)) {
        key = unliased;
      }
    }

    return disableCache ? key : (this.parsingContext.unaliasedKeywordCacheStack[depth] = key);
  }

  /**
   * Unalias the keyword of the parent.
   * This adds a safety check if no parent exist.
   * @param {any[]} keys A stack of keys.
   * @param {number} depth The current depth.
   * @return {Promise<any>} A promise resolving to the parent key, or another key.
   */
  public async unaliasKeywordParent(keys: any[], depth: number): Promise<any> {
    return await this.unaliasKeyword(depth > 0 && keys[depth - 1], keys, depth - 1);
  }

  /**
   * Un-alias all keywords in the given hash.
   * @param {{[p: string]: any}} hash A hash object.
   * @param {string[]} keys The path of keys.
   * @param {number} depth The depth.
   * @param {JsonLdContextNormalized} context A context to unalias with,
   *                                           will fallback to retrieving the context for the given keys.
   * @return {Promise<{[p: string]: any}>} A promise resolving to the new hash.
   */
  public async unaliasKeywords(hash: {[id: string]: any}, keys: string[], depth: number,
                               context?: JsonLdContextNormalized): Promise<{[id: string]: any}> {
    const newHash: {[id: string]: any} = {};
    for (const key in hash) {
      newHash[await this.unaliasKeyword(key, keys, depth + 1, true, context)] = hash[key];
    }
    return newHash;
  }

  /**
   * Check if we are processing a literal (including JSON literals) at the given depth.
   * This will also check higher levels,
   * because if a parent is a literal,
   * then the deeper levels are definitely a literal as well.
   * @param {number} depth The depth.
   * @return {boolean} If we are processing a literal.
   */
  public isLiteral(depth: number): boolean {
    for (let i = depth; i >= 0; i--) {
      if (this.parsingContext.literalStack[i] || this.parsingContext.jsonLiteralStack[i]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check how many parents should be skipped for checking the @graph for the given node.
   *
   * @param {number} depth The depth of the node.
   * @param {any[]} keys An array of keys.
   * @return {number} The graph depth offset.
   */
  public async getDepthOffsetGraph(depth: number, keys: any[]): Promise<number> {
    for (let i = depth - 1; i > 0; i--) {
      if (await this.unaliasKeyword(keys[i], keys, i) === '@graph') {
        // Skip further processing if we are already in an @graph-@id or @graph-@index container
        const containers = (await EntryHandlerContainer.getContainerHandler(this.parsingContext, keys, i)).containers;
        if (EntryHandlerContainer.isComplexGraphContainer(containers)) {
          return -1;
        }

        return depth - i - 1;
      }
    }
    return -1;
  }

  /**
   * Check if the given subject is of a valid type.
   * This should be called when applying @reverse'd properties.
   * @param {Term} subject A subject.
   */
  public validateReverseSubject(subject: RDF.Term) {
    if (subject.termType === 'Literal') {
      throw new ErrorCoded(`Found illegal literal in subject position: ${subject.value}`,
        ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE);
    }
  }

  /**
   * Get the default graph.
   * @return {Term} An RDF term.
   */
  public getDefaultGraph(): RDF.NamedNode | RDF.BlankNode | RDF.DefaultGraph {
    return this.parsingContext.defaultGraph || this.dataFactory.defaultGraph();
  }

  /**
   * Get the current graph, while taking into account a graph that can be defined via @container: @graph.
   * If not within a graph container, the default graph will be returned.
   * @param keys The current keys.
   * @param depth The current depth.
   */
  public async getGraphContainerValue(keys: any[], depth: number)
    : Promise<RDF.NamedNode | RDF.BlankNode | RDF.DefaultGraph> {
    // Default to default graph
    let graph: RDF.NamedNode | RDF.BlankNode | RDF.DefaultGraph | null = this.getDefaultGraph();

    // Check if we are in an @container: @graph.
    const { containers, depth: depthContainer } = await EntryHandlerContainer
      .getContainerHandler(this.parsingContext, keys, depth);
    if ('@graph' in containers) {
      // Get the graph from the stack.
      const graphContainerIndex = EntryHandlerContainer.getContainerGraphIndex(containers, depthContainer, keys);
      const entry = this.parsingContext.graphContainerTermStack[depthContainer];
      graph = entry ? entry[graphContainerIndex] : null;

      // Set the graph in the stack if none has been set yet.
      if (!graph) {
        let graphId: RDF.NamedNode | RDF.BlankNode | null = null;
        if ('@id' in containers) {
          const keyUnaliased = await this.getContainerKey(keys[depthContainer], keys, depthContainer);
          if (keyUnaliased !== null) {
            graphId = await this.resourceToTerm(await this.parsingContext.getContext(keys), keyUnaliased);
          }
        }
        if (!graphId) {
          graphId = this.dataFactory.blankNode();
        }
        if (!this.parsingContext.graphContainerTermStack[depthContainer]) {
          this.parsingContext.graphContainerTermStack[depthContainer] = {};
        }
        graph = this.parsingContext.graphContainerTermStack[depthContainer][graphContainerIndex] = graphId;
      }
    }

    return graph;
  }

  /**
   * Get the properties depth for retrieving properties.
   *
   * Typically, the properties depth will be identical to the given depth.
   *
   * The following exceptions apply:
   * * When the parent is @reverse, the depth is decremented by one.
   * * When @nest parents are found, the depth is decremented by the number of @nest parents.
   * If in combination with the exceptions above an intermediary array is discovered,
   * the depth is also decremented by this number of arrays.
   *
   * @param keys The current key chain.
   * @param depth The current depth.
   */
  public async getPropertiesDepth(keys: any[], depth: number): Promise<number> {
    let lastValidDepth = depth;
    for (let i = depth - 1; i > 0; i--) {
      if (typeof keys[i] !== 'number') { // Skip array keys
        const parentKey = await this.unaliasKeyword(keys[i], keys, i);
        if (parentKey === '@reverse') {
          return i;
        } else if (parentKey === '@nest') {
          lastValidDepth = i;
        } else {
          return lastValidDepth;
        }
      }
    }
    return lastValidDepth;
  }

  /**
   * Get the key for the current container entry.
   * @param key A key, can be falsy.
   * @param keys The key chain.
   * @param depth The current depth to get the key from.
   * @return Promise resolving to the key.
   *         Null will be returned for @none entries, with aliasing taken into account.
   */
  public async getContainerKey(key: any, keys: string[], depth: number): Promise<any> {
    const keyUnaliased = await this.unaliasKeyword(key, keys, depth);
    return keyUnaliased === '@none' ? null : keyUnaliased;
  }

}
