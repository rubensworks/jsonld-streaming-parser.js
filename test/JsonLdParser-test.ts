import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import "jest-rdf";
import * as dataFactory from "rdf-data-model";
import {blankNode, defaultGraph, literal, namedNode, quad, triple} from "rdf-data-model";

describe('JsonLdParser', () => {
  describe('when instantiated without a data factory', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser();
    });

    it('should have a default data factory', async () => {
      expect(parser.dataFactory).toBeTruthy();
    });
  });

  describe('when instantiated with a data factory', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ dataFactory });
    });

    describe('#valueToTerm', () => {
      describe('for an unknown type', () => {
        it('should emit an error', async () => {
          return new Promise((resolve, reject) => {
            parser.on('error', () => resolve());
            parser.valueToTerm(Symbol(), 0);
          });
        });
      });

      describe('for an object', () => {
        it('without an @id should return a blank node', async () => {
          return expect(parser.valueToTerm({}, 0)).toEqualRdfTerm(blankNode());
        });

        it('without an @id should put a blank node on the id stack', async () => {
          parser.valueToTerm({}, 0);
          return expect(parser.idStack[1]).toEqualRdfTerm(blankNode());
        });

        it('with an @id should return a named node', async () => {
          return expect(parser.valueToTerm({ '@id': 'http://ex.org' }, 0))
            .toEqualRdfTerm(namedNode('http://ex.org'));
        });
      });

      describe('for a string', () => {
        it('should return a literal node', async () => {
          return expect(parser.valueToTerm('abc', 0)).toEqualRdfTerm(literal('abc'));
        });
      });

      describe('for a boolean', () => {
        it('for true should return a boolean literal node', async () => {
          return expect(parser.valueToTerm(true, 0))
            .toEqualRdfTerm(literal('true', namedNode(JsonLdParser.XSD_BOOLEAN)));
        });

        it('for false should return a boolean literal node', async () => {
          return expect(parser.valueToTerm(false, 0))
            .toEqualRdfTerm(literal('false', namedNode(JsonLdParser.XSD_BOOLEAN)));
        });
      });
    });

    describe('should parse', () => {
      it('an empty document', async () => {
        const stream = streamifyString(`{}`);
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

        it('with @id an a boolean literal', async () => {
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
