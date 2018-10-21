import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import * as dataFactory from "@rdfjs/data-model";
import {blankNode, defaultGraph, literal, namedNode, quad, triple} from "@rdfjs/data-model";
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

  describe('when instantiated with a data factory', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ dataFactory });
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
        it('without an @id should return a blank node', async () => {
          return expect(await parser.valueToTerm(context, 'key', {}, 0))
            .toEqualRdfTerm(blankNode());
        });

        it('without an @id should put a blank node on the id stack', async () => {
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
      });

      describe('for a number', () => {
        it('for 2 should return an integer literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', 2, 0))
            .toEqualRdfTerm(literal('2', namedNode(JsonLdParser.XSD_INTEGER)));
        });

        it('for 2.2 should return a double literal node', async () => {
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(literal('2.2', namedNode(JsonLdParser.XSD_DOUBLE)));
        });

        it('with an @type: @id should return a named node', async () => {
          context = { key: { '@type': '@id' } };
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(namedNode('2.2'));
        });

        it('with an @type: http://ex.org/ should return a literal with that datatype', async () => {
          context = { key: { '@type': 'http://ex.org/' } };
          return expect(await parser.valueToTerm(context, 'key', 2.2, 0))
            .toEqualRdfTerm(literal('2.2', namedNode('http://ex.org/')));
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
    });

    describe('should parse', () => {
      it('an empty document', async () => {
        const stream = streamifyString(`{}`);
        return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
      });

      it('an empty array', async () => {
        const stream = streamifyString(`[]`);
        return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
      });

      describe('a single triple', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('2.2', namedNode(JsonLdParser.XSD_DOUBLE))),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });
      });

      describe('a single triple in an array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
[{
  "http://ex.org/pred1": "http://ex.org/obj1"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('2.2', namedNode(JsonLdParser.XSD_DOUBLE))),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value', namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
[{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1')),
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred3'), literal('http://ex.org/obj3')),
          ]);
        });
      });

      describe('a triple with an array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [ "a", "b", "c" ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('a')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('b')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": [ "a", "b", "c" ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), blankNode()),
          ]);

          expect(output[0].subject).toEqual(output[1].subject);
          expect(output[2].subject).toEqual(output[3].subject);
          expect(output[4].subject).toEqual(output[5].subject);

          expect(output[6].object).toEqual(output[0].subject);
          expect(output[1].object).toEqual(output[2].subject);
          expect(output[3].object).toEqual(output[4].subject);
        });

        it('without @id and an empty list', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toEqualRdfQuadArray([
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
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
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
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] },
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);

          expect(output[0].subject).toEqual(output[1].subject);
          expect(output[2].subject).toEqual(output[3].subject);
          expect(output[4].subject).toEqual(output[5].subject);

          expect(output[6].object).toEqual(output[0].subject);
          expect(output[1].object).toEqual(output[2].subject);
          expect(output[3].object).toEqual(output[4].subject);
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
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), blankNode()),
          ]);

          expect(output[0].subject).toEqual(output[1].subject);
          expect(output[2].subject).toEqual(output[3].subject);
          expect(output[4].subject).toEqual(output[5].subject);

          expect(output[6].object).toEqual(output[0].subject);
          expect(output[1].object).toEqual(output[2].subject);
          expect(output[3].object).toEqual(output[4].subject);
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
          expect(output).toEqualRdfQuadArray([
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
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
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
          expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('a')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('b')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), blankNode()),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'first'), literal('c')),
            triple(blankNode(), namedNode(JsonLdParser.RDF + 'rest'), namedNode(JsonLdParser.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
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
          expect(output[0].subject).toEqual(output[1].object);
          return expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred1'), blankNode()),
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
          return expect(output).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
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
          return expect(output).toEqualRdfQuadArray([
            triple(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode()),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/myid')),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'), defaultGraph()),
            quad(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'), defaultGraph()),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(blankNode(), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            quad(namedNode('http://ex.org/myinnerid'), namedNode('http://ex.org/pred1'),
              literal('http://ex.org/obj1'), namedNode('http://ex.org/mymiddleid')),
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
        });

        it('with a single unrelated triple', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "SomeTerm": "http://example.org/SomeTerm"
  },
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://example.org/'), namedNode('http://ex.org/pred'),
              namedNode('http://example.org/bla')),
          ]);
        });
      });

      describe('@type', () => {
        it('on an anonymous node', async () => {
          const stream = streamifyString(`
{
  "@type": "http://example.org/abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([]);
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
            return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
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
    });
  });
});
