import {ContextParser, ERROR_CODES, ErrorCoded, IJsonLdContextNormalized} from "jsonld-context-parser";
import * as RDF from "rdf-js";
import {ParsingContext} from "./ParsingContext";

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

  private readonly parsingContext: ParsingContext;

  constructor(options: { parsingContext: ParsingContext, dataFactory?: RDF.DataFactory }) {
    this.parsingContext = options.parsingContext;
    this.dataFactory = options.dataFactory || require('@rdfjs/data-model');

    this.rdfFirst = this.dataFactory.namedNode(Util.RDF + 'first');
    this.rdfRest = this.dataFactory.namedNode(Util.RDF + 'rest');
    this.rdfNil = this.dataFactory.namedNode(Util.RDF + 'nil');
    this.rdfType = this.dataFactory.namedNode(Util.RDF + 'type');
  }

  /**
   * Helper function to get the value of a context entry,
   * or fallback to a certain value.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} contextKey A pre-defined JSON-LD key in context entries.
   * @param {string} key A context entry key.
   * @param {string} fallback A fallback value for when the given contextKey
   *                          could not be found in the value with the given key.
   * @return {string} The value of the given contextKey in the entry behind key in the given context,
   *                  or the given fallback value.
   */
  public static getContextValue(context: IJsonLdContextNormalized, contextKey: string,
                                key: string, fallback: string): string {
    const entry = context[key];
    if (!entry) {
      return fallback;
    }
    const type = entry[contextKey];
    return type === undefined ? fallback : type;
  }

  /**
   * Get the container type of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The container type.
   */
  public static getContextValueContainer(context: IJsonLdContextNormalized, key: string): string {
    return Util.getContextValue(context, '@container', key, '@set');
  }

  /**
   * Get the value type of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueType(context: IJsonLdContextNormalized, key: string): string {
    return Util.getContextValue(context, '@type', key, null);
  }

  /**
   * Get the language of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueLanguage(context: IJsonLdContextNormalized, key: string): string {
    return Util.getContextValue(context, '@language', key, context['@language'] || null);
  }

  /**
   * Get the direction of the given key in the context.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {string} The node type.
   */
  public static getContextValueDirection(context: IJsonLdContextNormalized, key: string): string {
    return Util.getContextValue(context, '@direction', key, context['@direction'] || null);
  }

  /**
   * Check if the given key in the context is a reversed property.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key A context entry key.
   * @return {boolean} If the context value has a @reverse key.
   */
  public static isContextValueReverse(context: IJsonLdContextNormalized, key: string): boolean {
    return !!Util.getContextValue(context, '@reverse', key, null);
  }

  /**
   * Check if the given key refers to a reversed property.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The property key.
   * @param {string} parentKey The parent key.
   * @return {boolean} If the property must be reversed.
   */
  public static isPropertyReverse(context: IJsonLdContextNormalized, key: string, parentKey: string): boolean {
    // '!==' is needed because reversed properties in a @reverse container should cancel each other out.
    return parentKey === '@reverse' !== Util.isContextValueReverse(context, key);
  }

  /**
   * Check if the given IRI is valid.
   * @param {string} iri A potential IRI.
   * @return {boolean} If the given IRI is valid.
   */
  public static isValidIri(iri: string): boolean {
    return ContextParser.isValidIri(iri);
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
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param value A JSON value.
   * @param {number} depth The depth the value is at.
   * @param {string[]} keys The path of keys.
   * @return {RDF.Term} An RDF term.
   */
  public async valueToTerm(context: IJsonLdContextNormalized, key: string,
                           value: any, depth: number, keys: string[]): Promise<RDF.Term> {
    const type: string = typeof value;
    switch (type) {
    case 'object':
      // Skip if we have a null or undefined object
      if (value === null || value === undefined) {
        return null;
      }

      // Special case for arrays
      if (Array.isArray(value)) {
        // We handle arrays at value level so we can emit earlier, so this is handled already when we get here.
        // Empty context-based lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if (Util.getContextValueContainer(context, key) === '@list' && value.length === 0) {
          return this.rdfNil;
        }
        await this.validateValueIndexes(value);
        return null;
      }

      // Handle local context in the value
      if ('@context' in value) {
        context = await this.parsingContext.parseContext(value['@context'], context);
      }

      // In all other cases, we have a hash
      value = await this.unaliasKeywords(value, keys, depth); // Un-alias potential keywords in this hash
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

        // Validate @value
        if (val === null) {
          return null;
        }
        if (typeof val === 'object') {
          throw new Error(`The value of an '@value' can not be an object, got '${JSON.stringify(val)}'`);
        }

        // Validate @index
        if (this.parsingContext.validateValueIndexes && valueIndex && typeof valueIndex !== 'string') {
          throw new Error(`The value of an '@index' must be a string, got '${JSON.stringify(valueIndex)}'`);
        }

        // Validate @language and @direction
        if (valueLanguage) {
          if (typeof val !== 'string') {
            throw new Error(
              `When an '@language' is set, the value of '@value' must be a string, got '${JSON.stringify(val)}'`);
          }

          if (!ContextParser.validateLanguage(valueLanguage, this.parsingContext.strictRanges)) {
            return null;
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

          if (!ContextParser.validateDirection(valueDirection, this.parsingContext.strictRanges)) {
            return null;
          }
        }

        // Check @language and @direction
        if (valueLanguage && valueDirection && this.parsingContext.rdfDirection) {
          if (valueType) {
            throw new Error(`Can not have '@language', '@direction' and '@type' in a value: '
            ${JSON.stringify(value)}'`);
          }

          return this.createLanguageDirectionLiteral(depth, val, valueLanguage, valueDirection);
        } else if (valueLanguage) { // Check @language
          if (valueType) {
            throw new Error(`Can not have both '@language' and '@type' in a value: '${JSON.stringify(value)}'`);
          }

          return this.dataFactory.literal(val, valueLanguage);
        } else if (valueDirection && this.parsingContext.rdfDirection) { // Check @direction
          if (valueType) {
            throw new Error(`Can not have both '@direction' and '@type' in a value: '${JSON.stringify(value)}'`);
          }

          return this.createLanguageDirectionLiteral(depth, val, valueLanguage, valueDirection);
        } else if (valueType) { // Validate @type
          if (typeof valueType !== 'string') {
            throw new Error(`The value of an '@type' must be a string, got '${JSON.stringify(valueType)}'`);
          }
          const typeTerm = this.createVocabOrBaseTerm(context, valueType);
          if (!typeTerm) {
            return null;
          }
          if (typeTerm.termType !== 'NamedNode') {
            throw new Error(`Illegal value type (${typeTerm.termType}): ${valueType}`);
          }
          return this.dataFactory.literal(val, typeTerm);
        }
        // We don't pass the context, because context-based things like @language should be ignored
        return await this.valueToTerm({}, key, val, depth, keys);
      } else if ('@set' in value) {
        // No other entries are allow in this value
        if (Object.keys(value).length > 1) {
          throw new Error(`Found illegal neighbouring entries next to @set in value: ${JSON.stringify(value)}`);
        }

        // No need to do anything here, this is handled at the deeper level.
        return null;
      } else if ('@list' in value) {
        // No other entries are allow in this value
        if (Object.keys(value).length > 1) {
          throw new Error(`Found illegal neighbouring entries next to @set in value: ${JSON.stringify(value)}`);
        }

        const listValue = value["@list"];
        // We handle lists at value level so we can emit earlier, so this is handled already when we get here.
        // Empty anonymous lists are emitted at this place, because our streaming algorithm doesn't detect those.
        if (Array.isArray(listValue)) {
          if (listValue.length === 0) {
            return this.rdfNil;
          } else {
            return null;
          }
        } else {
          // We only have a single list element here, so emit this directly as single element
          return this.valueToTerm(await this.parsingContext.getContext(keys),
            key, listValue, depth - 1, keys.slice(0, -1));
        }
      } else if ('@reverse' in value) {
        // We handle reverse properties at value level so we can emit earlier,
        // so this is handled already when we get here.
        return null;
      } else if ("@id" in value) {
        if (value["@type"] === '@vocab') {
          return this.createVocabOrBaseTerm(context, value["@id"]);
        } else {
          return this.resourceToTerm(context, value["@id"]);
        }
      } else {
        // Only make a blank node if at least one triple was emitted at the value's level.
        if (this.parsingContext.emittedStack[depth + 1]) {
          return this.parsingContext.idStack[depth + 1]
            || (this.parsingContext.idStack[depth + 1] = this.dataFactory.blankNode());
        } else {
          return null;
        }
      }
    case 'string':
      return this.stringValueToTerm(depth, context, key, value, null);
    case 'boolean':
      return this.stringValueToTerm(depth, context, key, Boolean(value).toString(),
        this.dataFactory.namedNode(Util.XSD_BOOLEAN));
    case 'number':
      return this.stringValueToTerm(depth, context, key, value, this.dataFactory.namedNode(
        value % 1 === 0 && value < 1e21 ? Util.XSD_INTEGER : Util.XSD_DOUBLE));
    default:
      this.parsingContext.emitError(new Error(`Could not determine the RDF type of a ${type}`));
    }
  }

  /**
   * Convert a given JSON key to an RDF predicate term,
   * based on @vocab.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node.
   */
  public predicateToTerm(context: IJsonLdContextNormalized, key: string): RDF.Term {
    const expanded: string = ContextParser.expandTerm(key, context, true, this.parsingContext.getExpandOptions());

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
      if (expanded && this.parsingContext.errorOnInvalidProperties) {
        this.parsingContext.emitError(new ErrorCoded(`Invalid predicate IRI: ${expanded}`,
          ERROR_CODES.INVALID_IRI_MAPPING));
      } else {
        return null;
      }
    }
  }

  /**
   * Convert a given JSON key to an RDF resource term or blank node,
   * based on @base.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node or null.
   */
  public resourceToTerm(context: IJsonLdContextNormalized, key: string): RDF.Term {
    if (key.startsWith('_:')) {
      return this.dataFactory.blankNode(key.substr(2));
    }
    const iri = ContextParser.expandTerm(key, context, false, this.parsingContext.getExpandOptions());
    if (!Util.isValidIri(iri)) {
      if (iri && this.parsingContext.errorOnInvalidProperties) {
        this.parsingContext.emitError(new Error(`Invalid resource IRI: ${iri}`));
      } else {
        return null;
      }
    }
    return this.dataFactory.namedNode(iri);
  }

  /**
   * Convert a given JSON key to an RDF resource term.
   * It will do this based on the @vocab,
   * and fallback to @base.
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param key A JSON key.
   * @return {RDF.NamedNode} An RDF named node or null.
   */
  public createVocabOrBaseTerm(context: IJsonLdContextNormalized, key: string): RDF.Term {
    if (key.startsWith('_:')) {
      return this.dataFactory.blankNode(key.substr(2));
    }
    const expandOptions = this.parsingContext.getExpandOptions();
    let expanded = ContextParser.expandTerm(key, context, true, expandOptions);
    if (expanded === key) {
      expanded = ContextParser.expandTerm(key, context, false, expandOptions);
    }
    if (!Util.isValidIri(expanded)) {
      if (expanded && this.parsingContext.errorOnInvalidProperties) {
        this.parsingContext.emitError(new Error(`Invalid term IRI: ${expanded}`));
      } else {
        return null;
      }
    }
    return this.dataFactory.namedNode(expanded);
  }

  /**
   * Ensure that the given value becomes a string.
   * @param {string | number} value A string or number.
   * @param {NamedNode} datatype The intended datatype.
   * @return {string} The returned string.
   */
  public intToString(value: string | number, datatype: RDF.NamedNode): string {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        const isInteger = value % 1 === 0;
        if (isInteger && datatype.value !== Util.XSD_DOUBLE) {
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
   * @param {IJsonLdContextNormalized} context A JSON-LD context.
   * @param {string} key The current JSON key.
   * @param {string} value A JSON value.
   * @param {NamedNode} defaultDatatype The default datatype for the given value.
   * @return {RDF.Term} An RDF term or null.
   */
  public stringValueToTerm(depth: number, context: IJsonLdContextNormalized, key: string, value: string | number,
                           defaultDatatype: RDF.NamedNode): RDF.Term {
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
        return this.dataFactory.literal(this.intToString(value, defaultDatatype), contextLanguage);
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
  public createLanguageDirectionLiteral(depth: number, value: string, language: string, direction: string): RDF.Term {
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
   * If the key is not a keyword, try to check if it is an alias for a keyword,
   * and if so, un-alias it.
   * @param {string} key A key, can be falsy.
   * @param {string[]} keys The path of keys.
   * @param {number} depth The depth to
   * @param {boolean} disableCache If the cache should be disabled
   * @return {Promise<string>} A promise resolving to the key itself, or another key.
   */
  public async unaliasKeyword(key: any, keys: string[], depth: number, disableCache?: boolean): Promise<any> {
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

    if (!ContextParser.isPotentialKeyword(key)) {
      const context = await this.parsingContext.getContext(keys);
      let unliased = context[key];
      if (unliased && typeof unliased === 'object') {
        unliased = unliased['@id'];
      }
      if (ContextParser.isValidKeyword(unliased)) {
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
   * @return {Promise<{[p: string]: any}>} A promise resolving to the new hash.
   */
  public async unaliasKeywords(hash: {[id: string]: any}, keys: string[], depth: number): Promise<{[id: string]: any}> {
    const newHash: {[id: string]: any} = {};
    for (const key in hash) {
      newHash[await this.unaliasKeyword(key, keys, depth + 1, true)] = hash[key];
    }
    return newHash;
  }

  /**
   * Check if we are processing a literal at the given depth.
   * This will also check higher levels,
   * because if a parent is a literal,
   * then the deeper levels are definitely a literal as well.
   * @param {number} depth The depth.
   * @return {boolean} If we are processing a literal.
   */
  public isLiteral(depth: number): boolean {
    for (let i = depth; i >= 0; i--) {
      if (this.parsingContext.literalStack[i]) {
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
      throw new Error(`Found illegal literal in subject position: ${subject.value}`);
    }
  }

  /**
   * Get the default graph.
   * @return {Term} An RDF term.
   */
  public getDefaultGraph(): RDF.Term {
    return this.parsingContext.defaultGraph || this.dataFactory.defaultGraph();
  }

}
