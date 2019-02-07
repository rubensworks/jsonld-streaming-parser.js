import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import * as dataFactory from "@rdfjs/data-model";
import {blankNode, defaultGraph, literal, namedNode, quad, triple} from "@rdfjs/data-model";
import each from 'jest-each';
import "jest-rdf";
import {PassThrough} from "stream";
import {Util} from "../lib/Util";

describe('JsonLdParser', () => {

  describe('when instantiated without a data factory and context', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser();
    });

    it('should have a default data factory', async () => {
      expect(parser.util.dataFactory).toBeTruthy();
    });

    it('should have a default root context', async () => {
      expect(await parser.parsingContext.rootContext).toEqual({ '@base': undefined });
    });
  });

  describe('when instantiated without a data factory and with a context', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ context: { SomeTerm: 'http://example.org/' } });
    });

    it('should have a default data factory', async () => {
      expect(parser.util.dataFactory).toBeTruthy();
    });

    it('should have no root context', async () => {
      expect(await parser.parsingContext.rootContext).toEqual({ SomeTerm: 'http://example.org/' });
    });
  });

  describe('when instantiated with a custom default graph', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ defaultGraph: namedNode('http://ex.org/g') });
    });

    it('should expose the overridden default graph', () => {
      expect(parser.util.getDefaultGraph()).toEqualRdfTerm(namedNode('http://ex.org/g'));
    });

    it('should parse triples into the given graph', async () => {
      const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
        quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
          namedNode('http://ex.org/g')),
      ]);
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

      describe('an invalid keyword', () => {
        it('should be ignored', async () => {
          const stream = streamifyString(`
{
  "@unknown": "dummy"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });
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

        it('with @id that has an invalid IRI', async () => {
          const stream = streamifyString(`
{
  "@id": "not-an-iri",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with an o-o-o @id that has an invalid IRI', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "not-an-iri"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @id but invalid predicate IRI that should be skipped', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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

        it('with blank node @type', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@type": "_:type"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              blankNode('type')),
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
              literal('true', namedNode(Util.XSD_BOOLEAN))),
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
              literal('2.2E0', namedNode(Util.XSD_DOUBLE))),
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

        it('with @id and a raw @value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/"
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('my value')),
          ]);
        });

        it('with @id and a null @value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/"
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": null
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @id and a null value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/"
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": null
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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

        it('with @index in a string value should be ignored', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": "a",
      "@index": "prop"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('a')),
          ]);
        });

        it('with a string value in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": "a"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('a')),
          ]);
        });

        it('with a true boolean value in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": true
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('true', Util.XSD_BOOLEAN)),
          ]);
        });

        it('with a false boolean value in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": false
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('false', Util.XSD_BOOLEAN)),
          ]);
        });

        it('with a null value in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": null
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with a typed string', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": {
    "@value": "typed literal Prop",
    "@type": "http://example.org/type"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
          ]);
        });

        it('with a typed string (opposite order)', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": {
    "@type": "http://example.org/type",
    "@value": "typed literal Prop"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
          ]);
        });

        it('with a typed string in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@value": "typed literal Prop",
      "@type": "http://example.org/type"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
          ]);
        });

        it('with a typed string (opposite order) in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [
    {
      "@type": "http://example.org/type",
      "@value": "typed literal Prop"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
          ]);
        });

        it('with a typed string in a double array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [[
    {
      "@value": "typed literal Prop",
      "@type": "http://example.org/type"
    }
  ]]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
          ]);
        });

        it('with a typed string (opposite order) in a double array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": [[
    {
      "@type": "http://example.org/type",
      "@value": "typed literal Prop"
    }
  ]]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
              literal('typed literal Prop', namedNode('http://example.org/type'))),
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
    "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@reverse": {
    "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('without @id and with @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/g",
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('without @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@reverse": {
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
              namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "@reverse": {
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
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
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and with out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myid",
    "@reverse": {
      "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
    }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
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
  "p": { "@id": "http://ex.org/obj1" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
   "p": { "@id": "http://ex.org/obj1" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
          ]);
        });

        it('without @id and with empty @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@graph": {
    "p": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode()),
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
    "p": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
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
    "p": { "@id": "http://ex.org/obj1" }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode(),
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
    "p": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
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
    "p": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
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
    "p": { "@id": "http://ex.org/obj1" }
  },
  "@id": "http://ex.org/g"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid'), namedNode('http://ex.org/g')),
          ]);
        });

        it('with @id and a @reverse container', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@reverse": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "@reverse": {
     "p": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
          ]);
        });

        it('with @id and a bnode value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@reverse": "http://ex.org/pred1" },
    "p2": { "@id": "http://ex.org/pred2" }
  },
  "@id": "http://ex.org/myid",
  "p1": {
     "p2": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
            triple(blankNode('b'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),
          ]);
        });

        it('with @id and bnode values in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@reverse": "http://ex.org/pred1" },
    "p2": { "@id": "http://ex.org/pred2" }
  },
  "@id": "http://ex.org/myid",
  "p1": [
    { "p2": { "@id": "http://ex.org/obj1" } },
    { "p2": { "@id": "http://ex.org/obj2" } }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
            triple(blankNode('b1'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),

            triple(blankNode('b2'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/myid')),
            triple(blankNode('b2'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj2')),
          ]);
        });

        it('with a list as @reverse value, with allowSubjectList true', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "term": {"@reverse": "http://example/reverse"}
  },
  "@id": "http://example/foo",
  "term": {"@list": ["http://example/bar"]}
}`);
          parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext, allowSubjectList: true });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('b1'), namedNode('http://example/reverse'),
              namedNode('http://example/foo')),
            triple(blankNode('b1'), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'),
              literal('http://example/bar')),
            triple(blankNode('b1'), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')),
          ]);
        });
      });

      describe('an array with value nodes', () => {
        it('with @id values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@id": "http://ex.org/pred1" },
    "p2": { "@id": "http://ex.org/pred2" }
  },
  "@id": "http://ex.org/myid",
  "p1": [
    { "@id": "http://ex.org/obj1" },
    { "@id": "http://ex.org/obj2" }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj2')),
          ]);
        });

        it('with blank values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@id": "http://ex.org/pred1" },
    "p2": { "@id": "http://ex.org/pred2" }
  },
  "@id": "http://ex.org/myid",
  "p1": [
    { "p2": "http://ex.org/obj1" },
    { "p2": "http://ex.org/obj2" }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('b1')),
            triple(blankNode('b1'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj1')),

            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('b2')),
            triple(blankNode('b2'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        // TODO: add more test variants
      });

      describe('a free-floating node', () => {
        it('with string in array', async () => {
          const stream = streamifyString(`
[ "abc" ]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with string in @set array', async () => {
          const stream = streamifyString(`
{
  "@set": [
    "abc", "cde"
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with string in @list array', async () => {
          const stream = streamifyString(`
{
  "@list": [
    "abc", "cde"
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @list should also remove inner nodes', async () => {
          const stream = streamifyString(`
{
  "@list": [
    "abc",
    {
      "@id": "http://ex.org/mynode",
      "http://ex.org": "this should not exist"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with string in @list array in @graph array', async () => {
          const stream = streamifyString(`
{
  "@graph": [
    {
      "@list": [
        "abc", "cde"
      ]
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with typed @value', async () => {
          const stream = streamifyString(`
{ "@value": "free-floating value typed value", "@type": "http://example.com/type" }`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with typed @value in @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": [
    { "@value": "free-floating value typed value", "@type": "http://example.com/type" }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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
              literal('true', namedNode(Util.XSD_BOOLEAN))),
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
              literal('2.2E0', namedNode(Util.XSD_DOUBLE))),
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

      describe('a triple with an anonymous set array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@set": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });

        it('without @id and an empty list', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@set": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([]);
        });

        it('without @id and an empty list in an array', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [ { "@set": [ ] } ]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@set": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('c')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@set": [ "a", "b", "c" ] },
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('without @id and it being an @list container', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
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
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode(Util.RDF + 'nil')),
          ]);
        });

        it('without @id and an empty list and it being an @list container', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "http://ex.org/pred1": { "@list": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode(Util.RDF + 'nil')),
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with @id and it being an @list container', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with @id and an empty list', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode(Util.RDF + 'nil')),
          ]);
        });

        it('with @id and an empty list and it being an @list container', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode(Util.RDF + 'nil')),
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with an anonymous list with a null value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ null ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode(Util.RDF + 'nil')),
          ]);
        });

        it('with an anonymous list with null values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ null, "a", null, "b", null, "c", null ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with an anonymous list with a null @value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@list": [ { "@value": null } ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode(Util.RDF + 'nil')),
          ]);
        });

        it('with a context-based list with null values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": [ null, "a", null, "b", null, "c", null ]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with a context-based list with a null @value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": [ { "@value": null } ]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              namedNode(Util.RDF + 'nil')),
          ]);
        });

        it('with out-of-order @id with null values', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ null, "a", null, "b", null, "c", null ] },
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with datatyped values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@type": "http://ex.org/datatype" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ "value" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              blankNode('l')),
            triple(blankNode('l'), namedNode(Util.RDF + 'first'),
              literal('value', namedNode('http://ex.org/datatype'))),
            triple(blankNode('l'), namedNode(Util.RDF + 'rest'),
              namedNode(Util.RDF + 'nil')),
          ]);
        });
      });

      describe('a triple with an anonymous list array, in an array', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [{ "@list": [ "a", "b", "c" ] }]
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });
      });

      describe('a triple with an anonymous list array, in an list container', () => {
        it('without @id should emit an error', async () => {
          const stream = streamifyString(`
{
  "@context": { "p": {"@id": "http://ex.org/pred1", "@container": "@list" } },
  "p": [{ "@list": [ "a", "b", "c" ] }]
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toEqual(new Error('Lists of lists are not supported: \'p\''));
        });
      });

      describe('a triple with nested anonymous list arrays', () => {
        it('without @id should emit an error', async () => {
          const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{"@list": ["baz"]}]}
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toEqual(new Error('Lists of lists are not supported: \'@list\''));
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
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
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode(Util.RDF + 'nil')),
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
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
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });
      });

      describe('a triple with a context-based list element', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "p": "a"
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "p": "a"
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@container": "@list" }
  },
  "p": "a",
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });
      });

      describe('a triple with a single anonymous list element', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": { "@list": "a" }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": "a" }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1" }
  },
  "p": { "@list": "a" },
  "@id": "http://ex.org/myid",
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });
      });

      describe('a nested array', () => {
        it('a list-based inside a set-based array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@id": "http://ex.org/pred1" },
    "p2": { "@id": "http://ex.org/pred2", "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "p1": [
    {
      "p2": [
        "abc"
      ]
    }
  ],
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('abc')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('b0'), namedNode('http://ex.org/pred2'), blankNode('l0')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('b0')),
          ]);
        });

        it('a set-based array inside a list-based array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p1": { "@id": "http://ex.org/pred1", "@container": "@list" },
    "p2": { "@id": "http://ex.org/pred2" }
  },
  "@id": "http://ex.org/myid",
  "p1": [
    {
      "p2": [
        "abc"
      ]
    }
  ],
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), blankNode('b0')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('b0'), namedNode('http://ex.org/pred2'), literal('abc')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), blankNode('l0')),
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

        it('should skipped inner nodes behind an invalid predicate', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "ABC",
  "pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('ABC')),
          ]);
        });

        it('should skipped inner nodes behind a nested invalid predicates', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "ABC",
  "pred1": {
    "pred2": {
      "http://ex.org/pred3": "http://ex.org/obj2",
      "@id": "http://ex.org/myinnerid"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'),
              literal('ABC')),
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

        it('with @id with invalid IRI with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@id": "not-an-iri",
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @id with inner subject @id that has an invalid IRI', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@id": "not-an-iri",
    "http://ex.org/pred1": "http://ex.org/obj1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('with @id with inner o-o-o subject @id that has an invalid IRI', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "@id": "not-an-iri"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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

        it('with out-of-order @id with invalid IRI with inner subject @id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@id": "http://ex.org/myinnerid",
    "http://ex.org/pred1": "http://ex.org/obj1"
  },
  "@id": "not-an-iri"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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

        it('without @id, but with a top-level property afterwards, should create a blank node graph id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              blankNode('g1')),
            quad(blankNode('g1'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('without @id, but with a top-level property before, should create a blank node graph id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred2": "http://ex.org/obj2",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              blankNode('g1')),
            quad(blankNode('g1'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('with @id, but with a top-level property afterwards', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('with @id, but with a top-level property before', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred2": "http://ex.org/obj2",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('with o-o-o @id, but with a top-level property afterwards', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "http://ex.org/pred2": "http://ex.org/obj2",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('with o-o-o @id, but with a top-level property before', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred2": "http://ex.org/obj2",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode(), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              namedNode('http://ex.org/myid')),
            quad(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
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

        it('without @id, but with a top-level property afterwards, should create a blank node graph id', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  },
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              blankNode('g1')),
            quad(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
              blankNode('g1')),
            quad(blankNode('g1'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
          ]);
        });

        it('without @id, but with a top-level property before, should create a blank node graph id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred2": "http://ex.org/obj2",
  "@graph": {
    "http://ex.org/pred1": "http://ex.org/obj1",
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            quad(blankNode('a'), namedNode('http://ex.org/pred1'), literal('http://ex.org/obj1'),
              blankNode('g1')),
            quad(blankNode('a'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2'),
              blankNode('g1')),
            quad(blankNode('g1'), namedNode('http://ex.org/pred2'), literal('http://ex.org/obj2')),
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
            parser.parsingContext.contextParser.parse = () => Promise.reject(new Error('Dummy parsing error'));
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
          });

          it('with two separate inner contexts at the same level', async () => {
            const stream = streamifyString(`
{
  "@id": "http://ex.org/s",
  "http://ex.org/p1": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm1"
    },
    "@id": "http://ex.org/obj11",
    "SomeInnerTerm": "http://ex.org/obj2"
  },
  "http://ex.org/p2": {
    "@context": {
      "SomeInnerTerm": "http://example.org/SomeInnerTerm2"
    },
    "@id": "http://ex.org/obj12",
    "SomeInnerTerm": "http://ex.org/obj2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://ex.org/s'), namedNode('http://ex.org/p1'),
                namedNode('http://ex.org/obj11')),
              triple(namedNode('http://ex.org/obj11'), namedNode('http://example.org/SomeInnerTerm1'),
                literal('http://ex.org/obj2')),
              triple(namedNode('http://ex.org/s'), namedNode('http://ex.org/p2'),
                namedNode('http://ex.org/obj12')),
              triple(namedNode('http://ex.org/obj12'), namedNode('http://example.org/SomeInnerTerm2'),
                literal('http://ex.org/obj2')),
            ]);
          });

          it('with overriding of @base', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "property": "http://example.com/vocab#property"
  },
  "@id": "../document-relative",
  "property": {
    "@context": {
      "@base": "http://example.org/test/"
    },
    "@id": "../document-base-overwritten",
    "property": [
      {
        "@context": null,
        "@id": "../document-relative",
        "property": "context completely reset, drops property"
      }
    ]
  }
}`);
            parser = new JsonLdParser({
              allowOutOfOrderContext,
              baseIRI: 'https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld',
              dataFactory,
            });
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('https://json-ld.org/test-suite/document-relative'),
                namedNode('http://example.com/vocab#property'),
                namedNode('http://example.org/document-base-overwritten')),
              triple(namedNode('http://example.org/document-base-overwritten'),
                namedNode('http://example.com/vocab#property'),
                namedNode('https://json-ld.org/test-suite/document-relative')),
            ]);
          });

          it('with complex overriding of @base', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "property": "http://example.com/vocab#property"
  },
  "@id": "../document-relative",
  "@type": "#document-relative",
  "property": {
    "@context": {
      "@base": "http://example.org/test/"
    },
    "@id": "../document-base-overwritten",
    "@type": "#document-base-overwritten",
    "property": [
      {
        "@context": null,
        "@id": "../document-relative",
        "@type": "#document-relative",
        "property": "context completely reset, drops property"
      },
      {
        "@context": {
          "@base": null
        },
        "@id": "../document-relative",
        "@type": "#document-relative",
        "property": "@base is set to none"
      }
    ]
  }
}`);
            parser = new JsonLdParser({
              allowOutOfOrderContext,
              baseIRI: 'https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld',
              dataFactory,
            });
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(namedNode('http://example.org/document-base-overwritten'),
                namedNode('http://example.com/vocab#property'),
                namedNode('https://json-ld.org/test-suite/document-relative')),
              triple(namedNode('http://example.org/document-base-overwritten'),
                namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                namedNode('http://example.org/test/#document-base-overwritten')),
              triple(namedNode('https://json-ld.org/test-suite/document-relative'),
                namedNode('http://example.com/vocab#property'),
                namedNode('http://example.org/document-base-overwritten')),
              triple(namedNode('https://json-ld.org/test-suite/document-relative'),
                namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                namedNode('https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld#document-relative')),
            ]);
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
  "@id": "http://abc",
  "pred": { "@id": "http://bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://abc'), namedNode('http://ex.org/pred'),
              namedNode('http://bla')),
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
  "pred": { "@id": "bla" },
  "http://ex.org/pred": { "@id": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/'), namedNode('http://ex.org/pred'),
              namedNode('http://example.org/bla')),
          ]);
        });

        it('with @base and @vocab with triples, with @vocab=null, should resolve @type to baseIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
    "@vocab": null
  },
  "@id": "",
  "@type": "bla"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://example.org/bla')),
          ]);
        });

        it('with @base and @vocab with triples, with @vocab=null, should resolve typed nodes to baseIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
    "@vocab": null
  },
  "@id": "",
  "http://ex.org/p": { "@value": "val", "@type": "bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://example.org/'),
              namedNode('http://ex.org/p'),
              literal('val', namedNode('http://example.org/bla'))),
          ]);
        });

        it('with @vocab with triples, with a term set to null', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignore": null
  },
  "@id": "http://abc",
  "pred": "http://bla",
  "ignore": "http://bla"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://abc'), namedNode('http://example.org/pred'),
              literal('http://bla')),
          ]);
        });

        it('with @vocab with triples, with a term @id set to null', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignore": { "@id": null }
  },
  "@id": "http://abc",
  "pred": "http://bla",
  "ignore": "http://bla"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://abc'), namedNode('http://example.org/pred'),
              literal('http://bla')),
          ]);
        });

        it('with @vocab with triples, with a term set to null with object values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignore": null
  },
  "@id": "http://abc",
  "pred": { "@id": "http://bla" },
  "ignore": { "@id": "http://bla" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://abc'), namedNode('http://example.org/pred'),
              namedNode('http://bla')),
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
  "@id": "http://abc",
  "pred1": {
    "@context": null,
    "@id": "http://bla",
    "pred2": {
      "@id": "http://blabla"
    }
  }
}`);
        return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
          triple(namedNode('http://abc'), namedNode('http://example.org/pred1'),
            namedNode('http://bla')),
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

          it('with a context entry referring to itself, but should be resolved against @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.com/anotherVocab#",
    "term": "term"
  },
  "term": "value of term"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://example.com/anotherVocab#term'),
                literal('value of term')),
            ]);
          });

          it('with a context entry referring to itself, should ignore the base', async () => {
            parser = new JsonLdParser(
              { dataFactory, allowOutOfOrderContext, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.com/anotherVocab#",
    "term": "term"
  },
  "term": "value of term"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://example.com/anotherVocab#term'),
                literal('value of term')),
            ]);
          });

          it('with context-based @type based on @vocab', async () => {
            parser = new JsonLdParser(
              { dataFactory, allowOutOfOrderContext, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "date": { "@type": "dateTime" }
  },
  "date": "2011-01-25T00:00:00Z"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://vocab.org/date'),
                literal('2011-01-25T00:00:00Z', namedNode('http://vocab.org/dateTime'))),
            ]);
          });

          it('with inline @type based on @vocab', async () => {
            parser = new JsonLdParser(
              { dataFactory, allowOutOfOrderContext, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
  },
  "date": { "@value": "2011-01-25T00:00:00Z", "@type": "dateTime" }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              triple(blankNode(), namedNode('http://vocab.org/date'),
                literal('2011-01-25T00:00:00Z', namedNode('http://vocab.org/dateTime'))),
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

        it('on a named node should work with @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/"
  },
  "@id": "http://example.org/node",
  "@type": "abc"
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

        it('on a named node with an aliased @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://example.org/",
    "t": { "@id": "@type", "@type": "@id" }
  },
  "@id": "http://example.org/node",
  "t": "ex:abc"
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

        it('on a named node with multiple @types should work with @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/"
  },
  "@id": "http://example.org/node",
  "@type": [
    "abc1",
    "abc2",
    "abc3"
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

        it('with value @id should be relative to baseIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" }
  },
  "p": "abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://base.org/abc')),
          ]);
        });

        it('with value @vocab should be relative to vocabIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@vocab" }
  },
  "p": "abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://vocab.org/abc')),
          ]);
        });

        it('without value @vocab should be relative to baseIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@vocab" }
  },
  "p": "abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://base.org/abc')),
          ]);
        });

        it('should use context terms for @type: @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@vocab" },
    "abc": "http://ex.org/use-me"
  },
  "p": "abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://ex.org/use-me')),
          ]);
        });

        it('should not use context terms for @type: @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" },
    "abc": "http://ex.org/do-not-use-me"
  },
  "p": "abc"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode(), namedNode('http://ex.org/predicate'),
              namedNode('http://base.org/abc')),
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
              triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
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
              triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
              triple(namedNode('http://ex.org/myid'), blankNode('p'), blankNode('l1')),
            ]);
          });
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
              triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
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
              triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('a')),
              triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('b')),
              triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), blankNode('l3')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'first'), literal('c')),
              triple(blankNode('l3'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
              triple(namedNode('http://ex.org/myid'), blankNode('p'), blankNode('l1')),
            ]);
          });
        });
      });

      describe('with keyword aliases', () => {
        it('should alias @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "url": "@id"
  },
  "url": "http://ex.org/myid",
  "http://xmlns.com/foaf/0.1/name": "Bob",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should multi-level alias @id', async () => {
          const stream = streamifyString(`
{
  "@context": [
    { "id": "@id" },
    { "url": "id" }
  ],
  "url": "http://ex.org/myid",
  "http://xmlns.com/foaf/0.1/name": "Bob",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should alias @id with a relative IRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "url": "@id"
  },
  "url": "/myid",
  "http://xmlns.com/foaf/0.1/name": "Bob",
}`);
          parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext, baseIRI: 'http://ex.org/' });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should multi-level alias @id with a relative IRI', async () => {
          const stream = streamifyString(`
{
  "@context": [
    { "id": "@id" },
    { "url": "id" }
  ],
  "url": "/myid",
  "http://xmlns.com/foaf/0.1/name": "Bob",
}`);
          parser = new JsonLdParser({ dataFactory, allowOutOfOrderContext, baseIRI: 'http://ex.org/' });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should alias @id nested in @id', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "url": { "@id": "@id" }
  },
  "url": "http://ex.org/myid",
  "http://xmlns.com/foaf/0.1/name": "Bob",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should alias @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "a": "@type"
  },
  "@id": "http://ex.org/myid",
  "a": "http://ex.org/bla",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/bla')),
          ]);
        });

        it('should alias a reversed @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "a": { "@reverse": "@type" }
  },
  "@id": "http://ex.org/myid",
  "a": "http://ex.org/bla",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/bla'),
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('should alias @value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "val": "@value"
  },
  "@id": "http://ex.org/myid",
  "http://xmlns.com/foaf/0.1/name": { "val": "Bob" },
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'),
              namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob')),
          ]);
        });

        it('should alias @value and @language', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "val": "@value",
    "lang": "@language"
  },
  "@id": "http://ex.org/myid",
  "http://xmlns.com/foaf/0.1/name": { "val": "Bob", "lang": "en" },
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'),
              namedNode('http://xmlns.com/foaf/0.1/name'),
              literal('Bob', 'en')),
          ]);
        });

        it('should alias @list', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "myList": "@list"
  },
  "http://ex.org/pred1": { "myList": [ "a", "b", "c" ] }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(blankNode('l0'), namedNode(Util.RDF + 'first'), literal('a')),
            triple(blankNode('l0'), namedNode(Util.RDF + 'rest'), blankNode('l1')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'first'), literal('b')),
            triple(blankNode('l1'), namedNode(Util.RDF + 'rest'), blankNode('l2')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'first'), literal('c')),
            triple(blankNode('l2'), namedNode(Util.RDF + 'rest'), namedNode(Util.RDF + 'nil')),
            triple(blankNode('a'), namedNode('http://ex.org/pred1'), blankNode('l0')),
          ]);
        });

        it('should alias @reverse', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "rev": "@reverse"
  },
  "@id": "http://ex.org/myid",
  "rev": {
    "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'),
              namedNode('http://ex.org/myid')),
          ]);
        });

        it('should alias @graph', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "g": "@graph"
  },
  "@id": "http://ex.org/mygraph",
  "g": {
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

        it('should alias @set', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "set": "@set"
  },
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "set": [ "a", "b", "c" ] }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          expect(output).toBeRdfIsomorphic([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('a')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('b')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), literal('c')),
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
      it('@reverse: true', async () => {
        const stream = streamifyString(`
{
  "http://example/prop": {
    "@reverse": true
  }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('a list in a reversed property', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "term": {"@reverse": "http://example/reverse"}
  },
  "@id": "http://example/foo",
  "term": {"@list": ["http://example/bar"]}
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new Error('Found illegal list value in subject position at term'));
      });
      it('a singular list in a reversed property', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "term": {"@reverse": "http://example/reverse"}
  },
  "@id": "http://example/foo",
  "term": {"@list": "http://example/bar"}
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new Error('Found illegal list value in subject position at term'));
      });
      it('an empty list in a reversed property', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "term": {"@reverse": "http://example/reverse"}
  },
  "@id": "http://example/foo",
  "term": {"@list": []}
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new Error('Found illegal list value in subject position at term'));
      });
    });
  });

  describe('when instantiated with errorOnInvalidIris true', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ errorOnInvalidIris: true });
    });

    it('should error on an unknown keyword', async () => {
      const stream = streamifyString(`
{
  "@unknown": "dummy"
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Unknown keyword \'@unknown\' with value \'dummy\''));
    });

    it('should error on a predicate that is not an IRI', async () => {
      const stream = streamifyString(`
{
  "bla": "dummy"
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Invalid predicate IRI: bla'));
    });

    it('should error on a subject that is not an IRI', async () => {
      const stream = streamifyString(`
{
  "@id": "dummy"
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Invalid resource IRI: dummy'));
    });

    it('should error on an object that is not an IRI', async () => {
      const stream = streamifyString(`
{
  "http://ex.org/pred": { "@id": "dummy" }
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Invalid resource IRI: dummy'));
    });

    it('should error on @reverse with literal values', async () => {
      const stream = streamifyString(`
{
  "@id": "http://example.org/",
  "@reverse": {
    "http://xmlns.com/foaf/0.1/knows": "Name"
  }
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Found illegal literal in subject position: Name'));
    });

    it('should error on conflicting indexes in the root when validateValueIndexes is false', async () => {
      const stream = streamifyString(`
[
  {
    "@id": "http://example/foo",
    "@index": "bar"
  },
  {
    "@id": "http://example/foo",
    "@index": "baz"
  }
]`);
      parser = new JsonLdParser({ errorOnInvalidIris: true, validateValueIndexes: true });
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Conflicting @index value for http://example/foo'));
    });

    it('should not error on conflicting indexes in the root when validateValueIndexes is true', async () => {
      const stream = streamifyString(`
[
  {
    "@id": "http://example/foo",
    "@index": "bar"
  },
  {
    "@id": "http://example/foo",
    "@index": "baz"
  }
]`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
    });

    it('should not error on a predicate that is mapped to null', async () => {
      const stream = streamifyString(`
{
  "@context": {
    "bla": null
  },
  "bla": "dummy"
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
    });

    it('should not error on a subject that is mapped to null', async () => {
      const stream = streamifyString(`
{
  "@context": {
    "id": { "@id": null }
  },
  "id": "dummy"
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
    });

    it('should not error on an anonymous list', async () => {
      const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo"}},
  "foo": [{"@set": ["baz"]}]
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
        triple(blankNode(), namedNode('http://example.com/foo'), literal('baz')),
      ]);
    });

    it('should not error on a reversed property', async () => {
      const stream = streamifyString(`
{
  "@reverse": {
    "http://ex.org/pred1": { "@id": "http://ex.org/obj1" }
  }
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
        triple(namedNode('http://ex.org/obj1'), namedNode('http://ex.org/pred1'), blankNode('')),
      ]);
    });
  });

  // The following tests check the parser via stateful .write() calls.
  describe('for step-by-step streaming with default settings', () => {
    describe('without context', () => {
      let parser;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory });
      });

      it('should emit nothing when nothing has been pushed', () => {
        parser.write('');
        expect(parser.read(1)).toBeFalsy();
      });

      it('should emit nothing after {', (done) => {
        parser.write('{', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id', (done) => {
        parser.write('"@id": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id value', (done) => {
        parser.write('"http://example.org",', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after predicate', (done) => {
        parser.write('"http://example.com/p": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit a quad after object', (done) => {
        parser.write('"http://example.com/o",', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://example.org'), namedNode('http://example.com/p'),
            literal('http://example.com/o')));
          done();
        });
      });

      it('should emit nothing after another predicate', (done) => {
        parser.write('"http://example.com/p2": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit a quad after another object', (done) => {
        parser.write('"http://example.com/o2"', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://example.org'), namedNode('http://example.com/p2'),
            literal('http://example.com/o2')));
          done();
        });
      });

      it('should end after }', (done) => {
        parser.write('}', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should be closed after finishing the stream', () => {
        parser.end();
        expect(parser.read(1)).toBeFalsy();
        expect(parser.writable).toBeFalsy();
      });
    });

    describe('with array values', () => {
      let parser;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory });
      });

      it('should emit nothing when nothing has been pushed', () => {
        parser.write('');
        expect(parser.read(1)).toBeFalsy();
      });

      it('should emit nothing after {', (done) => {
        parser.write('{', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id', (done) => {
        parser.write('"@id": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id value', (done) => {
        parser.write('"http://example.org",', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after predicate', (done) => {
        parser.write('"http://example.com/p": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after [', (done) => {
        parser.write('[', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit a quad after object', (done) => {
        parser.write('"http://example.com/o",', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://example.org'), namedNode('http://example.com/p'),
            literal('http://example.com/o')));
          done();
        });
      });

      it('should emit a quad after another object', (done) => {
        parser.write('"http://example.com/o2"', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://example.org'), namedNode('http://example.com/p'),
            literal('http://example.com/o2')));
          done();
        });
      });

      it('should emit nothing after ]', (done) => {
        parser.write(']', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should end after }', (done) => {
        parser.write('}', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should be closed after finishing the stream', () => {
        parser.end();
        expect(parser.read(1)).toBeFalsy();
        expect(parser.writable).toBeFalsy();
      });
    });

    describe('with context', () => {
      let parser;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory });
      });

      it('should emit nothing when nothing has been pushed', () => {
        parser.write('');
        expect(parser.read(1)).toBeFalsy();
      });

      it('should emit nothing after {', (done) => {
        parser.write('{', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after a context', (done) => {
        parser.write('"@context": { "p": "http://example.org/p", "@base": "http://base.org/" },', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id', (done) => {
        parser.write('"@id": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after @id value', (done) => {
        parser.write('"id",', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit nothing after predicate', (done) => {
        parser.write('"p": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit a quad after object', (done) => {
        parser.write('"ooo",', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://base.org/id'), namedNode('http://example.org/p'),
            literal('ooo')));
          done();
        });
      });

      it('should emit nothing after another predicate', (done) => {
        parser.write('"http://example.com/p2": ', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should emit a quad after another object', (done) => {
        parser.write('"http://example.com/o2"', () => {
          expect(parser.read(1)).toEqualRdfQuad(quad(
            namedNode('http://base.org/id'), namedNode('http://example.com/p2'),
            literal('http://example.com/o2')));
          done();
        });
      });

      it('should end after }', (done) => {
        parser.write('}', () => {
          expect(parser.read(1)).toBeFalsy();
          done();
        });
      });

      it('should be closed after finishing the stream', () => {
        parser.end();
        expect(parser.read(1)).toBeFalsy();
        expect(parser.writable).toBeFalsy();
      });
    });
  });

  describe('#import', () => {
    let parser;

    beforeAll(() => {
      parser = new JsonLdParser();
    });

    it('should parse a stream', async () => {
      const stream = streamifyString(`
{
  "@id": "http://example.org/myGraph",
  "@graph": {
    "@id": "http://example.org/node",
    "@type": "http://example.org/abc",
    "http://example.org/p": "def"
  }
}`);
      return expect(await arrayifyStream(parser.import(stream))).toBeRdfIsomorphic([
        quad(namedNode('http://example.org/node'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://example.org/abc'),
          namedNode('http://example.org/myGraph')),
        quad(namedNode('http://example.org/node'),
          namedNode('http://example.org/p'),
          literal('def'),
          namedNode('http://example.org/myGraph')),
      ]);
    });

    it('should parse another stream', async () => {
      const stream = streamifyString(`
{
  "@id": "http://example.org/node",
  "@type": "http://example.org/abc",
  "http://example.org/p": "def"
}`);
      return expect(await arrayifyStream(parser.import(stream))).toBeRdfIsomorphic([
        quad(namedNode('http://example.org/node'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://example.org/abc')),
        quad(namedNode('http://example.org/node'),
          namedNode('http://example.org/p'),
          literal('def')),
      ]);
    });

    it('should forward error events', async () => {
      const stream = new PassThrough();
      stream._read = () => stream.emit('error', new Error('my error'));
      return expect(arrayifyStream(parser.import(stream))).rejects.toThrow(new Error('my error'));
    });
  });
});
