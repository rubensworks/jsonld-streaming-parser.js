import {DataFactory} from "rdf-data-factory";
import "jest-rdf";
import {ERROR_CODES, ErrorCoded, JsonLdContextNormalized} from "jsonld-context-parser";
import {Util} from "../lib/Util";
import {ParsingContextMocked} from "../mocks/ParsingContextMocked";

const DF = new DataFactory();

describe('Util', () => {

  describe('#getContextValue', () => {
    it('should return the fallback when the context does not contain the given key', async () => {
      expect(Util.getContextValue(new JsonLdContextNormalized({}), 'a', 'x', 'FB')).toEqual('FB');
    });

    it('should return the fallback when the context contains the given key, without contextKey', async () => {
      expect(Util.getContextValue(new JsonLdContextNormalized({ x: {} }), 'a', 'x', 'FB')).toEqual('FB');
    });

    it('should return the value when the context contains the given key, with contextKey', async () => {
      expect(Util.getContextValue(new JsonLdContextNormalized({ x: { a: 'b' } }), 'a', 'x', 'FB')).toEqual('b');
    });
  });

  describe('#getContextValueContainer', () => {
    it('should return @set as default', async () => {
      expect(Util.getContextValueContainer(new JsonLdContextNormalized({}), 'abc')).toEqual({ '@set': true });
    });

    it('should return @list when defined as such', async () => {
      expect(Util.getContextValueContainer(new JsonLdContextNormalized({ abc: { '@container': { '@list': true } } }),
        'abc')).toEqual({ '@list': true });
    });
  });

  describe('#getContextValueType', () => {
    it('should return null as default', async () => {
      expect(Util.getContextValueType(new JsonLdContextNormalized({}), 'abc')).toBe(null);
    });

    it('should return @id when defined as such', async () => {
      expect(Util.getContextValueType(new JsonLdContextNormalized({ abc: { '@type': '@id' } }), 'abc'))
        .toEqual('@id');
    });

    it('should return null for @none', async () => {
      expect(Util.getContextValueType(new JsonLdContextNormalized({ abc: { '@type': '@none' } }), 'abc'))
        .toEqual(null);
    });
  });

  describe('#getContextValueLanguage', () => {
    it('should return null as default', async () => {
      expect(Util.getContextValueLanguage(new JsonLdContextNormalized({}), 'abc')).toBe(null);
    });

    it('should return @language on root as default if available', async () => {
      expect(Util.getContextValueLanguage(new JsonLdContextNormalized({ '@language': 'nl-be' }), 'abc')).toBe('nl-be');
    });

    it('should return the entry language', async () => {
      expect(Util.getContextValueLanguage(new JsonLdContextNormalized({ abc: { '@language': 'en-us' } }), 'abc'))
        .toEqual('en-us');
    });

    it('should return the null entry language even if a root @language is present', async () => {
      expect(Util.getContextValueLanguage(
        new JsonLdContextNormalized({ 'abc': { '@language': null }, '@language': 'nl-be'  }), 'abc'))
        .toEqual(null);
    });
  });

  describe('#getContextValueDirection', () => {
    it('should return null as default', async () => {
      expect(Util.getContextValueDirection(new JsonLdContextNormalized({}), 'abc')).toBe(null);
    });

    it('should return @direction on root as default if available', async () => {
      expect(Util.getContextValueDirection(new JsonLdContextNormalized({ '@direction': 'rtl' }), 'abc')).toBe('rtl');
    });

    it('should return the entry direction', async () => {
      expect(Util.getContextValueDirection(new JsonLdContextNormalized({ abc: { '@direction': 'ltr' } }), 'abc'))
        .toEqual('ltr');
    });

    it('should return the null entry direction even if a root @direction is present', async () => {
      expect(Util.getContextValueDirection(
        new JsonLdContextNormalized({ 'abc': { '@direction': null }, '@direction': 'ltr' }), 'abc'))
        .toEqual(null);
    });
  });

  describe('#isContextValueReverse', () => {
    it('should return false as default', async () => {
      expect(Util.isContextValueReverse(new JsonLdContextNormalized({}), 'abc')).toBe(false);
    });

    it('should return true when defined as such', async () => {
      expect(Util.isContextValueReverse(new JsonLdContextNormalized({ abc: { '@reverse': 'bla' } }), 'abc')).toBe(true);
    });
  });

  describe('#getContextValueIndex', () => {
    it('should return null as default', async () => {
      expect(Util.getContextValueIndex(new JsonLdContextNormalized({}), 'abc')).toBe(null);
    });

    it('should return the value when defined as such', async () => {
      expect(Util.getContextValueIndex(new JsonLdContextNormalized({ abc: { '@index': 'bla' } }), 'abc')).toBe('bla');
    });
  });

  describe('#isPropertyReverse', () => {
    it('should return false as default', async () => {
      expect(Util.isPropertyReverse(new JsonLdContextNormalized({}), 'abc', 'def')).toBe(false);
    });

    it('should return true when the parent key is @reverse', async () => {
      expect(Util.isPropertyReverse(new JsonLdContextNormalized({}), 'abc', '@reverse')).toBe(true);
    });

    it('should return true when the key has @reverse in the context', async () => {
      expect(Util.isPropertyReverse(
        new JsonLdContextNormalized({ abc: { '@reverse': 'bla' } }), 'abc', 'def')).toBe(true);
    });
  });

  describe('#isValidIri', () => {
    it('should return false for null', async () => {
      expect(Util.isValidIri(null)).toBe(false);
    });

    it('should return false for undefined', async () => {
      expect(Util.isValidIri(<any>undefined)).toBe(false);
    });

    it('should return false for false', async () => {
      expect(Util.isValidIri(<any> false)).toBe(false);
    });

    it('should return false for true', async () => {
      expect(Util.isValidIri(<any> true)).toBe(false);
    });

    it('should return false for the empty string', async () => {
      expect(Util.isValidIri('')).toBe(false);
    });

    it('should return false for a', async () => {
      expect(Util.isValidIri('a')).toBe(false);
    });

    it('should return true for http://abc', async () => {
      expect(Util.isValidIri('http://abc')).toBe(true);
    });

    it('should return true for _:b', async () => {
      expect(Util.isValidIri('_:b')).toBe(true);
    });
  });

  describe('isPrefixArray', () => {
    it('should return true for empty arrays', async () => {
      expect(Util.isPrefixArray([], [])).toBe(true);
    });

    it('should return true for empty needle in non-empty haystack', async () => {
      expect(Util.isPrefixArray([], ['a', 'b', 'c'])).toBe(true);
    });

    it('should return false for non-empty needle in empty haystack', async () => {
      expect(Util.isPrefixArray(['a'], [])).toBe(false);
    });

    it('should return false for needle larger than in haystack', async () => {
      expect(Util.isPrefixArray(['a', 'b'], ['a'])).toBe(false);
    });

    it('should return true for needle equal to haystack', async () => {
      expect(Util.isPrefixArray(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('should return true for needle prefix of haystack', async () => {
      expect(Util.isPrefixArray(['a'], ['a', 'b', 'c'])).toBe(true);
      expect(Util.isPrefixArray(['a'], ['a', 'b', 'c', 'd'])).toBe(true);
      expect(Util.isPrefixArray(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
      expect(Util.isPrefixArray(['a', 'b'], ['a', 'b', 'c', 'd'])).toBe(true);
    });

    it('should return false for needle not prefix of haystack', async () => {
      expect(Util.isPrefixArray(['b'], ['a', 'b', 'c'])).toBe(false);
      expect(Util.isPrefixArray(['b'], ['a', 'b', 'c', 'd'])).toBe(false);
      expect(Util.isPrefixArray(['b', 'c'], ['a', 'b', 'c'])).toBe(false);
      expect(Util.isPrefixArray(['b', 'c'], ['a', 'b', 'c', 'd'])).toBe(false);
    });
  });

  describe('instance', () => {

    let util: any;

    beforeEach(() => {
      util = new Util({ dataFactory: DF, parsingContext: new ParsingContextMocked({ parser: <any>null }) });
    });

    describe('#valueToTerm', () => {

      let context: JsonLdContextNormalized;

      beforeEach(() => {
        context = new JsonLdContextNormalized({});
      });

      describe('for an unknown type', () => {
        it('should emit an error', async () => {
          jest.spyOn(util.parsingContext, 'emitError');
          await util.valueToTerm(context, 'key', Symbol(), 0);
          expect(util.parsingContext.emitError).toHaveBeenCalledTimes(1);
        });
      });

      describe('for an object', () => {
        it('without an @id should return a bnode', async () => {
          return expect(await util.valueToTerm(context, 'key', {}, 0, []))
            .toEqualRdfTermArray([DF.blankNode()]);
        });

        it('without an @id should return a blank node when a value was emitted at a deeper depth', async () => {
          util.parsingContext.emittedStack[1] = true;
          return expect(await util.valueToTerm(context, 'key', {}, 0, []))
            .toEqualRdfTermArray([DF.blankNode()]);
        });

        it('without an @id should put a blank node on the id stack when a value was emitted at a deeper depth',
          async () => {
            util.parsingContext.emittedStack[1] = true;
            await util.valueToTerm(context, 'key', {}, 0, []);
            return expect(util.parsingContext.idStack[1]).toEqualRdfTermArray([DF.blankNode()]);
          });

        it('with an @id should return a named node', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@id': 'http://ex.org' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org')]);
        });

        it('with a relative @id without @base in context should return []', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@id': 'abc' }, 0, []))
            .toEqual([]);
        });

        it('with a relative @id with @base in context should return a named node', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', { '@id': 'abc' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/abc')]);
        });

        it('with an empty @id with @base in context should return a named node', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', { '@id': '' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/')]);
        });

        it('with a relative @id with @base in context should return a named node', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', { '@id': '.' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/')]);
        });

        it('with a relative to parent @id with @base in context should return a named node', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/abc/' });
          return expect(await util.valueToTerm(context, 'key', { '@id': '..' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/')]);
        });

        it('with a relative to parent with query @id with @base in context should return a named node', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/abc/' });
          return expect(await util.valueToTerm(context, 'key', { '@id': '..?a=b' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/?a=b')]);
        });

        it('with a relative @id with baseIRI should return a named node', async () => {
          util = new Util({ dataFactory: DF, parsingContext: new ParsingContextMocked(
            { baseIRI: 'http://ex.org/', parser: <any>null }) });
          return expect(await util.valueToTerm(await util.parsingContext.getContext([]),
            'key', { '@id': 'abc' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/abc')]);
        });

        it('with an empty @id with baseIRI should return a named node', async () => {
          util = new Util({ dataFactory: DF, parsingContext: new ParsingContextMocked(
              { baseIRI: 'http://ex.org/', parser: <any>null }) });
          return expect(await util.valueToTerm(await util.parsingContext.getContext([]), 'key', { '@id': '' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/')]);
        });

        it('with an empty @id with baseIRI and vocabIRI should return a named node for @type = @vocab', async () => {
          util = new Util({ dataFactory: DF, parsingContext: new ParsingContextMocked(<any>null) });
          context = new JsonLdContextNormalized({ '@base': 'http://base.org/', '@vocab': 'http://vocab.org/' });
          util.parsingContext.contextTree.setContext([], Promise.resolve(context));
          return expect(await util.valueToTerm(context, 'key', { '@id': '', '@type': '@vocab' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://vocab.org/')]);
        });

        it('with a relative @id and empty local @context with @base in parent context', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/' });
          util.parsingContext.contextTree.setContext([],
            Promise.resolve(new JsonLdContextNormalized({ '@base': 'http://ex.org/' })));
          return expect(await util.valueToTerm(context, 'key', { '@context': {}, '@id': 'abc' }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/abc')]);
        });

        it('with a relative @id and @base in local @context', async () => {
          const value = { '@context': { '@base': 'http://ex.org/' }, '@id': 'abc' };
          return expect(await util.valueToTerm(new JsonLdContextNormalized({}), 'key', value, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/abc')]);
        });

        it('with a relative @id and null local @context with @base in parent context', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', { '@context': null, '@id': 'abc' }, 0, []))
            .toEqual([]);
        });

        it('with a relative @id and no other properties with @base in parent context should return', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.do.org/' });
          util.parsingContext.contextTree.setContext(['key'],
            Promise.resolve(new JsonLdContextNormalized({ '@base': 'http://ex.ignored.org/' })));
          return expect(await util.valueToTerm(context, 'key', { '@id': 'abc' }, 0, ['key']))
            .toEqualRdfTermArray([DF.namedNode('http://ex.do.org/abc')]);
        });

        it('with a relative @id and other properties with @base in inner context should return', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.ignored.org/' });
          util.parsingContext.contextTree.setContext(['key'],
            Promise.resolve(new JsonLdContextNormalized({ '@base': 'http://ex.do.org/' })));
          return expect(await util.valueToTerm(context, 'key', { '@id': 'abc', 'a': 'b' }, 0, ['key']))
            .toEqualRdfTermArray([DF.namedNode('http://ex.do.org/abc')]);
        });

        it('with a relative @id and @context with @base in inner context should return', async () => {
          context = new JsonLdContextNormalized({ '@base': 'http://ex.ignored1.org/' });
          util.parsingContext.contextTree.setContext(['key'],
            Promise.resolve(new JsonLdContextNormalized({ '@base': 'http://ex.ignored2.org/' })));
          const context2 = { '@base': 'http://ex.do.org/' };
          return expect(await util.valueToTerm(context, 'key', { '@id': 'abc', '@context': context2 }, 0, ['key']))
            .toEqualRdfTermArray([DF.namedNode('http://ex.do.org/abc')]);
        });

        it('with an @value should return a literal', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc')]);
        });

        it('with an @value and @language should return a language-tagged string literal', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en-us' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
        });

        it('with an @value and @language should return a lowercased language-tagged string literal in 1.0',
          async () => {
            util.parsingContext.activeProcessingMode = 1.0;
            return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en-US' }, 0, []))
              .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
          });

        it('with an @value and @language should return a non-lowercased language-tagged string literal in 1.1',
          async () => {
            util.parsingContext.activeProcessingMode = 1.1;
            return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en-US' }, 0, []))
              .toEqualRdfTermArray([DF.literal('abc', 'en-US')]);
          });

        it('with an @value and @language should return a lowercased language-tagged string literal' +
          'if normalizeLanguageTags',
          async () => {
            util.parsingContext.normalizeLanguageTags = true;
            return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en-US' }, 0, []))
              .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
          });

        it('with an @value and @type should return a typed literal', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@type': 'http://type.com' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('http://type.com'))]);
        });

        it('with an @value and @type and context-@type: @none should return a typed literal', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@none' } });
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@type': 'http://type.com' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('http://type.com'))]);
        });

        it('with a @value value and @language in the context entry should return a language literal', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'nl-nl' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc', 'nl-nl')]);
        });

        it('with a @value null should return []', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(await util.valueToTerm(context, 'key', { '@value': null }, 0, []))
            .toEqual([]);
        });

        it('with a @value object should throw an error', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(util.valueToTerm(context, 'key', { '@value': {} }, 0, []))
            .rejects.toThrow(new ErrorCoded('The value of an \'@value\' can not be an object, got \'{}\'',
              ERROR_CODES.INVALID_VALUE_OBJECT_VALUE));
        });

        it('with a @value array should throw an error', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(util.valueToTerm(context, 'key', { '@value': [] }, 0, []))
            .rejects.toThrow(new ErrorCoded('The value of an \'@value\' can not be an object, got \'[]\'',
              ERROR_CODES.INVALID_VALUE_OBJECT_VALUE));
        });

        it('with a @value without @language should reset the language', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc' }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc')]);
        });

        it('with a @value and boolean @language should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@language': true }, 0, []))
            .rejects.toThrow(new Error('The value of an \'@language\' must be a string, got \'true\''));
        });

        it('with a boolean @value and valid @language should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': true, '@language': 'en-us' }, 0, []))
            .rejects.toThrow(
              new ErrorCoded('When an \'@language\' is set, the value of \'@value\' must be a string, got \'true\'',
                ERROR_CODES.INVALID_LANGUAGE_TAGGED_VALUE));
        });

        it('with a @value and invalid @language should return []', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en us' }, 0, []))
            .resolves.toEqual([]);
        });

        it('with a @value and invalid @language should throw an error when strictValues is true', async () => {
          util.parsingContext.strictValues = true;
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en us' }, 0, []))
            .rejects.toThrow(new Error('The value of an \'@language\' must be a valid language tag, got \'"en us"\''));
        });

        it('with a @value and non-string @direction should throw', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 3 }, 0, []))
            .rejects.toThrow(new Error('The value of an \'@direction\' must be a string, got \'3\''));
        });

        it('with a non-string @value and valid @direction should throw', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 3, '@direction': 'rtl' }, 0, []))
            .rejects.toThrow(new Error(
              'When an \'@direction\' is set, the value of \'@value\' must be a string, got \'3\''));
        });

        it('with a @value and invalid @direction should return []', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 'r tl' }, 0, []))
            .resolves.toEqual([]);
        });

        it('with a @value and invalid @direction should throw an error when strictValues is true', async () => {
          util.parsingContext.strictValues = true;
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 'r tl' }, 0, []))
            .rejects.toThrow(new Error('The value of an \'@direction\' must be \'ltr\' or \'rtl\', got \'"r tl"\''));
        });

        it('with a @value and valid @direction rtl should return a plain literal', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 'rtl' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('abc', { language: '', direction: 'rtl' })]);
        });

        it('with a @value and valid @direction ltr should return a plain literal', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 'ltr' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('abc', { language: '', direction: 'ltr' })]);
        });

        it('with a @value and boolean @type should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@type': true }, 0, []))
            .rejects.toThrow(new ErrorCoded('The value of an \'@type\' must be a string, got \'true\'',
              ERROR_CODES.INVALID_TYPED_VALUE));
        });

        it('with a @value and invalid string @type should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@type': 'a b' }, 0, []))
            .rejects.toThrow(new ErrorCoded('Invalid \'@type\' value, got \'"a b"\'',
              ERROR_CODES.INVALID_TYPED_VALUE));
        });

        it('with a @value and boolean @index should not throw an error', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@value': 'abc', '@index': true }, 0, []))
            .toEqualRdfTermArray([DF.literal('abc')]);
        });

        it('with a @value and boolean @index should throw an error when validateValueIndexes is true', async () => {
          util.parsingContext.validateValueIndexes = true;
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@index': true }, 0, []))
            .rejects.toThrow(new ErrorCoded('The value of an \'@index\' must be a string, got \'true\'',
              ERROR_CODES.INVALID_INDEX_VALUE));
        });

        it('with conflicting @index values should not throw an error', async () => {
          const value = [
            { '@id': 'abc', '@index': 'a' },
            { '@id': 'abc', '@index': 'b' },
            { '@id': 'abd', '@index': 'b' },
          ];
          return expect(await util.valueToTerm(context, 'key', value, 0, []))
            .toEqual([]);
        });

        it('with conflicting @index values should throw an error when validateValueIndexes is true', async () => {
          util.parsingContext.validateValueIndexes = true;
          const value = [
            { '@id': 'abc' },
            { '@id': 'abc', '@index': 'a' },
            { '@id': 'abc', '@index': 'b' },
            "abc",
            { '@id': 'abd', '@index': 'b' },
          ];
          return expect(util.valueToTerm(context, 'key', value, 0, []))
            .rejects.toThrow(new ErrorCoded('Conflicting @index value for abc', ERROR_CODES.CONFLICTING_INDEXES));
        });

        it('without conflicting @index values when validateValueIndexes is true', async () => {
          util.parsingContext.validateValueIndexes = true;
          const value = [
            { '@id': 'abc' },
            { '@id': 'abc', '@index': 'a' },
            { '@id': 'abc', '@index': 'a' },
            "abc",
            { '@id': 'abd', '@index': 'b' },
          ];
          return expect(await util.valueToTerm(context, 'key', value, 0, []))
            .toEqual([]);
        });

        it('with a @value and @id should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@id': 'abc' }, 0, []))
            .rejects.toThrow(new ErrorCoded('Unknown value entry \'@id\' in @value: {"@value":"abc","@id":"abc"}',
              ERROR_CODES.INVALID_VALUE_OBJECT));
        });

        it('with a @value, @language and @type should throw an error', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en', '@type': 'abc' }, 0, []))
            .rejects.toThrow(new ErrorCoded('Can not have both \'@language\' and \'@type\' in a value: ' +
              '\'{"@value":"abc","@language":"en","@type":"abc"}\'',
              ERROR_CODES.INVALID_VALUE_OBJECT));
        });

        it('with a @value, @direction and @type should throw an error', async () => {
          util.parsingContext.rdfDirection = 'i18n-datatype';
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@direction': 'rtl', '@type': 'abc' },
            0, []))
            .rejects.toThrow(new ErrorCoded('Can not have both \'@direction\' and \'@type\' in a value: ' +
              '\'{"@value":"abc","@direction":"rtl","@type":"abc"}\'',
              ERROR_CODES.INVALID_VALUE_OBJECT));
        });

        it('with a @value, @language, @direction and @type should throw an error', async () => {
          util.parsingContext.rdfDirection = 'i18n-datatype';
          return expect(util.valueToTerm(context, 'key',
            { '@value': 'abc', '@language': 'en', '@direction': 'rtl', '@type': 'abc' }, 0, []))
            .rejects.toThrow(new ErrorCoded('Can not have \'@language\', \'@direction\' ' +
              'and \'@type\' in a value: \'{"@value":"abc","@language":"en","@direction":"rtl","@type":"abc"}\'',
              ERROR_CODES.INVALID_VALUE_OBJECT));
        });

        it('with a @value and blank node @type', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc', '@type': '_:b' }, 0, []))
            .rejects.toThrow(new ErrorCoded('Illegal value type (BlankNode): _:b',
              ERROR_CODES.INVALID_TYPED_VALUE));
        });

        it('with context-based @json type', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@json' } });
          return expect(util.valueToTerm(context, 'key', { '@value': 'abc' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('{"@value":"abc"}',
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))]);
        });

        it('with @value-based @json type', async () => {
          return expect(util.valueToTerm(context, 'key', { '@value': { v: 'abc' }, '@type': '@json' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('{"v":"abc"}',
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))]);
        });

        it('with @value-based @json type that is aliased', async () => {
          context = new JsonLdContextNormalized({ json: { '@id': '@json' } });
          return expect(util.valueToTerm(context, 'key', { '@value': { v: 'abc' }, '@type': 'json' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('{"v":"abc"}',
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))]);
        });

        it('with @value-based and context-based @json type', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@json' } });
          return expect(util.valueToTerm(context, 'key', { '@value': { v: 'abc' }, '@type': '@json' }, 0, []))
            .resolves.toEqualRdfTermArray([DF.literal('{"@type":"@json","@value":{"v":"abc"}}',
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))]);
        });
      });

      describe('for a string', () => {
        it('should return a literal node', async () => {
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc')]);
        });

        it('with an @type: @id should return a named node', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@id' } });
          return expect(await util.valueToTerm(context, 'key', 'http://ex.org/', 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://ex.org/')]);
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://ex.org/' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('http://ex.org/'))]);
        });

        it('should consider a property-scoped context with @type: @vocab', async () => {
          context = new JsonLdContextNormalized(
            { key: { '@id': 'http://irrelevant', '@type': '@vocab', '@context': { abc: 'ex:abc' } } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.namedNode('ex:abc')]);
        });

        it('should consider a property-scoped context with @language', async () => {
          context = new JsonLdContextNormalized(
            { key: { '@id': 'http://irrelevant', '@context': { '@language': 'en' } } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', 'en')]);
        });

        it('with an @language: en-us should return a literal with that language', async () => {
          context = new JsonLdContextNormalized({ key: { '@language': 'en-us' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
        });

        it('with an @direction: rtl should return a plain literal', async () => {
          context = new JsonLdContextNormalized({ key: { '@language': 'en-us' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
        });

        it('with an @direction: rtl and rdfDirection undefined should return a plain literal', async () => {
          context = new JsonLdContextNormalized({ key: { '@direction': 'rtl' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', { language: '', direction: 'rtl' })]);
        });

        it('with an @direction: rtl, language and rdfDirection undefined should return a plain literal', async () => {
          context = new JsonLdContextNormalized({ key: { '@direction': 'rtl', '@language': 'en-us' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', { language: 'en-us', direction: 'rtl' })]);
        });

        it('with an @direction: rtl and rdfDirection i18n-datatype should return a plain literal', async () => {
          util.parsingContext.rdfDirection = 'i18n-datatype';
          context = new JsonLdContextNormalized({ key: { '@direction': 'rtl' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))]);
        });

        it('with an @direction: rtl, language and rdfDirection i18n-datatype should return a literal', async () => {
          util.parsingContext.rdfDirection = 'i18n-datatype';
          context = new JsonLdContextNormalized({ key: { '@direction': 'rtl', '@language': 'en-us' } });
          return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
            .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#en-us_rtl'))]);
        });

        describe('for language tags', () => {
          it('with a raw value and @language in the root context should return a language literal', async () => {
            context = new JsonLdContextNormalized({ '@language': 'en-us' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
          });

          it('with a raw value and @language in the context entry should return a language literal', async () => {
            context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
          });

          it('with a raw value and null @language in the context entry should return a literal without language',
            async () => {
              context = new JsonLdContextNormalized({ 'key': { '@language': null }, '@language': 'nl-be' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc')]);
            });

          it('with a raw value and @direction in the root context should return a plain literal', async () => {
            context = new JsonLdContextNormalized({ '@direction': 'rtl' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', { language: '', direction: 'rtl' })]);
          });

          it('with a raw value and @direction+@language in the root context should return a language literal',
            async () => {
              context = new JsonLdContextNormalized({ '@direction': 'rtl', '@language': 'en-us' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', { language: 'en-us', direction: 'rtl' })]);
            });

          it('with a raw value and @direction in the root context for rdfDirection i18n-datatype ' +
            'should return a plain literal', async () => {
            util.parsingContext.rdfDirection = 'i18n-datatype';
            context = new JsonLdContextNormalized({ '@direction': 'rtl' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))]);
          });

          it('with a raw value and @direction+@language in the root context for rdfDirection i18n-datatype ' +
            'should return a language literal',
            async () => {
              util.parsingContext.rdfDirection = 'i18n-datatype';
              context = new JsonLdContextNormalized({ '@direction': 'rtl', '@language': 'en-us' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#en-us_rtl'))]);
            });

          it('with a raw value and @direction in the context entry should return a plain literal', async () => {
            context = new JsonLdContextNormalized({ 'key': { '@direction': 'rtl' }, '@direction': 'ltr' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', { language: '', direction: 'rtl' })]);
          });

          it('with a raw value and null @direction in the context entry should return a plain literal',
            async () => {
              context = new JsonLdContextNormalized({ 'key': { '@direction': null }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc')]);
            });

          it('with a raw value and @direction+@language in the context entry should return a language literal',
            async () => {
              context = new JsonLdContextNormalized(
                { 'key': { '@direction': 'rtl', '@language': 'en-us' }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', { language: 'en-us', direction: 'rtl' })]);
            });

          it('with a raw value and null @direction+@language in the context entry should return a language literal',
            async () => {
              context = new JsonLdContextNormalized(
                { 'key': { '@direction': null, '@language': 'en-us' }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
            });

          it('with a raw value and @direction in the context entry should return a datatyped literal ' +
            'for rdfDirection i18n-datatype', async () => {
            util.parsingContext.rdfDirection = 'i18n-datatype';
            context = new JsonLdContextNormalized({ 'key': { '@direction': 'rtl' }, '@direction': 'ltr' });
            return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
              .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))]);
          });

          it('with a raw value and null @direction in the context entry should return a plain literal ' +
            'for rdfDirection i18n-datatype',
            async () => {
              util.parsingContext.rdfDirection = 'i18n-datatype';
              context = new JsonLdContextNormalized({ 'key': { '@direction': null }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc')]);
            });

          it('with a raw value and @direction+@language in the context entry should return a datatyped literal ' +
            'for rdfDirection i18n-datatype',
            async () => {
              util.parsingContext.rdfDirection = 'i18n-datatype';
              context = new JsonLdContextNormalized(
                { 'key': { '@direction': 'rtl', '@language': 'en-us' }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', DF.namedNode('https://www.w3.org/ns/i18n#en-us_rtl'))]);
            });

          it('with a raw value and null @direction+@language in the context entry should return a language literal ' +
            'for rdfDirection i18n-datatype',
            async () => {
              util.parsingContext.rdfDirection = 'i18n-datatype';
              context = new JsonLdContextNormalized(
                { 'key': { '@direction': null, '@language': 'en-us' }, '@direction': 'ltr' });
              return expect(await util.valueToTerm(context, 'key', 'abc', 0, []))
                .toEqualRdfTermArray([DF.literal('abc', 'en-us')]);
            });
        });
      });

      describe('for a boolean', () => {
        it('for true should return a boolean literal node', async () => {
          return expect(await util.valueToTerm(context, 'key', true, 0, []))
            .toEqualRdfTermArray([DF.literal('true', DF.namedNode(Util.XSD_BOOLEAN))]);
        });

        it('for false should return a boolean literal node', async () => {
          return expect(await util.valueToTerm(context, 'key', false, 0, []))
            .toEqualRdfTermArray([DF.literal('false', DF.namedNode(Util.XSD_BOOLEAN))]);
        });

        it('with an @type: @id with baseIRI should return a boolean literal node', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@type': '@id' }, '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', false, 0, []))
            .toEqualRdfTermArray([DF.literal('false', DF.namedNode(Util.XSD_BOOLEAN))]);
        });

        it('with an @type: @id should a boolean literal node', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@id' } });
          return expect(await util.valueToTerm(context, 'key', false, 0, []))
            .toEqualRdfTermArray([DF.literal('false', DF.namedNode(Util.XSD_BOOLEAN))]);
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://ex.org/' } });
          return expect(await util.valueToTerm(context, 'key', false, 0, []))
            .toEqualRdfTermArray([DF.literal('false', DF.namedNode('http://ex.org/'))]);
        });

        it('should ignore the language', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(await util.valueToTerm(context, 'key', false, 0, []))
            .toEqualRdfTermArray([DF.literal('false', DF.namedNode(Util.XSD_BOOLEAN))]);
        });
      });

      describe('for a number', () => {
        it('for 2 should return an integer literal node', async () => {
          return expect(await util.valueToTerm(context, 'key', 2, 0, []))
            .toEqualRdfTermArray([DF.literal('2', DF.namedNode(Util.XSD_INTEGER))]);
        });

        it('for 2.2 should return a double literal node', async () => {
          return expect(await util.valueToTerm(context, 'key', 2.2, 0, []))
            .toEqualRdfTermArray([DF.literal('2.2E0', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('with an @type: @id with baseIRI should return a double literal node', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@type': '@id' }, '@base': 'http://ex.org/' });
          return expect(await util.valueToTerm(context, 'key', 2.2, 0, []))
            .toEqualRdfTermArray([DF.literal('2.2E0', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('with an @type: @id should return a double literal node', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': '@id' } });
          return expect(await util.valueToTerm(context, 'key', 2.2, 0, []))
            .toEqualRdfTermArray([DF.literal('2.2E0', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://ex.org/' } });
          return expect(await util.valueToTerm(context, 'key', 2.2, 0, []))
            .toEqualRdfTermArray([DF.literal('2.2E0', DF.namedNode('http://ex.org/'))]);
        });

        it('should ignore the language', async () => {
          context = new JsonLdContextNormalized({ 'key': { '@language': 'en-us' }, '@language': 'nl-be' });
          return expect(await util.valueToTerm(context, 'key', 2, 0, []))
            .toEqualRdfTermArray([DF.literal('2', DF.namedNode(Util.XSD_INTEGER))]);
        });

        it('for Infinity should return a INF', async () => {
          return expect(await util.valueToTerm(context, 'key', Infinity, 0, []))
            .toEqualRdfTermArray([DF.literal('INF', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for -Infinity should return a -INF', async () => {
          return expect(await util.valueToTerm(context, 'key', -Infinity, 0, []))
            .toEqualRdfTermArray([DF.literal('-INF', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for 1e20 should return a 1.0E20 as an integer', async () => {
          return expect(await util.valueToTerm(context, 'key', 1e20, 0, []))
            .toEqualRdfTermArray([DF.literal('100000000000000000000', DF.namedNode(Util.XSD_INTEGER))]);
        });

        it('for 1e21 should return a 1.0E21 as a double', async () => {
          return expect(await util.valueToTerm(context, 'key', 1e21, 0, []))
            .toEqualRdfTermArray([DF.literal('1.0E21', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for 1e22 should return a 1.0E22 as a double', async () => {
          return expect(await util.valueToTerm(context, 'key', 1e22, 0, []))
            .toEqualRdfTermArray([DF.literal('1.0E22', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for 1 with double context type should return 1.0E0', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://www.w3.org/2001/XMLSchema#double' } });
          return expect(await util.valueToTerm(context, 'key', 1, 0, []))
            .toEqualRdfTermArray([DF.literal('1.0E0', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for 1.1 with int context type should return 1.1E0', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://www.w3.org/2001/XMLSchema#integer' } });
          return expect(await util.valueToTerm(context, 'key', 1.1, 0, []))
            .toEqualRdfTermArray([DF.literal('1.1E0', DF.namedNode(Util.XSD_INTEGER))]);
        });

        it('for 1 with dummy context type should return 1.0E0', async () => {
          context = new JsonLdContextNormalized({ key: { '@type': 'http://ex.org/' } });
          return expect(await util.valueToTerm(context, 'key', 1, 0, []))
            .toEqualRdfTermArray([DF.literal('1', DF.namedNode('http://ex.org/'))]);
        });

        it('for 100.1 with int context type should return 1.001E2', async () => {
          return expect(await util.valueToTerm(context, 'key', 100.1, 0, []))
            .toEqualRdfTermArray([DF.literal('1.001E2', DF.namedNode(Util.XSD_DOUBLE))]);
        });

        it('for 123.45 with int context type should return 1.001E2', async () => {
          return expect(await util.valueToTerm(context, 'key', 123.45, 0, []))
            .toEqualRdfTermArray([DF.literal('1.2345E2', DF.namedNode(Util.XSD_DOUBLE))]);
        });
      });

      describe('for an array', () => {
        it('should return []', async () => {
          return expect(await util.valueToTerm(context, 'key', [1, 2], 0, [])).toEqual([]);
        });
      });

      describe('for a list', () => {
        it('should return []', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@list': [1, 2] }, 0, [])).toEqual([]);
        });

        it('should return rdf:nil for an empty anonymous list', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@list': [] }, 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')]);
        });

        it('should return rdf:nil for an empty list', async () => {
          context = new JsonLdContextNormalized({ key: { '@container': { '@list': true } } });
          return expect(await util.valueToTerm(context, 'key', [], 0, []))
            .toEqualRdfTermArray([DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')]);
        });

        it('should return null for a list with null elements', async () => {
          context = new JsonLdContextNormalized({ key: { '@container': { '@list': true } } });
          return expect(await util.valueToTerm(context, 'key', [null, null], 0, [])).toEqual([]);
        });

        it('should error when other entries are present', async () => {
          return expect(util.valueToTerm(context, 'key', { '@list': [1, 2], 'a': 'b' }, 0, [])).rejects
            .toThrow(new ErrorCoded('Found illegal neighbouring entries next to @list for key: \'key\'',
              ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
        });

        it('should error when @id is present', async () => {
          return expect(util.valueToTerm(context, 'key', { '@list': [1, 2], '@id': 'b' }, 0, [])).rejects
            .toThrow(new ErrorCoded('Found illegal neighbouring entries next to @list for key: \'key\'',
              ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
        });
      });

      describe('for a set', () => {
        it('should return []', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@set': [1, 2] }, 0, [])).toEqual([]);
        });

        it('should error when other entries are present', async () => {
          return expect(util.valueToTerm(context, 'key', { '@set': [1, 2], 'a': 'b' }, 0, [])).rejects
            .toThrow(new ErrorCoded('Found illegal neighbouring entries next to @set for key: \'key\'',
              ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
        });
      });

      describe('for a reverse properties', () => {
        it('should return []', async () => {
          return expect(await util.valueToTerm(context, 'key', { '@reverse': {} }, 0, [])).toEqual([]);
        });
      });
    });

    describe('#getPropertiesDepth', () => {
      it('should return depth for a string parent', async () => {
        expect(await util.getPropertiesDepth([null, 'a', 'b'], 2)).toBe(2);
      });

      it('should return depth - 1 for a @reverse parent', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@reverse', 'b'], 3)).toBe(2);
      });

      it('should return depth - 1 for an aliased @reverse parent', async () => {
        util.parsingContext.contextTree.setContext([null, 'a'],
          Promise.resolve(new JsonLdContextNormalized({ reverse: '@reverse' })));
        expect(await util.getPropertiesDepth([null, 'a', 'reverse', 'b'], 3)).toBe(2);
      });

      it('should return depth - 1 for a @nest parent', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@nest', 'b'], 3)).toBe(2);
      });

      it('should return depth - 1 for an aliased @nest parent', async () => {
        util.parsingContext.contextTree.setContext([null, 'a'],
          Promise.resolve(new JsonLdContextNormalized({ nest: '@nest' })));
        expect(await util.getPropertiesDepth([null, 'a', 'nest', 'b'], 3)).toBe(2);
      });

      it('should return depth - 1 for a @nest parent within an array', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@nest', 0, 'b'], 4)).toBe(2);
      });

      it('should return depth - 1 for a @nest parent within arrays', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@nest', 0, 1, 2, 'b'], 6)).toBe(2);
      });

      it('should return depth - 1 for a @nest parent within an array above @nest', async () => {
        expect(await util.getPropertiesDepth([null, 'a', 0, '@nest', 'b'], 4)).toBe(3);
      });

      it('should return depth - 1 for multiple @nest parents', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@nest', '@nest', '@nest', 'b'], 5)).toBe(2);
      });

      it('should return depth - 1 for multiple @nest parents and arrays', async () => {
        expect(await util.getPropertiesDepth([null, 'a', '@nest', 0, '@nest', 0, 0, '@nest', 0, 'b'], 9)).toBe(2);
      });
    });

  });

});
