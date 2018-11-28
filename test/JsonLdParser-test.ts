import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import * as dataFactory from "@rdfjs/data-model";
import {blankNode, defaultGraph, literal, namedNode, quad, triple} from "@rdfjs/data-model";
import each from 'jest-each';
import "jest-rdf";

describe('JsonLdParser', () => {

  describe('#getContextValue', () => {
    it('should return the fallback when the context does not contain the given key', async () => {
      expect(JsonLdParser.getContextValue({}, 'a', 'x', 'FB')).toEqual('FB');
    });

    it('should return the fallback when the context contains the given key, without contextKey', async () => {
      expect(JsonLdParser.getContextValue({ x: {} }, 'a', 'x', 'FB')).toEqual('FB');
    });

    it('should return the value when the context contains the given key, with contextKey', async () => {
      expect(JsonLdParser.getContextValue({ x: { a: 'b' } }, 'a', 'x', 'FB')).toEqual('b');
    });
  });

  describe('#getContextValueContainer', () => {
    it('should return @set as default', async () => {
      expect(JsonLdParser.getContextValueContainer({}, 'abc')).toEqual('@set');
    });

    it('should return @list when defined as such', async () => {
      expect(JsonLdParser.getContextValueContainer({ abc: { '@container': '@list' } }, 'abc'))
        .toEqual('@list');
    });
  });

  describe('#getContextValueType', () => {
    it('should return null as default', async () => {
      expect(JsonLdParser.getContextValueType({}, 'abc')).toBe(null);
    });

    it('should return @id when defined as such', async () => {
      expect(JsonLdParser.getContextValueType({ abc: { '@type': '@id' } }, 'abc'))
        .toEqual('@id');
    });
  });

  describe('#getContextValueLanguage', () => {
    it('should return null as default', async () => {
      expect(JsonLdParser.getContextValueLanguage({}, 'abc')).toBe(null);
    });

    it('should return @language on root as default if available', async () => {
      expect(JsonLdParser.getContextValueLanguage({ '@language': 'nl-be' }, 'abc')).toBe('nl-be');
    });

    it('should return the entry language', async () => {
      expect(JsonLdParser.getContextValueLanguage({ abc: { '@language': 'en-us' } }, 'abc'))
        .toEqual('en-us');
    });

    it('should return the null entry language even if a root @language is present', async () => {
      expect(JsonLdParser.getContextValueLanguage({ 'abc': { '@language': null }, '@language': 'nl-be'  }, 'abc'))
        .toEqual(null);
    });
  });

  describe('#isContextValueReverse', () => {
    it('should return false as default', async () => {
      expect(JsonLdParser.isContextValueReverse({}, 'abc')).toBe(false);
    });

    it('should return true when defined as such', async () => {
      expect(JsonLdParser.isContextValueReverse({ abc: { '@reverse': 'bla' } }, 'abc')).toBe(true);
    });
  });

  describe('#isPropertyReverse', () => {
    it('should return false as default', async () => {
      expect(JsonLdParser.isPropertyReverse({}, 'abc', 'def')).toBe(false);
    });

    it('should return true when the parent key is @reverse', async () => {
      expect(JsonLdParser.isPropertyReverse({}, 'abc', '@reverse')).toBe(true);
    });

    it('should return true when the key has @reverse in the context', async () => {
      expect(JsonLdParser.isPropertyReverse({ abc: { '@reverse': 'bla' } }, 'abc', 'def')).toBe(true);
    });
  });

  describe('when instantiated without a data factory and context', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser();
    });

    it('should have a default data factory', async () => {
      expect(parser.dataFactory).toBeTruthy();
    });

    it('should have a default root context', async () => {
      expect(await parser.rootContext).toEqual({ '@base': undefined });
    });
  });

  describe('when instantiated without a data factory and with a context', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ context: { SomeTerm: 'http://example.org/' } });
    });

    it('should have a default data factory', async () => {
      expect(parser.dataFactory).toBeTruthy();
    });

    it('should have no root context', async () => {
      expect(await parser.rootContext).toEqual({ SomeTerm: 'http://example.org/' });
    });
  });

  each ([
    false,
    true,
  ]).describe('when instantiated with a data factory and allowOutOfOrderContext %s', (allowOutOfOrderContext) => {
    // Enable the following instead if you want to run tests more conveniently with IDE integration
  /*describe('when instantiated with a data factory and allowOutOfOrderContext %s', () => {
    const allowOutOfOrderContext = false;*/
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext });
    });

    describe('#valueToTerm', () => {

      let context;

      beforeEach(() => {
        context = {};
      });

      describe('for an unknown type', () => {
        it('should emit an error', async () => {
          return new Promise(async (resolve, reject) => {
            parser.on('error', () => resolve());
            parser.valueToTerm(context, 'key', Symbol(), 0);
          });
        });
      });

      describe('for an object', () => {
        it('without an @id should return null', async () => {
          return expect(await parser.valueToTerm(context, 'key', {}, 0))
            .toEqual(null);
        });

        it('without an @id should return a blank node when a value was emitted at a deeper depth', async () => {
          parser.emittedStack[1] = true;
          return expect(await parser.valueToTerm(context, 'key', {}, 0))
            .toEqualRdfTerm(blankNode());
        });

        it('without an @id should put a blank node on the id stack when a value was emitted at a deeper depth',
          async () => {
            parser.emittedStack[1] = true;
            await parser.valueToTerm(context, 'key', {}, 0);
            return expect(parser.idStack[1]).toEqualRdfTerm(blankNode());
          });

        it('with an @id should return a named node', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@id': 'http://ex.org' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org'));
        });

        it('with a relative @id without @base in context should return a named node', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@id': 'abc' }, 0))
            .toEqualRdfTerm(namedNode('abc'));
        });

        it('with a relative @id with @base in context should return a named node', async () => {
          context = { '@base': 'http://ex.org/' };
          return expect(await parser.valueToTerm(context, 'key', { '@id': 'abc' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org/abc'));
        });

        it('with an empty @id with @base in context should return a named node', async () => {
          context = { '@base': 'http://ex.org/' };
          return expect(await parser.valueToTerm(context, 'key', { '@id': '' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org/'));
        });

        it('with a relative @id with baseIRI should return a named node', async () => {
          parser = new JsonLdParser({ baseIRI: 'http://ex.org/' });
          return expect(await parser.valueToTerm(await parser.getContext(0), 'key', { '@id': 'abc' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org/abc'));
        });

        it('with an empty @id with baseIRI should return a named node', async () => {
          parser = new JsonLdParser({ baseIRI: 'http://ex.org/' });
          return expect(await parser.valueToTerm(await parser.getContext(0), 'key', { '@id': '' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org/'));
        });

        it('with an @value should return a literal', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@value': 'abc' }, 0))
            .toEqualRdfTerm(literal('abc'));
        });

        it('with an @value and @language should return a language-tagged string literal', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'en-us' }, 0))
            .toEqualRdfTerm(literal('abc', 'en-us'));
        });

        it('with an @value and @type should return a typed literal', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@value': 'abc', '@type': 'http://type.com' }, 0))
            .toEqualRdfTerm(literal('abc', namedNode('http://type.com')));
        });

        it('with a @value value and @language in the context entry should return a language literal', async () => {
          context = { 'key': { '@language': 'en-us' }, '@language': 'nl-be' };
          return expect(await parser.valueToTerm(context, 'key', { '@value': 'abc', '@language': 'nl-nl' }, 0))
            .toEqualRdfTerm(literal('abc', 'nl-nl'));
        });

        it('with a @value without @language should reset the language', async () => {
          context = { 'key': { '@language': 'en-us' }, '@language': 'nl-be' };
          return expect(await parser.valueToTerm(context, 'key', { '@value': 'abc' }, 0))
            .toEqualRdfTerm(literal('abc'));
        });

        it('with a raw value and @language in the root context should return a language literal', async () => {
          context = { '@language': 'en-us' };
          return expect(await parser.valueToTerm(context, 'key', 'abc', 0))
            .toEqualRdfTerm(literal('abc', 'en-us'));
        });

        it('with a raw value and @language in the context entry should return a language literal', async () => {
          context = { 'key': { '@language': 'en-us' }, '@language': 'nl-be' };
          return expect(await parser.valueToTerm(context, 'key', 'abc', 0))
            .toEqualRdfTerm(literal('abc', 'en-us'));
        });

        it('with a raw value and null @language in the context entry should return a literal without language',
          async () => {
            context = { 'key': { '@language': null }, '@language': 'nl-be' };
            return expect(await parser.valueToTerm(context, 'key', 'abc', 0))
              .toEqualRdfTerm(literal('abc'));
          });
      });

      describe('for a string', () => {
        it('should return a literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', 'abc', 0)).toEqualRdfTerm(literal('abc'));
        });

        it('with an @type: @id should return a named node', async () => {
          context = { key: { '@type': '@id' } };
          return expect(await parser.valueToTerm(context, 'key', 'http://ex.org/', 0))
            .toEqualRdfTerm(namedNode('http://ex.org/'));
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = { key: { '@type': 'http://ex.org/' } };
          return expect(await parser.valueToTerm(context, 'key', 'abc', 0))
            .toEqualRdfTerm(literal('abc', namedNode('http://ex.org/')));
        });
      });

      describe('for a boolean', () => {
        it('for true should return a boolean literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', true, 0))
            .toEqualRdfTerm(literal('true', namedNode(JsonLdParser.XSD_BOOLEAN)));
        });

        it('for false should return a boolean literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', false, 0))
            .toEqualRdfTerm(literal('false', namedNode(JsonLdParser.XSD_BOOLEAN)));
        });

        it('with an @type: @id should return a named node', async () => {
          context = { key: { '@type': '@id' } };
          return expect(await parser.valueToTerm(context, 'key', false, 0))
            .toEqualRdfTerm(namedNode('false'));
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = { key: { '@type': 'http://ex.org/' } };
          return expect(await parser.valueToTerm(context, 'key', false, 0))
            .toEqualRdfTerm(literal('false', namedNode('http://ex.org/')));
        });

        it('should ignore the language', async () => {
          context = { 'key': { '@language': 'en-us' }, '@language': 'nl-be' };
          return expect(await parser.valueToTerm(context, 'key', false, 0))
            .toEqualRdfTerm(literal('false', namedNode(JsonLdParser.XSD_BOOLEAN)));
        });
      });

      describe('for a number', () => {
        it('for 2 should return an integer literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', 2, 0))
            .toEqualRdfTerm(literal('2', namedNode(JsonLdParser.XSD_INTEGER)));
        });

        it('for 2.2 should return a double literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(literal('2.2E0', namedNode(JsonLdParser.XSD_DOUBLE)));
        });

        it('with an @type: @id should return a named node', async () => {
          context = { key: { '@type': '@id' } };
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(namedNode('2.2E0'));
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = { key: { '@type': 'http://ex.org/' } };
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(literal('2.2E0', namedNode('http://ex.org/')));
        });

        it('should ignore the language', async () => {
          context = { 'key': { '@language': 'en-us' }, '@language': 'nl-be' };
          return expect(await parser.valueToTerm(context, 'key', 2, 0))
            .toEqualRdfTerm(literal('2', namedNode(JsonLdParser.XSD_INTEGER)));
        });

        it('for Infinity should return a INF', async () => {
          return expect(await parser.valueToTerm(context, 'key', Infinity, 0))
            .toEqualRdfTerm(literal('INF', namedNode(JsonLdParser.XSD_DOUBLE)));
        });

        it('for -Infinity should return a -INF', async () => {
          return expect(await parser.valueToTerm(context, 'key', -Infinity, 0))
            .toEqualRdfTerm(literal('-INF', namedNode(JsonLdParser.XSD_DOUBLE)));
        });
      });

      describe('for an array', () => {
        it('should return null', async () => {
          return expect(await parser.valueToTerm(context, 'key', [1, 2], 0)).toBeFalsy();
        });
      });

      describe('for a list', () => {
        it('should return null', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@list': [1, 2] }, 0)).toBeFalsy();
        });

        it('should return rdf:nil for an empty anonymous list', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@list': [] }, 0))
            .toEqual(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'));
        });

        it('should return rdf:nil for an empty list', async () => {
          context = { key: { '@container': '@list' } };
          return expect(await parser.valueToTerm(context, 'key', [], 0))
            .toEqual(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'));
        });
      });

      describe('for a reverse properties', () => {
        it('should return null', async () => {
          return expect(await parser.valueToTerm(context, 'key', { '@reverse': {} }, 0)).toBeFalsy();
        });
      });
    });

    describe('should parse', () => {
      it('an empty document', async () => {
        const stream = streamifyString(`{}`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
      });

      it('an empty document with a valid processing mode', async () => {
        const stream = streamifyString(`{ "@context": { "@version": "1.0" } }`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
      });

      it('an empty document with a non-default processing mode when configured as such', async () => {
        parser = new JsonLdParser({ processingMode: '1.1' });
        const stream = streamifyString(`{ "@context": { "@version": "1.1" } }`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
      });

      it('an empty array', async () => {
        const stream = streamifyString(`[]`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
      });

      describe('a single triple', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with blank node @id', async () => {
          const stream = streamifyString(`
{
  "@id": "_:myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id and literal value that *looks* like a blank node', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "_:obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('_:obj1')),
          ]);
        });

        it('with @id and blank node value', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@id": "_:obj1" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('true', namedNode(JsonLdParser.XSD_BOOLEAN))),
          ]);
        });

        it('with @id and a number literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": 2.2
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('2.2E0', namedNode(JsonLdParser.XSD_DOUBLE))),
          ]);
        });

        it('with @id and a typed literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@type": "http://ex.org/mytype"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a prefixed, typed literal', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/"
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@type": "ex:mytype"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a prefixed, context-typed literal', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@type": "ex:mytype" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and another prefixed, context-typed literal', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "created": {"@id": "http://purl.org/dc/terms/created", "@type": "xsd:date"}
  },
  "@id":  "http://greggkellogg.net/foaf#me",
  "created":  "1957-02-27"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://greggkellogg.net/foaf#me'), namedNode('http://purl.org/dc/terms/created'),
              literal('1957-02-27', namedNode('http://www.w3.org/2001/XMLSchema#date'))),
          ]);
        });

        it('with @id and a context-language literal', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@language": "en-us" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', 'en-us')),
          ]);
        });

        it('with @id and literal with default language', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', 'en-us')),
          ]);
        });

        it('with @id and literal with default language but overridden language', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@language": "nl-be" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', 'nl-be')),
          ]);
        });

        it('with @id and literal with default language but unset language', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@language": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value')),
          ]);
        });

        it('with @id and language map', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@language" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('忍者', 'ja')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja', 'en')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Nindža', 'cs')),
          ]);
        });

        it('with @id and language map with an array value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@language" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": [ "Ninja", "Ninja2" ],
    "cs": "Nindža"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('忍者', 'ja')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja', 'en')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja2', 'en')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Nindža', 'cs')),
          ]);
        });

        it('with @id and index map', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('忍者')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Nindža')),
          ]);
        });

        it('with @id and index map with an array value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": [ "Ninja", "Ninja2" ],
    "cs": "Nindža"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('忍者')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Nindža')),
          ]);
        });

        it('with @id and index map', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('忍者')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Ninja')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('Nindža')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@type": "http://ex.org/mytype",
    "@value": "my value"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in a @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@type": "http://ex.org/mytype",
      "@value": "my value"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in an o-o-o @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  },
  "@id": "http://ex.org/mygraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in an anonymous @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in a @graph array', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@type": "http://ex.org/mytype",
      "@value": "my value"
    }
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in an o-o-o @graph array', async () => {
          const stream = streamifyString(`
{
  "@graph": [{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  }],
  "@id": "http://ex.org/mygraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in an anonymous @graph array', async () => {
          const stream = streamifyString(`
{
  "@graph": [{
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in a double @graph array', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [[{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@type": "http://ex.org/mytype",
      "@value": "my value"
    }
  }]]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in a double o-o-o @graph array', async () => {
          const stream = streamifyString(`
{
  "@graph": [[{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  }]],
  "@id": "http://ex.org/mygraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with @id and a typed literal with out-of-order @value in a double anonymous @graph array', async () => {
          const stream = streamifyString(`
{
  "@graph": [[{
    "http://ex.org/pred1": {
      "@value": "my value",
      "@type": "http://ex.org/mytype"
    }
  }]]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });
      });

      describe('a single anonymously reversed triple', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "@reverse": {
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@reverse": {
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('without @id and with @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/g",
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('without @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('with @id and with @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/g",
  "@graph": {
    "@id": "http://ex.org/myid",
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "@reverse": {
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });
      });

      describe('a single context-based reversed triple', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "p": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
   "p": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@graph": {
    "p": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('without @id and with @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/g",
  "@graph": {
    "p": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('without @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@graph": {
    "p": "http://ex.org/obj1"
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@graph": {
    "@id": "http://ex.org/myid",
    "p": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('with @id and with @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/g",
  "@graph": {
    "@id": "http://ex.org/myid",
    "p": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@graph": {
    "@id": "http://ex.org/myid",
    "p": "http://ex.org/obj1"
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(literal('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });
      });

      describe('a single triple in an array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
[{
  "http://ex.org/pred1": "http://ex.org/obj1"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('true', namedNode(JsonLdParser.XSD_BOOLEAN))),
          ]);
        });

        it('with @id and a number literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": 2.2
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('2.2E0', namedNode(JsonLdParser.XSD_DOUBLE))),
          ]);
        });

        it('with @id and a typed literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@type": "http://ex.org/mytype"
  }
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and a language literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@language": "en-us"
  }
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', 'en-us')),
          ]);
        });

        it('with @id and and incomplete language literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@language": "en-us"
  }
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
[{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });
      });

      describe('three triples', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "http://ex.org/pred2": "http://ex.org/obj2",
  "http://ex.org/pred3": "http://ex.org/obj3"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode('a'), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1",
  "http://ex.org/pred2": "http://ex.org/obj2",
  "http://ex.org/pred3": "http://ex.org/obj3"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid",
  "http://ex.org/pred2": "http://ex.org/obj2",
  "http://ex.org/pred3": "http://ex.org/obj3"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });
      });

      describe('three triples inside separate arrays', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
[
  { "http://ex.org/pred1": "http://ex.org/obj1" },
  { "http://ex.org/pred2": "http://ex.org/obj2" },
  { "http://ex.org/pred3": "http://ex.org/obj3" }
]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
[
  { "@id": "http://ex/A", "http://ex.org/pred1": "http://ex.org/obj1" },
  { "@id": "http://ex/B", "http://ex.org/pred2": "http://ex.org/obj2" },
  { "@id": "http://ex/C", "http://ex.org/pred3": "http://ex.org/obj3" }
]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex/A'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(namedNode('http://ex/B'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex/C'), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });

        it('with o-o-o @id', async () => {
          const stream = streamifyString(`
[
  { "http://ex.org/pred1": "http://ex.org/obj1", "@id": "http://ex/A" },
  { "http://ex.org/pred2": "http://ex.org/obj2", "@id": "http://ex/B" },
  { "http://ex.org/pred3": "http://ex.org/obj3", "@id": "http://ex/C" }
]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex/A'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(namedNode('http://ex/B'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex/C'), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });
      });

      describe('a triple with an array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [ "a", "b", "c" ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": [ "a", "b", "c" ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [ "a", "b", "c" ],
  "@id": "http://ex.org/myid",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });
      });

      describe('a triple with an anonymous list array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('without @id and an empty list', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode(JsonLdParser.RDF + 'nil')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] },
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });
      });

      describe('a triple with a context-based list array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "p": [ "a", "b", "c" ]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('without @id and an empty list', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "p": []
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode(JsonLdParser.RDF + 'nil')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "p": [ "a", "b", "c" ]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);

          expect(output[0].subject).toEqual(output[1].subject);
          expect(output[2].subject).toEqual(output[3].subject);
          expect(output[4].subject).toEqual(output[5].subject);

          expect(output[6].object).toEqual(output[0].subject);
          expect(output[1].object).toEqual(output[2].subject);
          expect(output[3].object).toEqual(output[4].subject);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "p": [ "a", "b", "c" ],
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);

          expect(output[0].subject).toEqual(output[1].subject);
          expect(output[2].subject).toEqual(output[3].subject);
          expect(output[4].subject).toEqual(output[5].subject);

          expect(output[6].object).toEqual(output[0].subject);
          expect(output[1].object).toEqual(output[2].subject);
          expect(output[3].object).toEqual(output[4].subject);
        });
      });

      describe('two nested triple', () => {
        it('without @id and without inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          return expect(output).toBeRdfIsomorphic([
            triple(blankNode('b'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('b')),
          ]);
        });

        it('with @id and without inner @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output[1].subject).toEqual(output[0].object);
          return expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('a')),
            triple(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('with out-of-order @id and without inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2"
  },
  "@id": "http://ex.org/myid"
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output[0].subject).toEqual(output[1].object);
          return expect(output).toBeRdfIsomorphic([
            triple(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('a')),
          ]);
        });

        it('without @id and with inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myinnerid')),
          ]);
        });

        it('with @id and with inner @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myinnerid')),
          ]);
        });

        it('with out-of-order @id and with inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myinnerid')),
          ]);
        });

        it('without @id and with out-of-order inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myinnerid')),
          ]);
        });

        it('with @id and with out-of-order inner @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myinnerid')),
          ]);
        });

        it('with out-of-order @id and with out-of-order inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2",
    "@id": "http://ex.org/myinnerid"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myinnerid')),
          ]);
        });
      });

      describe('a single quad', () => {
        it('without @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
     "@id": "http://ex.org/myinnerid",
     "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), defaultGraph()),
          ]);
        });

        it('with @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('with @id with inner subject @id and @type', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "@type": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), defaultGraph()),
          ]);
        });

        it('with @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'), defaultGraph()),
          ]);
        });

        it('with @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
          ]);
        });
      });

      describe('two quads', () => {
        it('without @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
     "@id": "http://ex.org/myinnerid",
     "http://ex.org/pred1": "http://ex.org/obj1",
     "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), defaultGraph()),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), defaultGraph()),
          ]);
        });

        it('with @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2",
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), defaultGraph()),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), defaultGraph()),
          ]);
        });

        it('with @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id with out-of-order inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred2": "http://ex.org/obj2"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred2'),
              literal('http://ex.org/obj2'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'), defaultGraph()),
            quad(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'), defaultGraph()),
          ]);
        });

        it('with @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('with out-of-order @id and without inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
              namedNode('http://ex.org/myid')),
          ]);
        });
      });

      describe('nested quads', () => {
        it('without @id, without middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@graph": {
       "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), blankNode()),
          ]);
        });

        it('with @id, without middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), blankNode()),
          ]);
        });

        it('with out-of-order @id, without middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1",
    }
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), blankNode()),
          ]);
        });

        it('without @id, with middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/mymiddleid",
    "@graph": {
       "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

        it('with @id, with middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@id": "http://ex.org/mymiddleid",
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

        it('with out-of-order @id, with middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/mymiddleid",
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1",
    }
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

        it('without @id, with out-of-order middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@graph": {
       "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    },
    "@id": "http://ex.org/mymiddleid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

        it('with @id, with out-of-order middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1"
    },
    "@id": "http://ex.org/mymiddleid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

        it('with out-of-order @id, with out-of-order middle @id with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@graph": {
      "@id": "http://ex.org/myinnerid",
      "http://ex.org/pred1": "http://ex.org/obj1",
    },
    "@id": "http://ex.org/mymiddleid"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
          ]);
        });

      });

      describe('quads with nested properties', () => {
        it('with an in-order @graph id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner'),
              namedNode('http://ex.org/mygraph')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an o-o-o @graph id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  },
  "@id": "http://ex.org/mygraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner'),
              namedNode('http://ex.org/mygraph')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with no @graph id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with an in-order @graph id in an array', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner'),
              namedNode('http://ex.org/mygraph')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an in-order @graph id in an array with @type', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@id": "http://ex.org/myid",
    "@type": "http://ex.org/mytype"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/mytype'),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an in-order @graph id in an array with @type array', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@id": "http://ex.org/myid",
    "@type": [ "http://ex.org/mytype1", "http://ex.org/mytype2" ]
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/mytype1'),
              namedNode('http://ex.org/mygraph')),
            quad(namedNode('http://ex.org/myid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/mytype2'),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an o-o-o @graph id in an array', async () => {
          const stream = streamifyString(`
{
  "@graph": [{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  }],
  "@id": "http://ex.org/mygraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner'),
              namedNode('http://ex.org/mygraph')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype')),
              namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with no @graph id in an array', async () => {
          const stream = streamifyString(`
{
  "@graph": [{
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": {
      "@id": "http://ex.org/myidinner",
      "http://ex.org/pred2": {
        "@value": "my value",
        "@type": "http://ex.org/mytype"
      }
    }
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myidinner')),
            quad(namedNode('http://ex.org/myidinner'), namedNode('http://ex.org/pred2'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });
      });

      describe('a top-level context', () => {
        it('without other triples', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with a single unrelated triple', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with a single contextified triple', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "SomeTerm": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://example.org/SomeTerm'), literal('http://ex.org/obj1')),
          ]);
        });

        describe('with an inner context', () => {
          it('without other inner triples', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with a single unrelated triple', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "http://ex.org/pred1": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    },
    "@id": "http://ex.org/obj1"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a single contextified triple', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "SomeTerm": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    },
    "@id": "http://ex.org/obj1"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a two contextified triples', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "SomeTerm": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    },
    "@id": "http://ex.org/obj1",
    "SomeInnerTerm": "abc"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://ex.org/obj1'), namedNode('http://example.org/SomeInnerTerm'),
                literal('abc')),
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a two contextified triples with overlapping contexts', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "SomeTerm": {
    "@context": {
      "SomeTerm": "http://example.org/SomeInnerTerm"
    },
    "@id": "http://ex.org/obj1",
    "SomeTerm": "abc"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://ex.org/obj1'), namedNode('http://example.org/SomeInnerTerm'),
                literal('abc')),
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('should emit an error when a context parsing error occurs', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "SomeTerm": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    },
    "@id": "http://ex.org/obj1"
  }
}`);
            parser.contextParser.parse = () => Promise.reject(new Error('Dummy parsing error'));
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });
        });

        it('with @base without triples', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @base and @vocab with triples', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
    "@vocab":  "http://ex.org/"
  },
  "@id": "",
  "pred": { "@id": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/'), namedNode('http://ex.org/pred'),
              namedNode('http://example.org/bla')),
          ]);
        });

        it('with @base and @vocab with triples, with @base=null', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": null,
    "@vocab":  "http://ex.org/"
  },
  "@id": "abc",
  "pred": { "@id": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('abc'), namedNode('http://ex.org/pred'),
              namedNode('bla')),
          ]);
        });

        it('with @base and @vocab with triples, with @vocab=null', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
    "@vocab": null
  },
  "@id": "",
  "pred": { "@id": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/'), namedNode('pred'),
              namedNode('http://example.org/bla')),
          ]);
        });

        it('with @vocab with triples, with a term set to null', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignore": null
  },
  "@id": "abc",
  "pred": { "@id": "bla" },
  "ignore": { "@id": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('abc'), namedNode('http://example.org/pred'),
              namedNode('bla')),
            triple(namedNode('abc'), namedNode('ignore'),
              namedNode('bla')),
          ]);
        });
      });

      it('with a null inner context', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignore": null
  },
  "@id": "abc",
  "pred1": {
    "@context": null,
    "@id": "bla",
    "pred2": {
      "@id": "blabla"
    }
  }
}`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
          triple(namedNode('abc'), namedNode('http://example.org/pred1'),
            namedNode('bla')),
          triple(namedNode('bla'), namedNode('pred2'),
            namedNode('blabla')),
        ]);
      });

      describe('allowing an out-of-order context', () => {

        beforeEach(() => {
          parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext: true });
        });

        describe('an out-of-order context', () => {
          it('with a single unrelated triple', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            ]);
          });

          it('with a single contextified triple', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": "http://ex.org/obj1",
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), literal('http://ex.org/obj1')),
            ]);
          });

          it('with @base and @vocab with triples', async () => {
            const stream = streamifyString(`
{
  "@id": "",
  "pred": { "@id": "bla" },
  "@context": {
    "@base": "http://example.org/",
    "@vocab":  "http://ex.org/"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://example.org/'), namedNode('http://ex.org/pred'),
                namedNode('http://example.org/bla')),
            ]);
          });
        });

        describe('with an out-of-order inner context', () => {

          it('with a single unrelated triple', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "@id": "http://ex.org/obj1",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a single contextified triple', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a contextified inner triple should inherit from the outer context', async () => {
            const stream = streamifyString(`
{
  "@id": "A",
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "SomeInnerTerm": "B",
    "@context": {
      "SomeInnerTerm2": "http://example.org/SomeInnerTerm2"
    }
  },
  "@context": {
    "@base": "http://example.org/",
    "SomeTerm": "http://example.org/SomeTerm",
    "SomeInnerTerm": "http://example.org/SomeInnerTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://example.org/A'), namedNode('http://example.org/SomeTerm'),
                namedNode('http://ex.org/obj1')),
              triple(namedNode('http://ex.org/obj1'), namedNode('http://example.org/SomeInnerTerm'),
                literal('B')),
            ]);
          });

          it('with a two contextified triples', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "SomeInnerTerm": "abc",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://ex.org/obj1'), namedNode('http://example.org/SomeInnerTerm'),
                literal('abc')),
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });

          it('with a two contextified triples with overlapping contexts', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "SomeTerm": "abc",
    "@context": {
      "SomeTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://ex.org/obj1'), namedNode('http://example.org/SomeInnerTerm'),
                literal('abc')),
              triple(blankNode(), namedNode('http://example.org/SomeTerm'), namedNode('http://ex.org/obj1')),
            ]);
          });
        });

      });

      describe('not allowing an out-of-order context', () => {

        beforeEach(() => {
          parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext: false });
        });

        describe('an out-of-order context', () => {
          it('with a single unrelated triple', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with a single contextified triple', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": "http://ex.org/obj1",
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with @base and @vocab with triples', async () => {
            const stream = streamifyString(`
{
  "@id": "",
  "pred": { "@id": "bla" },
  "@context": {
    "@base": "http://example.org/",
    "@vocab":  "http://ex.org/"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });
        });

        describe('with an out-of-order inner context', () => {

          it('with a single unrelated triple', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "@id": "http://ex.org/obj1",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with a single contextified triple', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with a two contextified triples', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "SomeInnerTerm": "abc",
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with a two contextified triples with overlapping contexts', async () => {
            const stream = streamifyString(`
{
  "SomeTerm": {
    "@id": "http://ex.org/obj1",
    "SomeTerm": "abc",
    "@context": {
      "SomeTerm": "http://example.org/SomeInnerTerm"
    }
  },
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });
        });

      });

      describe('@type', () => {
        it('on an anonymous node', async () => {
          const stream = streamifyString(`
{
  "@type": "http://example.org/abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node', async () => {
          const stream = streamifyString(`
{
  "@id": "http://example.org/node",
  "@type": "http://example.org/abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node with a prefixed @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://example.org/"
  },
  "@id": "http://example.org/node",
  "@type": "ex:abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node in a @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://example.org/myGraph",
  "@graph": {
    "@id": "http://example.org/node",
    "@type": "http://example.org/abc"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc'),
              namedNode('http://example.org/myGraph')),
          ]);
        });

        it('on a named node in an out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://example.org/node",
    "@type": "http://example.org/abc"
  },
  "@id": "http://example.org/myGraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc'),
              namedNode('http://example.org/myGraph')),
          ]);
        });

        it('on an out-of-order named node', async () => {
          const stream = streamifyString(`
{
  "@type": "http://example.org/abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node with multiple @types', async () => {
          const stream = streamifyString(`
{
  "@id": "http://example.org/node",
  "@type": [
    "http://example.org/abc1",
    "http://example.org/abc2",
    "http://example.org/abc3"
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc1')),
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc2')),
            triple(namedNode('http://example.org/node'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/abc3')),
          ]);
        });
      });

      describe('@type in the context', () => {
        it('with value @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" }
  },
  "p": "http://example.org/abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://example.org/abc')),
          ]);
        });
      });

      describe('with blank node predicates', () => {
        describe('when produceGeneralizedRdf is false', () => {
          it('should ignore blank node predicates', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@type": "@id" }
  },
  "p": "http://example.org/abc"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('should ignore blank node predicates with multiple values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@type": "@id" }
  },
  "p": [
    "http://example.org/abc1",
    "http://example.org/abc2"
  ]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('should ignore blank node predicates in a list', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "p": [ "a", "b", "c" ],
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('should ignore blank node predicates in an anonymous list', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ "a", "b", "c" ] },
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });
        });

        describe('when produceGeneralizedRdf is true', () => {

          beforeEach(() => {
            parser = new JsonLdParser({ produceGeneralizedRdf: true });
          });

          it('should not ignore blank node predicates', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@type": "@id" }
  },
  "p": "http://example.org/abc"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), blankNode('p'), namedNode('http://example.org/abc')),
            ]);
          });

          it('should not ignore blank node predicates with multiple values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@type": "@id" }
  },
  "p": [
    "http://example.org/abc1",
    "http://example.org/abc2"
  ]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode('a'), blankNode('p'), namedNode('http://example.org/abc1')),
              triple(blankNode('a'), blankNode('p'), namedNode('http://example.org/abc2')),
            ]);
          });

          it('should not ignore blank node predicates in a list', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p", "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "p": [ "a", "b", "c" ],
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
              triple(namedNode('http://ex.org/myid'), blankNode('p'), blankNode('l1')),
            ]);
          });

          it('should not ignore blank node predicates in an anonymous list', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "_:p" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ "a", "b", "c" ] },
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(JsonLdParser.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
              triple(namedNode('http://ex.org/myid'), blankNode('p'), blankNode('l1')),
            ]);
          });
        });
      });
    });

    describe('should not parse', () => {
      it('an invalid document', async () => {
        const stream = streamifyString(`
{
  "@id": "http://ex.org/myid1"
  "b": "http://ex.org/myid2"
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('a document with duplicate @id definitions', async () => {
        const stream = streamifyString(`
{
  "@id": "http://ex.org/myid1",
  "@id": "http://ex.org/myid2"
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('a document with an invalid processing mode', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "@version": "1.1"
  },
  "@id": "http://ex.org/myid1"
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('an @id inside an @reverse', async () => {
        const stream = streamifyString(`
{
  "@reverse": {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('an @graph inside an @reverse', async () => {
        const stream = streamifyString(`
{
  "@reverse": {
    "@graph": "http://ex.org/myid",
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
    });
  });
});
