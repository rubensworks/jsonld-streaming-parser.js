import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import * as RDF from "rdf-js";
import {DataFactory} from "rdf-data-factory";
import each from 'jest-each';
import "jest-rdf";
import {ERROR_CODES, ErrorCoded, JsonLdContextNormalized} from "jsonld-context-parser";
import {PassThrough} from "stream";
import {Util} from "../lib/Util";
import { ParsingContext } from '../lib/ParsingContext';

const DF = new DataFactory<RDF.BaseQuad>();

describe('JsonLdParser', () => {

  describe('#fromHttpResponse', () => {
    const parseContextSpy = jest.spyOn(ParsingContext.prototype, 'parseContext');
    beforeEach(() => {
      parseContextSpy.mockReturnValue(Promise.resolve(new JsonLdContextNormalized({})));
    });

    afterAll(() => {
      parseContextSpy.mockRestore();
    });

    it('should handle a JSON-LD response', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/ld+json');
      expect((<any> parser).options.baseIRI).toEqual('BASE');
    });

    it('should handle a JSON-LD response and allow option overrides', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/ld+json', undefined, { baseIRI: 'base2' });
      expect((<any> parser).options.baseIRI).toEqual('base2');
    });

    it('should error on a non-JSON response without link header', () => {
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'text/turtle'))
        .toThrow(new ErrorCoded(`Unsupported JSON-LD media type text/turtle`,
          ERROR_CODES.LOADING_DOCUMENT_FAILED))
    });

    it('should error on a plain JSON response without link header', () => {
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'application/json'))
        .toThrow(new ErrorCoded(`Missing context link header for media type application/json on BASE`,
        ERROR_CODES.LOADING_DOCUMENT_FAILED))
    });

    it('should error on a JSON extension type without link header', () => {
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'text/turtle+json'))
        .toThrow(new ErrorCoded(`Missing context link header for media type text/turtle+json on BASE`,
          ERROR_CODES.LOADING_DOCUMENT_FAILED))
    });

    it('should handle a plain JSON response without link header when ignoreMissingContextLinkHeader is true', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json', undefined, { ignoreMissingContextLinkHeader: true });
      expect((<any> parser).options.baseIRI).toEqual('BASE');
    });

    it('should handle a JSON extension type without link header when ignoreMissingContextLinkHeader is true', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'text/turtle+json', undefined, { ignoreMissingContextLinkHeader: true });
      expect((<any> parser).options.baseIRI).toEqual('BASE');
    });

    it('should error on a non-JSON response with link header', () => {
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'text/turtle',
        new Headers({ 'link': '<my-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"' })))
        .toThrow(new ErrorCoded(`Unsupported JSON-LD media type text/turtle`,
          ERROR_CODES.LOADING_DOCUMENT_FAILED))
    });

    it('should handle on a JSON response with link header', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json',
        new Headers({ 'link': '<my-context.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"' }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context.jsonld');
    });

    it('should handle on a JSON response with link header when ignoreMissingContextLinkHeader is true', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json',
        new Headers({ 'link': '<my-context.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"' }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context.jsonld');
    });

    it('should handle on a JSON response with non-escaped link header', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json',
        new Headers({ 'link': '<my-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"' }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context.jsonld');
    });

    it('should handle on a JSON extension type with link header', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'text/turtle+json',
        new Headers({ 'link': '<my-context.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"' }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context.jsonld');
    });

    it('should handle on a JSON response with link header and other headers', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json',
        new Headers({ 'link': '<my-context.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"', 'a': 'b' }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context.jsonld');
    });

    it('should error on a JSON response with multiple valid link headers', () => {
      const headers = new Headers();
      headers.append('Link', '<my-context1.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"');
      headers.append('Link', '<my-context2.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"');
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'application/json', headers))
        .toThrow(new ErrorCoded(`Multiple JSON-LD context link headers were found on BASE`,
          ERROR_CODES.MULTIPLE_CONTEXT_LINK_HEADERS))
    });

    it('should error on a JSON extension type with multiple valid link headers', () => {
      const headers = new Headers();
      headers.append('Link', '<my-context1.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"');
      headers.append('Link', '<my-context2.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"');
      expect(() => JsonLdParser.fromHttpResponse('BASE', 'text/turtle+json', headers))
        .toThrow(new ErrorCoded(`Multiple JSON-LD context link headers were found on BASE`,
          ERROR_CODES.MULTIPLE_CONTEXT_LINK_HEADERS))
    });

    it('should handle on a JSON response with one JSON-LD context link header and other link headers', () => {
      const headers = new Headers();
      headers.append('Link', '<my-context1.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"');
      headers.append('Link', '<my-context2.jsonld>; rel=\"SOMETHING ELSE\"');
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/json', headers);
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.context).toEqual('my-context1.jsonld');
    });

    it('should handle a JSON-LD response with a streaming profile', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/ld+json', new Headers({
        'content-type': 'application/ld+json; profile=http://www.w3.org/ns/json-ld#streaming'
      }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.streamingProfile).toEqual(true);
    });

    it('should handle a JSON-LD response with a non-streaming profile', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/ld+json', new Headers({
        'content-type': 'application/ld+json; profile=http://www.w3.org/ns/json-ld#compacted'
      }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.streamingProfile).not.toEqual(true);
    });

    it('should handle a JSON-LD response with a non-profile', () => {
      const parser = JsonLdParser.fromHttpResponse('BASE', 'application/ld+json', new Headers({
        'content-type': 'application/ld+json; bla=http://www.w3.org/ns/json-ld#compacted'
      }));
      expect((<any> parser).options.baseIRI).toEqual('BASE');
      expect((<any> parser).options.streamingProfile).not.toEqual(true);
    });
  });

  describe('when instantiated without a data factory and context', () => {
    let parser: any;

    beforeEach(() => {
      parser = new JsonLdParser();
    });

    it('should have a default data factory', async () => {
      expect(parser.util.dataFactory).toBeTruthy();
    });

    it('should have a default root context', async () => {
      expect(await parser.parsingContext.rootContext).toEqual(new JsonLdContextNormalized({ '@base': undefined }));
    });
  });

  describe('when instantiated without a data factory and with a context', () => {
    let parser: any;

    beforeEach(() => {
      parser = new JsonLdParser({ context: { SomeTerm: 'http://example.org/' } });
    });

    it('should have a default data factory', async () => {
      expect(parser.util.dataFactory).toBeTruthy();
    });

    it('should have no root context', async () => {
      expect(await parser.parsingContext.rootContext).toEqual(
        new JsonLdContextNormalized({ SomeTerm: 'http://example.org/' }));
    });
  });

  describe('when instantiated with a custom default graph', () => {
    let parser: any;

    beforeEach(() => {
      parser = new JsonLdParser({ defaultGraph: DF.namedNode('http://ex.org/g') });
    });

    it('should expose the overridden default graph', () => {
      expect(parser.util.getDefaultGraph()).toEqualRdfTerm(DF.namedNode('http://ex.org/g'));
    });

    it('should parse triples into the given graph', async () => {
      const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
      return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
        DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
          DF.namedNode('http://ex.org/g')),
      ]);
    });
  });

  (<any> each ([
    [true],
    [false],
  ])).describe('when instantiated with a data factory and streamingProfile %s', (streamingProfile: boolean) => {
    // Enable the following instead if you want to run tests more conveniently with IDE integration
  /*describe('when instantiated with a data factory and streamingProfile %s', () => {
    const streamingProfile = true;*/
    let parser: any;

    beforeEach(() => {
      parser = new JsonLdParser({ dataFactory: DF, streamingProfile });
    });

    describe('should parse', () => {
      describe('an empty document with', () => {
        it('an empty object', async () => {
          const stream = streamifyString(`{}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('a valid processing mode', async () => {
          const stream = streamifyString(`{ "@context": { "@version": 1.1 } }`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('a non-default processing mode when configured as such', async () => {
          parser = new JsonLdParser({ processingMode: '1.0' });
          const stream = streamifyString(`{ "@context": { "@version": 1.0 } }`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('an empty array', async () => {
          const stream = streamifyString(`[]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });
      });

      describe('an invalid keyword', () => {
        it('should be ignored', async () => {
          const stream = streamifyString(`
{
  "@unknown": "dummy"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
        });

        it('should be ignored when mapped via the context', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ignoreMe": "@ignoreMe"
  },
  "@type": "http://example.com/IgnoreTest",
  "ignoreMe": "should not be here"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.com/IgnoreTest')),
          ]);
        });

        it('should fallback to @vocab when mapped via the context', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignoreMe": "@ignoreMe"
  },
  "@type": "http://example.com/IgnoreTest",
  "ignoreMe": "should be here"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.com/IgnoreTest')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://example.org/ignoreMe'),
              DF.literal('should be here')),
          ]);
        });

        it('should be ignored when mapped via the context via @reverse', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ignoreMe": {"@reverse": "@ignoreMe"}
  },
  "@type": "http://example.com/IgnoreTest",
  "ignoreMe": "should not be here"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.com/IgnoreTest')),
          ]);
        });

        it('should be ignored when mapped via the context via @reverse and a sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ignoreMe": {"@reverse": "@ignoreMe"}
  },
  "@type": "http://example.com/IgnoreTest",
  "ignoreMe": {"http://example.org/text": "should not be here"}
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.com/IgnoreTest')),
          ]);
        });

        it('should fallback to @vocab when mapped via the context via @reverse and a sub-prop', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "ignoreMe": {"@reverse": "@ignoreMe"}
  },
  "@type": "http://example.com/IgnoreTest",
  "ignoreMe": {"text": "should be here"}
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.com/IgnoreTest')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://example.org/ignoreMe'),
              DF.blankNode('b2')),
            DF.quad(DF.blankNode('b2'), DF.namedNode('http://example.org/text'),
              DF.literal('should be here')),
          ]);
        });
      });

      describe('a single triple', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
          ]);
        });

        it('without @id and anonymous blank node value', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {}
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.blankNode()),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
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
            DF.quad(DF.blankNode('myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
          ]);
        });

        it('with blank node @type', async () => {
          const stream = streamifyString(`
{
  "@type": "_:type",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.blankNode('type')),
          ]);
        });

        it('with @id and literal value that *looks* like a blank node', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "_:obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('_:obj1')),
          ]);
        });

        it('with @id and blank node value', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": { "@id": "_:obj1" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('true', DF.namedNode(Util.XSD_BOOLEAN))),
          ]);
        });

        it('with @id and a number literal', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": 2.2
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('2.2E0', DF.namedNode(Util.XSD_DOUBLE))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with @id and an invalid typed literal should throw', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@type": "http://ex.org/ mytype"
  }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Invalid \'@type\' value, got \'"http://ex.org/ mytype"\'', ERROR_CODES.INVALID_TYPED_VALUE));
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://greggkellogg.net/foaf#me'), DF.namedNode('http://purl.org/dc/terms/created'),
              DF.literal('1957-02-27', DF.namedNode('http://www.w3.org/2001/XMLSchema#date'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'en-us')),
          ]);
        });

        it('with @id and a mixed-case context-language literal', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@language": "en-US" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'en-US')),
          ]);
        });

        it('with @id and a mixed-case context-language literal when normalizeLanguageTags is true', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@language": "en-US" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile, normalizeLanguageTags: true });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'en-us')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'en-us')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'nl-be')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value')),
          ]);
        });

        describe('for @direction in context', () => {

          describe('rdfDirection: undefined', () => {
            it('with @id and a context-direction literal', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "rtl" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

            it('with @id and literal with default direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

            it('with @id and literal with default direction but overridden direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "ltr" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

            it('with @id and literal with default direction but unset direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });
          });

          describe('rdfDirection: i18n-datatype', () => {

            beforeEach(() => {
              parser = new JsonLdParser({ dataFactory: DF, streamingProfile, rdfDirection: 'i18n-datatype' });
            });

            it('with @id and a context-direction literal', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "rtl" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))),
              ]);
            });

            it('with @id and a context-direction literal and language', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "rtl" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#en-us_rtl'))),
              ]);
            });

            it('with @id and literal with default direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))),
              ]);
            });

            it('with @id and literal with default direction but overridden direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "ltr" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#_ltr'))),
              ]);
            });

            it('with @id and literal with default direction but unset direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

            it('with @id and literal with default direction and language but unset direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', 'en-us')),
              ]);
            });
          });

          describe('rdfDirection: compound-literal', () => {

            beforeEach(() => {
              parser = new JsonLdParser({ dataFactory: DF, streamingProfile, rdfDirection: 'compound-literal' });
            });

            it('with @id and a context-direction literal', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "rtl" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.blankNode('b1')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                  DF.literal('my value')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                  DF.literal('rtl')),
              ]);
            });

            it('with @id and a context-direction literal and language', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "rtl" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.blankNode('b1')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                  DF.literal('my value')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'language'),
                  DF.literal('en-us')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                  DF.literal('rtl')),
              ]);
            });

            it('with @id and literal with default direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.blankNode('b1')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                  DF.literal('my value')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                  DF.literal('rtl')),
              ]);
            });

            it('with @id and literal with default direction but overridden direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": "ltr" }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.blankNode('b1')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                  DF.literal('my value')),
                DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                  DF.literal('ltr')),
              ]);
            });

            it('with @id and literal with default direction but unset direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

            it('with @id and literal with default direction and language but unset direction', async () => {
              const stream = streamifyString(`
{
  "@context": {
    "@direction": "rtl",
    "@language": "en-us",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@direction": null }
  },
  "@id": "http://ex.org/myid",
  "p": "my value"
}`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', 'en-us')),
              ]);
            });
          });

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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('a')),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('true', DF.namedNode(Util.XSD_BOOLEAN))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('false', DF.namedNode(Util.XSD_BOOLEAN))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('typed literal Prop', DF.namedNode('http://example.org/type'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode(),
              DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode(),
              DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode(),
              DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode(),
              DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/g')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/obj1')),
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
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/pred2'), DF.namedNode('http://ex.org/obj1')),
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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred2'), DF.namedNode('http://ex.org/obj1')),

            DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/pred2'), DF.namedNode('http://ex.org/obj2')),
          ]);
        });

        it('with a list as @reverse value, with allowSubjectList false', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "term": {"@reverse": "http://example/reverse"}
  },
  "@id": "http://example/foo",
  "term": {"@list": ["http://example/bar"]}
}`);
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile, allowSubjectList: false });
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toThrow(new ErrorCoded('Found illegal list value in subject position at term',
              ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE));
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
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile, allowSubjectList: true });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://example/reverse'),
              DF.namedNode('http://example/foo')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'),
              DF.literal('http://example/bar')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')),
          ]);
        });
      });

      describe('two triples', () => {
        it('without @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/sub1",
  "http://ex.org/pred1": "http://ex.org/obj1",
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/sub1'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex.org/sub1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
          ]);
        });

        it('with @type, without @id', async () => {
          const stream = streamifyString(`
{
  "@type": "http://ex.org/obj1",
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/obj1')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
          ]);
        });

        it('with @type, with @id', async () => {
          const stream = streamifyString(`
{
  "@type": "http://ex.org/obj1",
  "@id": "http://ex.org/sub1",
  "http://ex.org/pred2": "http://ex.org/obj2"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/sub1'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), DF.namedNode('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex.org/sub1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/obj2')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('b1')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj1')),

            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('b2')),
            DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
          ]);
        });

        it('with @id and a boolean literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": true
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('true', DF.namedNode(Util.XSD_BOOLEAN))),
          ]);
        });

        it('with @id and a number literal', async () => {
          const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": 2.2
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('2.2E0', DF.namedNode(Util.XSD_DOUBLE))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', 'en-us')),
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

        describe('for @direction in @value', () => {

          describe('rdfDirection: undefined', () => {

            it('with @id and a language+direction literal', async () => {
              const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@language": "en-us",
    "@direction": "rtl"
  }
}]`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', 'en-us')),
              ]);
            });

            it('with @id and a direction literal', async () => {
              const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@direction": "rtl"
  }
}]`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value')),
              ]);
            });

          });

          describe('rdfDirection: i18n-datatype', () => {

            beforeEach(() => {
              parser = new JsonLdParser({ dataFactory: DF, streamingProfile, rdfDirection: 'i18n-datatype' });
            });

            it('with @id and a language+direction literal', async () => {
              const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@language": "en-us",
    "@direction": "rtl"
  }
}]`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#en-us_rtl'))),
              ]);
            });

            it('with @id and a direction literal', async () => {
              const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@direction": "rtl"
  }
}]`);
              return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
                DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                  DF.literal('my value', DF.namedNode('https://www.w3.org/ns/i18n#_rtl'))),
              ]);
            });

          });

        });

        describe('rdfDirection: compound-literal', () => {

          beforeEach(() => {
            parser = new JsonLdParser({ dataFactory: DF, streamingProfile, rdfDirection: 'compound-literal' });
          });

          it('with @id and a language+direction literal', async () => {
            const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@language": "en-us",
    "@direction": "rtl"
  }
}]`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                DF.literal('my value')),
              DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'language'),
                DF.literal('en-us')),
              DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                DF.literal('rtl')),
            ]);
          });

          it('with @id and a direction literal', async () => {
            const stream = streamifyString(`
[{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": {
    "@value": "my value",
    "@direction": "rtl"
  }
}]`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'value'),
                DF.literal('my value')),
              DF.quad(DF.blankNode('b1'), DF.namedNode(Util.RDF + 'direction'),
                DF.literal('rtl')),
            ]);
          });

        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
[{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}]`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.namedNode('http://ex/A'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex/B'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex/C'), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.namedNode('http://ex/A'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
            DF.quad(DF.namedNode('http://ex/B'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex/C'), DF.namedNode('http://ex.org/pred3'), DF.literal('http://ex.org/obj3')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": [ "a", "b", "c" ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": [ "a", "b", "c" ],
  "@id": "http://ex.org/myid",
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
          ]);
        });
      });

      describe('lists with', () => {

        describe('a triple with an anonymous set array', () => {
          it('without @id', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@set": [ "a", "b", "c" ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
            ]);
          });

          it('without @id and an empty list', async () => {
            const stream = streamifyString(`
{
  "http://ex.org/pred1": { "@list": [ ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
            ]);
          });

          it('with an anonymous list with null values in an invalid predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "http://ex.org/pred1": { "@container": "@list" }
  },
  "@id": "http://ex.org/myid",
  "ignored": { "@list": [ null, "a", null, "b", null, "c", null ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([]);
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('l')),
              DF.quad(DF.blankNode('l'), DF.namedNode(Util.RDF + 'first'),
                DF.literal('value', DF.namedNode('http://ex.org/datatype'))),
              DF.quad(DF.blankNode('l'), DF.namedNode(Util.RDF + 'rest'),
                DF.namedNode(Util.RDF + 'nil')),
            ]);
          });

          it('with a null value should be optimized', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@type": "http://ex.org/datatype" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ null ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
            ]);
          });

          it('with a null @value should be optimized', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/pred1", "@type": "http://ex.org/datatype" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ { "@value": null } ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode(Util.RDF + 'nil')),
            ]);
          });

          it('with a bad base should not be optimized, but empty first should be skipped', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://invalid/<>/",
    "p": { "@id": "http://ex.org/pred1", "@type": "@id" }
  },
  "@id": "http://ex.org/myid",
  "p": { "@list": [ "test" ] }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            expect(output).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('l')),
              DF.quad(DF.blankNode('l'), DF.namedNode(Util.RDF + 'rest'),
                DF.namedNode(Util.RDF + 'nil')),
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
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
            ]);
          });
        });

        describe('a triple with an anonymous list array, in an list container', () => {
          it('without @id', async () => {
            const stream = streamifyString(`
{
  "@context": { "p": {"@id": "http://ex.org/pred1", "@container": "@list" } },
  "p": [{ "@list": [ "a", "b", "c" ] }]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('lr0')),
            ]);
          });
        });

        describe('a triple with nested anonymous list arrays', () => {
          it('without @id, single outer value, and a single inner value', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{"@list": ["baz"]}]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('lr0')),
            ]);
          });

          it('without @id, single outer value, and multiple inner values', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{"@list": ["baz1", "baz2"]}]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('lr0')),
            ]);
          });

          it('without @id, multiple outer values, and a single inner value', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [
    {"@list": ["baz1"]},
    {"@list": ["baz2"]}
  ]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0.a'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0.0.a')),
              DF.quad(DF.blankNode('l0.a'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l0.b')),
              DF.quad(DF.blankNode('l0.b'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0.1.a')),
              DF.quad(DF.blankNode('l0.b'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0.0.a'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1')),
              DF.quad(DF.blankNode('l0.0.a'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0.1.a'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2')),
              DF.quad(DF.blankNode('l0.1.a'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0.a')),
            ]);
          });

          it('without @id, multiple outer values, and a multiple inner value', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [
    {"@list": ["baz1.1", "baz1.2"]},
    {"@list": ["baz2.1", "baz2.2"]}
  ]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0.a'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0.0.a')),
              DF.quad(DF.blankNode('l0.a'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l0.b')),
              DF.quad(DF.blankNode('l0.b'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0.1.a')),
              DF.quad(DF.blankNode('l0.b'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0.0.a'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1.1')),
              DF.quad(DF.blankNode('l0.0.a'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l0.0.b')),
              DF.quad(DF.blankNode('l0.0.b'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1.2')),
              DF.quad(DF.blankNode('l0.0.b'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0.1.a'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2.1')),
              DF.quad(DF.blankNode('l0.1.a'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l0.1.b')),
              DF.quad(DF.blankNode('l0.1.b'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2.2')),
              DF.quad(DF.blankNode('l0.1.b'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0.a')),
            ]);
          });

          it('without @id, single outer value, and a no inner value', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{"@list": []}]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('lr0')),
            ]);
          });

          it('without @id, single outer value, and a single inner value, and a non-list outer value after', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{"@list": ["baz"]}, { "@id": "ex:bla" }]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('lr1')),
              DF.quad(DF.blankNode('lr1'), DF.namedNode(Util.RDF + 'first'), DF.namedNode('ex:bla')),
              DF.quad(DF.blankNode('lr1'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('lr0')),
            ]);
          });

          it('without @id, single outer value, and a single inner value, and a non-list outer value before', async () => {
            const stream = streamifyString(`
{
  "http://example.com/foo": {"@list": [{ "@id": "ex:bla" }, {"@list": ["baz"]}]}
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'first'), DF.namedNode('ex:bla')),
              DF.quad(DF.blankNode('lr0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('lr1')),
              DF.quad(DF.blankNode('lr1'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l0')),
              DF.quad(DF.blankNode('lr1'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('a'), DF.namedNode('http://example.com/foo'), DF.blankNode('lr0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode(Util.RDF + 'nil')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
            ]);
          });
        });

        describe('a list container', () => {
          it('with a nested array with one inner element', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [["baz"]]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),
            ]);
          });

          it('with a nested array with two inner elements', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [["baz1", "baz2"]]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1.1')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1')),
              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1.2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),
            ]);
          });

          it('with a nested array with two outer elements having one inner element', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [["baz1.1"],["baz2.1"]]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1.1.1')),
              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1.2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1.1.2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1.1.1'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1.1')),
              DF.quad(DF.blankNode('l1.1.1'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1.1.2'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2.1')),
              DF.quad(DF.blankNode('l1.1.2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l1.1')),
            ]);
          });

          it('with a nested array with two outer elements having two inner elements', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [["baz1.1","baz1.2"],["baz2.1","baz2.2"]]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1.1.1')),
              DF.quad(DF.blankNode('l1.1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1.2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('l1.1.2')),
              DF.quad(DF.blankNode('l1.2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1.1.1'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1.1')),
              DF.quad(DF.blankNode('l1.1.1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1.1.1-')),
              DF.quad(DF.blankNode('l1.1.1-'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz1.2')),
              DF.quad(DF.blankNode('l1.1.1-'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('l1.1.2'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2.1')),
              DF.quad(DF.blankNode('l1.1.2'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1.1.2-')),
              DF.quad(DF.blankNode('l1.1.2-'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz2.2')),
              DF.quad(DF.blankNode('l1.1.2-'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l1.1')),
            ]);
          });

          it('with an inner predicate with array with one element', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [{
    "ex:p": ["a"]
  }]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b0'), DF.namedNode('ex:p'), DF.literal('a')),

              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('b0')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),
            ]);
          });

          it('with an inner predicate with array with zero elements', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [{
    "ex:p": []
  }]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('b0')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),
            ]);
          });

          it('with an empty inner node', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": [{}]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('b0')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),
            ]);
          });

          it('without inner node', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "foo": []
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:id'), DF.namedNode('http://example.com/foo'), DF.namedNode(Util.RDF + 'nil')),
            ]);
          });
        });

        describe('a list container inside a node', () => {
          it('with one inner element', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "ex:p": {
    "foo": ["baz"]
  }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.blankNode('b0')),
            ]);
          });

          it('with zero inner elements', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "ex:p": {
    "foo": []
  }
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example.com/foo'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.blankNode('b0')),
            ]);
          });
        });

        describe('a list container inside a normal array', () => {
          it('with one inner element', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "ex:p": [
    {
      "foo": ["baz"]
    }
  ]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('baz')),
              DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example.com/foo'), DF.blankNode('l0')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.blankNode('b0')),
            ]);
          });

          it('with zero inner elements', async () => {
            const stream = streamifyString(`
{
  "@context": {"foo": {"@id": "http://example.com/foo", "@container": "@list"}},
  "@id": "ex:id",
  "ex:p": [{
    "foo": []
  }]
}`);
            const output = await arrayifyStream(stream.pipe(parser));
            return expect(output).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example.com/foo'), DF.namedNode(Util.RDF + 'nil')),

              DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.blankNode('b0')),
            ]);
          });
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
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('abc')),
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
            DF.quad(DF.blankNode('b0'), DF.namedNode('http://ex.org/pred2'), DF.blankNode('l0')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('b0')),
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
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.blankNode('b0')),
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
            DF.quad(DF.blankNode('b0'), DF.namedNode('http://ex.org/pred2'), DF.literal('abc')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
          ]);
        });
      });

      describe('two nested triples', () => {
        it('without @id and without inner @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": {
    "http://ex.org/pred2": "http://ex.org/obj2"
  }
}`);
          const output = await arrayifyStream(stream.pipe(parser));
          return expect(output).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('b')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('a')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('a')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myinnerid')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('ABC')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('ABC')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
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
    "@type": "http://ex.org/obj1",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myinnerid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
          ]);
        });

        it('with @id with inner subject @id and an invalid @type', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "@graph": {
    "@type": "http://ex.org/ obj1",
    "@id": "http://ex.org/myinnerid"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.defaultGraph()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.defaultGraph()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('http://ex.org/obj2'), DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'), DF.defaultGraph()),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2'), DF.defaultGraph()),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.namedNode('http://ex.org/myid')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2'),
              DF.blankNode('g1')),
            DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/pred2'), DF.literal('http://ex.org/obj2')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.blankNode()),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('http://ex.org/obj1'), DF.namedNode('http://ex.org/mymiddleid')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner'),
              DF.namedNode('http://ex.org/mygraph')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner'),
              DF.namedNode('http://ex.org/mygraph')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner'),
              DF.namedNode('http://ex.org/mygraph')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an in-order @graph id in an array with @type', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@type": "http://ex.org/mytype",
    "@id": "http://ex.org/myid"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/mytype'),
              DF.namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an in-order @graph id in an array with @type array', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@type": [ "http://ex.org/mytype1", "http://ex.org/mytype2" ],
    "@id": "http://ex.org/myid"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/mytype1'),
              DF.namedNode('http://ex.org/mygraph')),
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/mytype2'),
              DF.namedNode('http://ex.org/mygraph')),
          ]);
        });

        it('with an in-order @graph id in an array with @type array with an invalid IRI', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/mygraph",
  "@graph": [{
    "@type": [ "http://ex.org/ mytype1", "http://ex.org/mytype2" ],
    "@id": "http://ex.org/myid"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/mytype2'),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner'),
              DF.namedNode('http://ex.org/mygraph')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myidinner')),
            DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://ex.org/pred2'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype'))),
          ]);
        });

        it('with separate inner contexts should not modify each other', async () => {
          const stream = streamifyString(`
{
  "@context": { "@vocab": "http://vocab0.org/" },
  "@graph": [
    {
      "@id": "http://ex.org/myid0",
      "pred0": "abc0"
    },
    {
      "@context": { "@vocab": "http://vocab1.org/" },
      "@id": "http://ex.org/myid1",
      "pred1": "abc1"
    },
    {
      "@context": { "@vocab": "http://vocab2.org/" },
      "@id": "http://ex.org/myid2",
      "pred2": "abc2"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid0'), DF.namedNode('http://vocab0.org/pred0'),
              DF.literal('abc0')),
            DF.quad(DF.namedNode('http://ex.org/myid1'), DF.namedNode('http://vocab1.org/pred1'),
              DF.literal('abc1')),
            DF.quad(DF.namedNode('http://ex.org/myid2'), DF.namedNode('http://vocab2.org/pred2'),
              DF.literal('abc2')),
          ]);
        });

        it('with separate inner contexts should not modify each other (2)', async () => {
          const stream = streamifyString(`
{
  "@graph": [
    {
      "@context": { "@vocab": "http://vocab0.org/" },
      "@id": "http://ex.org/myid0",
      "pred0": "abc0"
    },
    {
      "@context": { "@vocab": "http://vocab1.org/" },
      "@id": "http://ex.org/myid1",
      "pred1": "abc1"
    },
    {
      "@context": { "@vocab": "http://vocab2.org/" },
      "@id": "http://ex.org/myid2",
      "pred2": "abc2"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid0'), DF.namedNode('http://vocab0.org/pred0'),
              DF.literal('abc0')),
            DF.quad(DF.namedNode('http://ex.org/myid1'), DF.namedNode('http://vocab1.org/pred1'),
              DF.literal('abc1')),
            DF.quad(DF.namedNode('http://ex.org/myid2'), DF.namedNode('http://vocab2.org/pred2'),
              DF.literal('abc2')),
          ]);
        });

        it('with separate inner contexts should not modify each other (3)', async () => {
          const stream = streamifyString(`
{
  "@context": { "@vocab": "http://vocab.org/" },
  "@graph": [
    {
      "@context": { "@vocab": "http://vocab0.org/" },
      "@id": "http://ex.org/myid0",
      "pred0": "abc0"
    },
    {
      "@context": { "@vocab": "http://vocab1.org/" },
      "@id": "http://ex.org/myid1",
      "pred1": "abc1"
    },
    {
      "@context": { "@vocab": "http://vocab2.org/" },
      "@id": "http://ex.org/myid2",
      "pred2": "abc2"
    },
    {
      "@id": "http://ex.org/myid3",
      "pred3": "abc3"
    }
  ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid0'), DF.namedNode('http://vocab0.org/pred0'),
              DF.literal('abc0')),
            DF.quad(DF.namedNode('http://ex.org/myid1'), DF.namedNode('http://vocab1.org/pred1'),
              DF.literal('abc1')),
            DF.quad(DF.namedNode('http://ex.org/myid2'), DF.namedNode('http://vocab2.org/pred2'),
              DF.literal('abc2')),
            DF.quad(DF.namedNode('http://ex.org/myid3'), DF.namedNode('http://vocab.org/pred3'),
              DF.literal('abc3')),
          ]);
        });
      });

      describe('arrays in a graph', () => {
        it('with a predicate in predicate with anonymous bnode in array', async () => {
          const stream = streamifyString(`
{
  "@graph": [
    {
      "@id": "ex:s",
      "ex:p1": {
        "ex:p2": [{}]
      }
    }
  ]
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('ex:s'), DF.namedNode('ex:p1'), DF.blankNode('b0')),
            DF.quad(DF.blankNode('b0'), DF.namedNode('ex:p2'), DF.blankNode('b1')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.literal('http://ex.org/obj1')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://example.org/SomeInnerTerm'),
                DF.literal('abc')),
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://example.org/SomeInnerTerm'),
                DF.literal('abc')),
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://ex.org/s'), DF.namedNode('http://ex.org/p1'),
                DF.namedNode('http://ex.org/obj11')),
              DF.quad(DF.namedNode('http://ex.org/obj11'), DF.namedNode('http://example.org/SomeInnerTerm1'),
                DF.literal('http://ex.org/obj2')),
              DF.quad(DF.namedNode('http://ex.org/s'), DF.namedNode('http://ex.org/p2'),
                DF.namedNode('http://ex.org/obj12')),
              DF.quad(DF.namedNode('http://ex.org/obj12'), DF.namedNode('http://example.org/SomeInnerTerm2'),
                DF.literal('http://ex.org/obj2')),
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
        "@id": "../document-relative2",
        "property": "context completely reset, drops property"
      }
    ]
  }
}`);
            parser = new JsonLdParser({
              streamingProfile,
              baseIRI: 'https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld',
              dataFactory: DF,
            });
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example.org/document-base-overwritten'),
                DF.namedNode('http://example.com/vocab#property'),
                DF.namedNode('https://json-ld.org/test-suite/document-relative2')),
              DF.quad(DF.namedNode('https://json-ld.org/test-suite/document-relative'),
                DF.namedNode('http://example.com/vocab#property'),
                DF.namedNode('http://example.org/document-base-overwritten')),
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
              streamingProfile,
              baseIRI: 'https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld',
              dataFactory: DF,
              streamingProfileAllowOutOfOrderPlainType: true,
            });
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example.org/document-base-overwritten'),
                DF.namedNode('http://example.com/vocab#property'),
                DF.namedNode('https://json-ld.org/test-suite/document-relative')),
              DF.quad(DF.namedNode('http://example.org/document-base-overwritten'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/test/#document-base-overwritten')),
              DF.quad(DF.namedNode('https://json-ld.org/test-suite/document-relative'),
                DF.namedNode('http://example.com/vocab#property'),
                DF.namedNode('http://example.org/document-base-overwritten')),
              DF.quad(DF.namedNode('https://json-ld.org/test-suite/document-relative'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld#document-relative')),
            ]);
          });

          it('with complex overriding of @base (2)', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/test/"
  },
  "@id": "http://example.org/s",
  "http://example.org/p": [
    {
      "@context": null,
      "@id": "../document-relative"
    },
    {
      "@context": {
        "@base": null
      },
      "@id": "../ignore-me"
    }
  ]
}`);
            parser = new JsonLdParser({
              streamingProfile,
              baseIRI: 'https://json-ld.org/test-suite/tests/toRdf-0100-in.jsonld',
              dataFactory: DF,
            });
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example.org/s'),
                DF.namedNode('http://example.org/p'),
                DF.namedNode('https://json-ld.org/test-suite/document-relative')),
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
            DF.quad(DF.namedNode('http://example.org/'), DF.namedNode('http://ex.org/pred'),
              DF.namedNode('http://example.org/bla')),
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
            DF.quad(DF.namedNode('http://abc'), DF.namedNode('http://ex.org/pred'),
              DF.namedNode('http://bla')),
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
            DF.quad(DF.namedNode('http://example.org/'), DF.namedNode('http://ex.org/pred'),
              DF.namedNode('http://example.org/bla')),
          ]);
        });

        it('with @base and @vocab with triples, with @vocab=null, should resolve @type to baseIRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
    "@vocab": null
  },
  "@type": "bla",
  "@id": ""
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/bla')),
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
            DF.quad(DF.namedNode('http://example.org/'),
              DF.namedNode('http://ex.org/p'),
              DF.literal('val', DF.namedNode('http://example.org/bla'))),
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
            DF.quad(DF.namedNode('http://abc'), DF.namedNode('http://example.org/pred'),
              DF.literal('http://bla')),
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
            DF.quad(DF.namedNode('http://abc'), DF.namedNode('http://example.org/pred'),
              DF.literal('http://bla')),
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
            DF.quad(DF.namedNode('http://abc'), DF.namedNode('http://example.org/pred'),
              DF.namedNode('http://bla')),
          ]);
        });
      });

      describe('for @vocab=""', () => {
        it('with @base and @vocab should reuse the base IRI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/document",
    "@vocab": "#"
  },
  "@type": "Restaurant",
  "@id": "http://example.org/places#BrewEats",
  "name": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/places#BrewEats'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example/document#Restaurant')),
            DF.quad(DF.namedNode('http://example.org/places#BrewEats'), DF.namedNode('http://example/document#name'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('with @base and @vocab should reuse the base IRI in 1.1', async () => {
          parser = new JsonLdParser({ processingMode: '1.1' });
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/document",
    "@vocab": "#"
  },
  "@id": "http://example.org/places#BrewEats",
  "@type": "Restaurant",
  "name": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/places#BrewEats'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example/document#Restaurant')),
            DF.quad(DF.namedNode('http://example.org/places#BrewEats'), DF.namedNode('http://example/document#name'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('with @base and relative @vocab should throw in 1.0', async () => {
          parser = new JsonLdParser({ processingMode: '1.0' });
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/document",
    "@vocab": "#"
  },
  "@id": "http://example.org/places#BrewEats",
  "@type": "Restaurant",
  "name": "Brew Eats"
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
            new Error('Relative vocab expansion for term \'Restaurant\' with vocab \'#\' is not allowed.'));
        });
      });

      describe('for prefixes', () => {
        it('with @prefix ending on non-gen-delim char should not error', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "abc": { "@id": "http://ex.org/compact-", "@prefix": true }
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('http://ex.org/compact-def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('without @prefix ending on non-gen-delim char should not expand', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "abc": { "@id": "http://ex.org/compact-" }
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('abc:def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('without @prefix ending on gen-delim char should not expand', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "abc": { "@id": "http://ex.org/compact/" }
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('abc:def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('in compact form ending on non-gen-delim char should not expand', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "abc": "http://ex.org/compact-"
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('abc:def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('in compact form ending on gen-delim char should expand', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "abc": "http://ex.org/compact/"
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('http://ex.org/compact/def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('without @prefix in 1.0 ending on non-gen-delim char should not expand', async () => {
          parser = new JsonLdParser({ processingMode: '1.0' });
          const stream = streamifyString(`
{
  "@context": {
    "abc": { "@id": "http://ex.org/compact-" }
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('abc:def'),
              DF.literal('Brew Eats')),
          ]);
        });

        it('with @prefix in 1.0 ending on non-gen-delim char should not expand', async () => {
          parser = new JsonLdParser({ processingMode: '1.0' });
          const stream = streamifyString(`
{
  "@context": {
    "abc": { "@id": "http://ex.org/compact-", "@prefix": true }
  },
  "abc:def": "Brew Eats"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('http://example.org/places#BrewEats'),
              DF.namedNode('abc:def'),
              DF.literal('Brew Eats')),
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
          DF.quad(DF.namedNode('http://abc'), DF.namedNode('http://example.org/pred1'),
            DF.namedNode('http://bla')),
        ]);
      });

      describe('allowing non-streaming profiles', () => {

        beforeEach(() => {
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile: false });
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
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.literal('http://ex.org/obj1')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.literal('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://example.org/'), DF.namedNode('http://ex.org/pred'),
                DF.namedNode('http://example.org/bla')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://example.com/anotherVocab#term'),
                DF.literal('value of term')),
            ]);
          });

          it('with a context entry referring to itself, should ignore the base', async () => {
            parser = new JsonLdParser(
              { dataFactory: DF, streamingProfile, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.com/anotherVocab#",
    "term": "term"
  },
  "term": "value of term"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode(), DF.namedNode('http://example.com/anotherVocab#term'),
                DF.literal('value of term')),
            ]);
          });

          it('with context-based @type based on @vocab', async () => {
            parser = new JsonLdParser(
              { dataFactory: DF, streamingProfile, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
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
              DF.quad(DF.blankNode(), DF.namedNode('http://vocab.org/date'),
                DF.literal('2011-01-25T00:00:00Z', DF.namedNode('http://vocab.org/dateTime'))),
            ]);
          });

          it('with inline @type based on @vocab', async () => {
            parser = new JsonLdParser(
              { dataFactory: DF, streamingProfile, baseIRI: 'https://json-ld.org/test-suite/tests/manifest.json' });
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
  },
  "date": { "@value": "2011-01-25T00:00:00Z", "@type": "dateTime" }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode(), DF.namedNode('http://vocab.org/date'),
                DF.literal('2011-01-25T00:00:00Z', DF.namedNode('http://vocab.org/dateTime'))),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/pred1'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://example.org/A'), DF.namedNode('http://example.org/SomeTerm'),
                DF.namedNode('http://ex.org/obj1')),
              DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://example.org/SomeInnerTerm'),
                DF.literal('B')),
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
              DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://example.org/SomeInnerTerm'),
                DF.literal('abc')),
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
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
              DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://example.org/SomeInnerTerm'),
                DF.literal('abc')),
              DF.quad(DF.blankNode(), DF.namedNode('http://example.org/SomeTerm'), DF.namedNode('http://ex.org/obj1')),
            ]);
          });
        });

        describe('an out-of-order type-scoped context', () => {
          it('with a context, predicate and contexted-type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, predicate and non-contexted-type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, contexted-type and predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "@type": "Foo",
  "pred1": "http://ex.org/obj1"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, non-contexted-type and predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "@type": "Foo",
  "pred1": "http://ex.org/obj1"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a predicate, context and contexted-type', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "@type": "Foo"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a predicate, context and non-contexted-type', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "@type": "Foo"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a predicate, contexted-type and context', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@type": "Foo",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a predicate, non-contexted-type and context', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@type": "Foo",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a contexted-type, predicate and context', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a non-contexted-type, predicate and context', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a contexted-type, context and predicate', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a non-contexted-type, context and predicate', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, and two sets of predicate and contexted-type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "a": {
    "pred1": "http://ex.org/obj1",
    "@type": "Foo"
  },
  "b": {
    "pred2": "http://ex.org/obj2",
    "@type": "Foo"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://vocab.org/a'), DF.blankNode('b1')),
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://vocab.org/b'), DF.blankNode('b2')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://vocab.1.org/pred2'), DF.literal('http://ex.org/obj2')),
            ]);
          });

          it('with a context, predicate and 2 contexted-types in array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": [ "Foo", "Foo2" ]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://vocab.org/Foo2')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, predicate and contexted-type, followed by another predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo",
  "pred2": "http://ex.org/obj2",
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred2'), DF.literal('http://ex.org/obj2')),
            ]);
          });

          it('with a context, predicate and contexted-type, followed by another predicate with inner node', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo",
  "pred2": {
    "@id": "http://ex.org/obj2",
    "pred3": "http://ex.org/obj3",
  },
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred2'), DF.namedNode('http://ex.org/obj2')),
              DF.quad(DF.namedNode('http://ex.org/obj2'), DF.namedNode('http://vocab.org/pred3'),
                DF.literal('http://ex.org/obj3')),
            ]);
          });

          it('with a context, predicate and inner id and inner type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/base-base",
    "@vocab": "http://example/",
    "foo": "http://example/foo",
    "Type": {
      "@context": {
        "@base": "http://example/typed-base"
      }
    }
  },
  "@id": "#base-id",
  "p": {
    "@id": "#typed-id",
    "@type": "Type"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Type')),
              DF.quad(DF.namedNode('http://example/base-base#base-id'), DF.namedNode('http://example/p'),
                DF.namedNode('http://example/typed-base#typed-id')),
            ]);
          });
        });

      });

      describe('only allowing streaming profiles', () => {

        beforeEach(() => {
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile: true });
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

        describe('an out-of-order type-scoped context', () => {
          it('with a context, predicate and contexted-type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'type-scoped context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a context, predicate and non-contexted-type without streamingProfileAllowOutOfOrderPlainType', async () => {
            parser = new JsonLdParser(
              { dataFactory: DF, streamingProfile: true });
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
              'Found an out-of-order type-scoped context, while streaming is enabled.' +
              '(disable `streamingProfile`)', ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a context, predicate and non-contexted-type with streamingProfileAllowOutOfOrderPlainType', async () => {
            parser = new JsonLdParser({ dataFactory: DF, streamingProfile: true, streamingProfileAllowOutOfOrderPlainType: true });
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "pred1": "http://ex.org/obj1",
  "@type": "Foo"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, contexted-type and predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "@type": "Foo",
  "pred1": "http://ex.org/obj1"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.1.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a context, non-contexted-type and predicate', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "@type": "Foo",
  "pred1": "http://ex.org/obj1"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.org/Foo')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://vocab.org/pred1'), DF.literal('http://ex.org/obj1')),
            ]);
          });

          it('with a predicate, context and contexted-type', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "@type": "Foo"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a predicate, context and non-contexted-type', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "@type": "Foo"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a predicate, contexted-type and context', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a predicate, non-contexted-type and context', async () => {
            const stream = streamifyString(`
{
  "pred1": "http://ex.org/obj1",
  "@type": "Foo",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'type-scoped context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a contexted-type, predicate and context', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a non-contexted-type, predicate and context', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "pred1": "http://ex.org/obj1",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a contexted-type, context and predicate', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/"
      }
    }
  },
  "pred1": "http://ex.org/obj1"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a non-contexted-type, context and predicate', async () => {
            const stream = streamifyString(`
{
  "@type": "Foo",
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://example.org/Foo"
    }
  },
  "pred1": "http://ex.org/obj1"
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
          });

          it('with a context, predicate and inner id and inner type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/base-base",
    "@vocab": "http://example/",
    "foo": "http://example/foo",
    "Type": {
      "@context": {
        "@base": "http://example/typed-base"
      }
    }
  },
  "@id": "#base-id",
  "p": {
    "@id": "#typed-id",
    "@type": "Type"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded('Found an out-of-order ' +
              'type-scoped context, while streaming is enabled.(disable `streamingProfile`)',
              ERROR_CODES.INVALID_STREAMING_KEY_ORDER));
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
            DF.quad(DF.blankNode(), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node', async () => {
          const stream = streamifyString(`
{
  "@type": "http://example.org/abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node should work with @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/"
  },
  "@type": "abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node with a prefixed @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://example.org/"
  },
  "@type": "ex:abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node with an aliased @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://example.org/",
    "t": { "@id": "@type", "@type": "@id" }
  },
  "t": "ex:abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node in a @graph', async () => {
          const stream = streamifyString(`
{
  "@id": "http://example.org/myGraph",
  "@graph": {
    "@type": "http://example.org/abc",
    "@id": "http://example.org/node"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc'),
              DF.namedNode('http://example.org/myGraph')),
          ]);
        });

        it('on a named node in an out-of-order @graph', async () => {
          const stream = streamifyString(`
{
  "@graph": {
    "@type": "http://example.org/abc",
    "@id": "http://example.org/node"
  },
  "@id": "http://example.org/myGraph"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc'),
              DF.namedNode('http://example.org/myGraph')),
          ]);
        });

        it('on an out-of-order named node', async () => {
          const stream = streamifyString(`
{
  "@type": "http://example.org/abc",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc')),
          ]);
        });

        it('on a named node with multiple @types should work with @vocab', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/"
  },
  "@type": [
    "abc1",
    "abc2",
    "abc3"
  ],
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc1')),
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc2')),
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc3')),
          ]);
        });

        it('on a named node with multiple @types', async () => {
          const stream = streamifyString(`
{
  "@type": [
    "http://example.org/abc1",
    "http://example.org/abc2",
    "http://example.org/abc3"
  ],
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc1')),
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc2')),
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/abc3')),
          ]);
        });

        it('on a named node with multiple aliased @type entries', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "type1": "@type",
    "type2": "@type"
  },
  "type1": "Type1",
  "type2": "Type2",
  "@id": "http://example.org/node"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/Type1')),
            DF.quad(DF.namedNode('http://example.org/node'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://example.org/Type2')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://example.org/abc')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://base.org/abc')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://vocab.org/abc')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://base.org/abc')),
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://ex.org/use-me')),
          ]);
        });

        it('should handle @type: @vocab with native value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@vocab" }
  },
  "p": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.literal('true', DF.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
          ]);
        });

        it('should not use context terms for @type: @id', async () => {
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
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.namedNode('http://base.org/abc')),
          ]);
        });

        it('should handle @type: @id with native value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "@vocab": "http://vocab.org/",
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" }
  },
  "p": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.literal('true', DF.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
          ]);
        });

        it('on a native value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" },
  },
  "p": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(), DF.namedNode('http://ex.org/predicate'),
              DF.literal('true', DF.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
          ]);
        });

        it('on native values', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/predicate", "@type": "@id" },
  },
  "p": [ true, 1 ]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/predicate'),
              DF.literal('true', DF.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/predicate'),
              DF.literal('1', DF.namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
          ]);
        });

        it('for @type: @none on a boolean', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/predicate", "@type": "@none" },
  },
  "p": true
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/predicate'),
              DF.literal('true', DF.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))),
          ]);
        });

        it('for @type: @none on an @value with date', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "p": { "@id": "http://ex.org/predicate", "@type": "@none" },
  },
  "p": { "@value": "2018-02-17", "@type": "http://www.w3.org/2001/XMLSchema#date" }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode('b'), DF.namedNode('http://ex.org/predicate'),
              DF.literal('2018-02-17', DF.namedNode('http://www.w3.org/2001/XMLSchema#date'))),
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
              DF.quad(DF.blankNode(), DF.blankNode('p'), DF.namedNode('http://example.org/abc')),
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
              DF.quad(DF.blankNode('a'), DF.blankNode('p'), DF.namedNode('http://example.org/abc1')),
              DF.quad(DF.blankNode('a'), DF.blankNode('p'), DF.namedNode('http://example.org/abc2')),
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
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l3')),
              DF.quad(DF.blankNode('l3'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l3'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.blankNode('p'), DF.blankNode('l1')),
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
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
              DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
              DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l3')),
              DF.quad(DF.blankNode('l3'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
              DF.quad(DF.blankNode('l3'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.blankNode('p'), DF.blankNode('l1')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
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
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile, baseIRI: 'http://ex.org/' });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
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
          parser = new JsonLdParser({ dataFactory: DF, streamingProfile, baseIRI: 'http://ex.org/' });
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
          ]);
        });

        it('should alias @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "a": "@type"
  },
  "a": "http://ex.org/bla",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              DF.namedNode('http://ex.org/bla')),
          ]);
        });

        it('should error on alias a reversed @type', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "a": { "@reverse": "@type" }
  },
  "@id": "http://ex.org/myid",
  "a": "http://ex.org/bla",
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toThrow(new ErrorCoded('Invalid @reverse value, must be absolute IRI or blank node: \'@type\'',
            ERROR_CODES.INVALID_IRI_MAPPING));
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
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'),
              DF.namedNode('http://xmlns.com/foaf/0.1/name'),
              DF.literal('Bob', 'en')),
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
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'first'), DF.literal('a')),
            DF.quad(DF.blankNode('l0'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l1')),
            DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'first'), DF.literal('b')),
            DF.quad(DF.blankNode('l1'), DF.namedNode(Util.RDF + 'rest'), DF.blankNode('l2')),
            DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'first'), DF.literal('c')),
            DF.quad(DF.blankNode('l2'), DF.namedNode(Util.RDF + 'rest'), DF.namedNode(Util.RDF + 'nil')),
            DF.quad(DF.blankNode('a'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('l0')),
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
            DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'),
              DF.namedNode('http://ex.org/myid')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('my value', DF.namedNode('http://ex.org/mytype')),
              DF.namedNode('http://ex.org/mygraph')),
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
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('a')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('b')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'), DF.literal('c')),
          ]);
        });
      });

      describe('quads with nested contexts', () => {
        it('with an inner context in an object', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ldp": "http://www.w3.org/ns/ldp#",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  "@id": "https://api.coopstarter.happy-dev.fr/resources/",
  "ldp:contains": {
    "@context": {
      "preview_image": "foaf:depiction"
    },
    "@id": "https://api.coopstarter.happy-dev.fr/resources/1/"
  }
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('https://api.coopstarter.happy-dev.fr/resources/'),
              DF.namedNode('http://www.w3.org/ns/ldp#contains'),
              DF.namedNode('https://api.coopstarter.happy-dev.fr/resources/1/')),
          ]);
        });

        it('with an inner context in an array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ldp": "http://www.w3.org/ns/ldp#",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  "@id": "https://api.coopstarter.happy-dev.fr/resources/",
  "ldp:contains": [
    {
      "@context": {
        "preview_image": "foaf:depiction"
      },
      "@id": "https://api.coopstarter.happy-dev.fr/resources/1/"
    }
  ]
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('https://api.coopstarter.happy-dev.fr/resources/'),
              DF.namedNode('http://www.w3.org/ns/ldp#contains'),
              DF.namedNode('https://api.coopstarter.happy-dev.fr/resources/1/')),
          ]);
        });
      });

      describe('JSON literals', () => {
        it('should error in 1.0', async () => {
          parser = new JsonLdParser({ processingMode: '1.0' });
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": true
}
`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toThrow(new ErrorCoded(`A context @type must be an absolute IRI, found: 'e': '@json'`,
            ERROR_CODES.INVALID_TYPE_MAPPING));
        });

        it('with a single literal value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": true
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('true', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with a single null value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": null
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('null', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with a JSON object', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": { "a": true }
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('{"a":true}', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with a JSON object that contains an entry looking like a valid URI', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": { "http://example.org/predicate": true }
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('{"http://example.org/predicate":true}',
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with a JSON object that should be canonicalized', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": { "zzz": "z", "b": 3, "a": true }
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('{"a":true,"b":3,"zzz":"z"}', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with a JSON array', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": [ "a", true ]
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('["a",true]', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });

        it('with nested JSON', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "e": {"@id": "http://example.com/vocab/json", "@type": "@json"}
  },
  "e": { "a": [ "a", true ] }
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''),
              DF.namedNode('http://example.com/vocab/json'),
              DF.literal('{"a":["a",true]}', DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#JSON'))),
          ]);
        });
      });

      describe('containers', () => {

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
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/pred1'),
              DF.literal('a')),
          ]);

        });

        describe('for languages', () => {

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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
            ]);
          });

          it('with @id and language map with array container entry', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@language" ] }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
            ]);
          });

          it('with @id and language map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@language", "@set" ] }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja2', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
            ]);
          });

          it('with @id and language map should not interpret language as predicates', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.org/",
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
            ]);
          });

          it('with @id and language map with @none', async () => {
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
    "cs": "Nindža",
    "@none": "Default"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Default')),
            ]);
          });

          it('with @id and language map with aliased @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@language" },
    "none": "@none"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža",
    "none": "Default"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者', 'ja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja', 'en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža', 'cs')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Default')),
            ]);
          });

          it('with @id and language map containing an invalid value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@language" },
    "none": "@none"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": true
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
              'Got invalid language map value, got \'true\', but expected string',
              ERROR_CODES.INVALID_LANGUAGE_MAP_VALUE));
          });

          it('with @id and language map containing an invalid value in an array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@language" },
    "none": "@none"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": [ true, false ]
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
              'Got invalid language map value, got \'true\', but expected string',
              ERROR_CODES.INVALID_LANGUAGE_MAP_VALUE));
          });

        });

        describe('for indexes', () => {

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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža')),
            ]);
          });

          it('with @id and index map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@index", "@set" ] }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": "忍者",
    "en": "Ninja",
    "cs": "Nindža"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža')),
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
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža')),
            ]);
          });

          it('with @id and index map with an empty value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "en": []
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and index map with @none', async () => {
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
    "cs": "Nindža",
    "@none": "Default"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Default')),
            ]);
          });

          it('with @id and index map with @value objects', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": { "@value": "忍者" },
    "en": { "@value": "Ninja" },
    "cs": { "@value": "Nindža" }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('忍者')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Ninja')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.literal('Nindža')),
            ]);
          });

          it('with @id and index map with value nodes', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ja": { "@id": "ex:id1" },
    "en": { "@id": "ex:id2" },
    "cs": { "@id": "ex:id3" }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id3')),
            ]);
          });

          it('should be removable by overriding with a type-scoped context', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example/",
    "prop": {"@container": "@index"},
    "Outer": {
      "@context": {
        "prop": {
          "@id": "http://example/outer-prop"
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "ex:outer",
  "prop": {
    "Inner": {
      "@id": "ex:inner"
    }
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('http://example/outer-prop'),
                DF.blankNode('b0')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Outer')),
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example/Inner'),
                DF.namedNode('ex:inner')),
            ]);
          });

          it('with multiple raw value entries in one index', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "container": { "@id": "ex:container", "@container": "@index" }
  },
  "@id": "ex:root",
  "container": {
    "A": [
      "A",
      "B"
    ]
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:root'), DF.namedNode('ex:container'), DF.literal('A')),
              DF.quad(DF.namedNode('ex:root'), DF.namedNode('ex:container'), DF.literal('B')),
            ]);
          });

          it('with multiple @value entries in one index', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "container": { "@id": "ex:container", "@container": "@index" }
  },
  "@id": "ex:root",
  "container": {
    "A": [
      { "@value": "A" },
      { "@value": "B" }
    ]
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:root'), DF.namedNode('ex:container'), DF.literal('A')),
              DF.quad(DF.namedNode('ex:root'), DF.namedNode('ex:container'), DF.literal('B')),
            ]);
          });

        });

        describe('for property-based indexes', () => {

          it('with @id and index map with one entry', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
            ]);
          });

          it('with @id and index map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    },
    "Value2": {
      "@id": "ex:id2",
      "ex:name": "Name2"
    },
    "Value3": {
      "@id": "ex:id3",
      "ex:name": "Name3"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name3')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value3')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id3')),
            ]);
          });

          it('with @id and index map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@index", "@set" ], "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    },
    "Value2": {
      "@id": "ex:id2",
      "ex:name": "Name2"
    },
    "Value3": {
      "@id": "ex:id3",
      "ex:name": "Name3"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name3')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value3')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id3')),
            ]);
          });

          it('with @id and index map with a single element with array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value2": [{
      "@id": "ex:id2.1",
      "ex:name": "Name2.1"
    },{
      "@id": "ex:id2.2",
      "ex:name": "Name2.2"
    }]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id2.1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2.1')),
              DF.quad(DF.namedNode('http://ex.org/id2.1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id2.2'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2.2')),
              DF.quad(DF.namedNode('http://ex.org/id2.2'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2.2')),
            ]);
          });

          it('with @id and index map with an array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    },
    "Value2": [{
      "@id": "ex:id2.1",
      "ex:name": "Name2.1"
    },{
      "@id": "ex:id2.2",
      "ex:name": "Name2.2"
    }],
    "Value3": {
      "@id": "ex:id3",
      "ex:name": "Name3"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/id2.1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2.1')),
              DF.quad(DF.namedNode('http://ex.org/id2.1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id2.2'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2.2')),
              DF.quad(DF.namedNode('http://ex.org/id2.2'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name3')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value3')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2.2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id3')),
            ]);
          });

          it('with @id and index map with an empty value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": []
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and index map with @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    },
    "Value2": {
      "@id": "ex:id2",
      "ex:name": "Name2"
    },
    "@none": {
      "@id": "ex:id3",
      "ex:name": "Name3"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name2')),
              DF.quad(DF.namedNode('http://ex.org/id2'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value2')),
              DF.quad(DF.namedNode('http://ex.org/id3'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name3')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id3')),
            ]);
          });

          it('with @id and index map with one entry with invalid property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
            ]);
          });

          it('with @id and index map with one entry where prop has @type: @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://base.org/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" },
    "ex:prop": { "@type": "@id" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/name'),
                DF.literal('Name1')),
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.namedNode('http://base.org/Value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
            ]);
          });

          it('with a keyword @index value should error', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "@keyword" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
              new ErrorCoded('Keywords can not be used as @index value, got: @keyword',
                ERROR_CODES.INVALID_TERM_DEFINITION));
          });

          it('with a non-string @index value should error', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": true }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": {
      "@id": "ex:id1",
      "ex:name": "Name1"
    }
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
              new ErrorCoded('@index values must be strings, got: true',
              ERROR_CODES.INVALID_TERM_DEFINITION));
          });

          it('with @id and index map with a raw value should error', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": "ex:id1"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
              new ErrorCoded('Property-based index containers require nodes as values or strings with ' +
                '@type: @id, but got: ex:id1',
                ERROR_CODES.INVALID_VALUE_OBJECT));
          });

          it('with @id and index map with a raw value in an array should error', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": [ "ex:id1" ]
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
              new ErrorCoded('Property-based index containers require nodes as values or strings with ' +
                '@type: @id, but got: ex:id1',
                ERROR_CODES.INVALID_VALUE_OBJECT));
          });

          it('with @id and index map with a raw value with @type: @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@type": "@id", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": "ex:id1"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/id1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('Value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/id1')),
            ]);
          });

          it('with @id and index map with a raw value with @type: @id with invalid IRI', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@type": "@id", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": "id1"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and index map with a raw value with @type: @bla should error', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@type": "@bla", "@container": "@index", "@index": "ex:prop" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Value1": "ex:id1"
  }
}`);
            return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(
              new ErrorCoded('A context @type must be an absolute IRI, found: \'p\': \'@bla\'',
                ERROR_CODES.INVALID_TYPE_MAPPING));
          });

        });

        describe('for identifiers', () => {

          it('with @id and identifier map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "body": "body 1",
      "words": "1539"
    },
    "1/de": {
      "body": "body 2",
      "words": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/de')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
            ]);
          });

          it('with @id and identifier map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@id", "@set" ] },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "body": "body 1",
      "words": "1539"
    },
    "1/de": {
      "body": "body 2",
      "words": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/de')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
            ]);
          });

          it('with @id and identifier map with an array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": [
      { "body": "body 1" },
      { "words": "1539" }
    ],
    "2/de": [
      { "body": "body 2" },
      { "words": "1204" }
    ]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/2/de')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/posts/2/de'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.namedNode('http://example.com/posts/2/de'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
            ]);
          });

          it('with @id and identifier map with an empty array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": []
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and identifier map with a nested array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": [
      [{ "body": "body 1" }],
      [{ "words": "1539" }]
    ],
    "2/de": [
      [{ "body": "body 2" }],
      [{ "words": "1204" }]
    ]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/2/de')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/posts/2/de'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.namedNode('http://example.com/posts/2/de'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
            ]);
          });

          it('with invalid @id and identifier map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ignored/1/en": {
      "http://example.com/posts/body": "body 1",
      "http://example.com/posts/words": "1539"
    },
    "ignored/1/de": {
      "http://example.com/posts/body": "body 2",
      "http://example.com/posts/words": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and identifier map with @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "body": "body 1",
      "words": "1539"
    },
    "1/de": {
      "body": "body 2",
      "words": "1204"
    },
    "@none": {
      "body": "body 3",
      "words": "111"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/en')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/posts/1/de')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://example.com/posts/1/en'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.namedNode('http://example.com/posts/1/de'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 3')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/words'),
                DF.literal('111')),
            ]);
          });

          it('with @id and identifier map with multiple @none\'s', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@none": {
      "body": "body 1",
      "words": "1539"
    },
    "@none": {
      "body": "body 2",
      "words": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b2')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/words'),
                DF.literal('1539')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/words'),
                DF.literal('1204')),
            ]);
          });

          it('with @id and identifier map with values already having URI @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "@id": "http://ex.org/myid1.1",
      "body": "body 1"
    },
    "1/de": {
      "@id": "http://ex.org/myid1.2",
      "body": "body 2"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/myid1.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/myid1.2')),
              DF.quad(DF.namedNode('http://ex.org/myid1.1'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.namedNode('http://ex.org/myid1.2'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
            ]);
          });

          it('with @id and identifier map with values already having blank node @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "@id": "_:foo",
      "body": "body 1"
    },
    "1/de": {
      "@id": "_:bar",
      "body": "body 2"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('foo')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('bar')),
              DF.quad(DF.blankNode('foo'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 1')),
              DF.quad(DF.blankNode('bar'), DF.namedNode('http://ex.org/body'),
                DF.literal('body 2')),
            ]);
          });

          it('with @id and identifier map with values already having @id but no other properties', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/posts/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@id" },
    "body": "ex:body",
    "words": "ex:words"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "1/en": {
      "@id": "http://ex.org/myid1.1"
    },
    "1/de": {
      "@id": "http://ex.org/myid1.2"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/myid1.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/myid1.2')),
            ]);
          });

        });

        describe('for types', () => {

          it('with @id and type map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": {
      "@id": "value1",
      "value": "1539"
    },
    "ex:Type2": {
      "@id": "value2",
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and type map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@type", "@set" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": {
      "@id": "value1",
      "value": "1539"
    },
    "ex:Type2": {
      "@id": "value2",
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": "value1",
    "ex:Type2": "value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to invalid @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": "value1",
    "ex:Type2": "value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and type map with string values expand to @id without @type', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": "value1",
    "Type2": "value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to @id with @type: @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type", "@type": "@id" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": "value1",
    "Type2": "value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to @id with @type: @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type", "@type": "@vocab" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": "value1",
    "Type2": "value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/ns/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/ns/value2')),
              DF.quad(DF.namedNode('http://example.com/ns/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.namedNode('http://example.com/ns/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to @id with @type: @vocab over blank nodes', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type", "@type": "@vocab" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": "_:value1",
    "Type2": "_:value2"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('value2')),
              DF.quad(DF.blankNode('value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.blankNode('value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type2')),
            ]);
          });

          it('with @id and type map with string values expand to @id with array values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": [ "value1", "value2" ]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
            ]);
          });

          it('with @id and type map with string values expand to @id with @type: @vocab and array values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "@vocab": "http://example.com/ns/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type", "@type": "@vocab" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": [ "value1", "value2" ]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/ns/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/ns/value2')),
              DF.quad(DF.namedNode('http://example.com/ns/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
              DF.quad(DF.namedNode('http://example.com/ns/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example.com/ns/Type1')),
            ]);
          });

          it('with @id and type map without inner @id\'s', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": {
      "value": "1539"
    },
    "ex:Type2": {
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b2')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.blankNode('b1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.blankNode('b2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and type map with an array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": [
      {
        "@id": "value1",
        "value": "1539"
      },
      {
        "@id": "value1.1",
        "value": "1539.1"
      }
    ],
    "ex:Type2": {
      "@id": "value2",
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539.1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and type map with an array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": []
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([]);
          });

          it('with @id and type map with a nested array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": [
      [{
        "@id": "value1",
        "value": "1539"
      }],
      [{
        "@id": "value1.1",
        "value": "1539.1"
      }]
    ],
    "ex:Type2": {
      "@id": "value2",
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539.1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
            ]);
          });

          it('with @id and invalid type map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "Type1": {
      "@id": "ex:entries/value1",
      "value": "1539"
    },
    "Type2": {
      "@id": "ex:entries/value2",
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/entries/value2')),
              DF.quad(DF.namedNode('http://ex.org/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://ex.org/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
            ]);
          });

          it('with @id and type map with @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "ex:Type1": {
      "@id": "value1",
      "value": "1539"
    },
    "ex:Type2": {
      "@id": "value2",
      "value": "1204"
    },
    "@none": {
      "@id": "value3",
      "value": "111"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://example.com/entries/value3')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Type2')),
              DF.quad(DF.namedNode('http://example.com/entries/value3'), DF.namedNode('http://ex.org/value'),
                DF.literal('111')),
            ]);
          });

          it('with @id and type map with multiple @none\'s', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@type" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@none": {
      "value": "1539"
    },
    "@none": {
      "value": "1204"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b2')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539')),
              DF.quad(DF.blankNode('b2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1204')),
            ]);
          });

        });

        describe('for graphs', () => {

          it('with @id and graph map', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@id": "value1",
    "value": "1539"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@set" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@id": "value1",
    "value": "1539"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with an array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [
    {
      "@id": "value1",
      "value": "123"
    },
    {
      "@id": "value2",
      "value": "234"
    }
  ]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('123'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g2')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('234'), DF.blankNode('g2')),
            ]);
          });

          it('with @id and graph map with an nested array value', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [[
    {
      "@id": "value1",
      "value": "123"
    },
    {
      "@id": "value2",
      "value": "234"
    }
  ]]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('123'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g2')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value'),
                DF.literal('234'), DF.blankNode('g2')),
            ]);
          });

          it('with @id and graph map with multiple values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value1": "ex:value1",
    "value2": "ex:value2",
    "value3": "ex:value3"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@id": "value1",
    "value1": "1",
    "value2": "2",
    "value3": "3"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value1'),
                DF.literal('1'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value2'),
                DF.literal('2'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value3'),
                DF.literal('3'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with multiple values with an outer array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value1": "ex:value1",
    "value2": "ex:value2",
    "value3": "ex:value3"
  },
  "@id": "http://ex.org/myid",
  "p": [{
    "@id": "value1",
    "value1": "1",
    "value2": "2",
    "value3": "3"
  },{
    "@id": "value2",
    "value1": "4",
    "value2": "5",
    "value3": "6"
  }]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g2')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value1'),
                DF.literal('1'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value2'),
                DF.literal('2'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value3'),
                DF.literal('3'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value1'),
                DF.literal('4'), DF.blankNode('g2')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value2'),
                DF.literal('5'), DF.blankNode('g2')),
              DF.quad(DF.namedNode('http://example.com/entries/value2'), DF.namedNode('http://ex.org/value3'),
                DF.literal('6'), DF.blankNode('g2')),
            ]);
          });

          it('with @id and graph map and blank node inner id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "value": "1539"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with an o-o-o inner id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "value": "1539",
    "@id": "value1"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with multiple values and an o-o-o inner id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value1": "ex:value1",
    "value2": "ex:value2",
    "value3": "ex:value3"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "value1": "1",
    "value2": "2",
    "@id": "value1",
    "value3": "3"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value1'),
                DF.literal('1'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value2'),
                DF.literal('2'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value3'),
                DF.literal('3'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map and an o-o-o outer id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "p": {
    "@id": "value1",
    "value": "1539"
  },
  "@id": "http://ex.org/myid"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map and an o-o-o outer and inner id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "p": {
    "value": "1539",
    "@id": "value1"
  },
  "@id": "http://ex.org/myid"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map and @graph key', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": "@graph" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@graph": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g2')),
            ]);
          });

          it('with @id and graph map with @index', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple lead node values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value1": "ex:value1",
    "value2": "ex:value2"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@id": "value1",
      "value1": "1",
      "value2": "2"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value1'),
                DF.literal('1'), DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value2'),
                DF.literal('2'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index and @graph key', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@graph": {
        "@id": "value1",
        "value": "1539"
      }
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@id": "value0",
      "value": "0"
    },
    "index1": {
      "@id": "value1",
      "value": "1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values without id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "p": {
    "index0": {
      "value": "0"
    },
    "index1": {
      "value": "1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.blankNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.blankNode('value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.blankNode('value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values without id with @set', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index", "@set" ] },
    "value": "ex:value"
  },
  "p": {
    "index0": {
      "value": "0"
    },
    "index1": {
      "value": "1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.blankNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.blankNode('value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.blankNode('value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with inner arrays', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": [{
      "@id": "value0",
      "value": "0"
    }],
    "index1": [{
      "@id": "value1",
      "value": "1"
    }]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with nested inner arrays', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": [[{
      "@id": "value0",
      "value": "0"
    }]],
    "index1": [[{
      "@id": "value1",
      "value": "1"
    }]]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple inner array values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": [{
      "@id": "value0",
      "value": "0"
    },
    {
      "@id": "value1",
      "value": "1"
    }]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with complex inner arrays', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": [{
      "@id": "value0",
      "value": "0"
    }],
    "index1": [{
      "@id": "value1.1",
      "value": "1.1"
    },{
      "@id": "value1.2",
      "value": "1.2"
    }]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1.1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1.2')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1.1'), DF.blankNode('g1.1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1.2'), DF.blankNode('g1.2')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with an outer array (1) should be ignored', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [{
    "index0": {
      "@id": "value0",
      "value": "0"
    },
    "index1": {
      "@id": "value1",
      "value": "1"
    }
  }]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with an outer array (2) should be ignored', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [{
    "index0": {
      "@id": "value0",
      "value": "0"
    }
  },
  {
    "index1": {
      "@id": "value1",
      "value": "1"
    }
  }]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with a nested outer array should be ignored', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [[{
    "index0": {
      "@id": "value0",
      "value": "0"
    },
    "index1": {
      "@id": "value1",
      "value": "1"
    }
  }]]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
            ]);
          });

          it('with @id and graph map with @index with multiple values with nested inner and outer arrays', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": [[{
    "index0": [[{
      "@id": "value0",
      "value": "0"
    }]],
    "index1": [[{
      "@id": "value1",
      "value": "1"
    }]]
  }]]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g0')),
            ]);
          });

          it('with @id and graph map with @index and @index prop', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ], "@index": "ex:prop" },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
              DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/prop'),
                DF.literal('index0')),
            ]);
          });

          it('with @id and graph map with @index and @index prop as IRI', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@index" ], "@index": "ex:prop" },
    "value": "ex:value",
    "ex:prop": { "@type": "@id" }
  },
  "@id": "http://ex.org/myid",
  "p": {
    "index0": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('g1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('g1')),
              DF.quad(DF.blankNode('g1'), DF.namedNode('http://ex.org/prop'),
                DF.namedNode('http://example.com/entries/index0')),
            ]);
          });

          it('with @id and graph map with @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@id" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "http://ex.org/index0": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/index0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.namedNode('http://ex.org/index0')),
            ]);
          });

          it('with @id and graph map with @id with multiple values', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@id" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "http://ex.org/index0": {
      "@id": "value0",
      "value": "0"
    },
    "http://ex.org/index1": {
      "@id": "value1",
      "value": "1"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/index0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/index1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.namedNode('http://ex.org/index0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1'), DF.namedNode('http://ex.org/index1')),
            ]);
          });

          it('with @id and graph map with @id with multiple values with complex inner arrays', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@id" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "http://ex.org/index0": [{
      "@id": "value0",
      "value": "0"
    }],
    "http://ex.org/index1": [{
      "@id": "value1.1",
      "value": "1.1"
    },{
      "@id": "value1.2",
      "value": "1.2"
    }]
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/index0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.namedNode('http://ex.org/index1')),
              DF.quad(DF.namedNode('http://example.com/entries/value0'), DF.namedNode('http://ex.org/value'),
                DF.literal('0'), DF.namedNode('http://ex.org/index0')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1.1'), DF.namedNode('http://ex.org/index1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1.2'), DF.namedNode('http://ex.org/value'),
                DF.literal('1.2'), DF.namedNode('http://ex.org/index1')),
            ]);
          });

          it('with @id and graph map with @id and @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@id" ] },
    "value": "ex:value"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "@none": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('b1')),
            ]);
          });

          it('with @id and graph map with @id and aliased @none', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example.org/",
    "@base": "http://example.com/entries/",
    "ex": "http://ex.org/",
    "p": { "@id": "http://ex.org/pred1", "@container": [ "@graph", "@id" ] },
    "value": "ex:value",
    "none": "@none"
  },
  "@id": "http://ex.org/myid",
  "p": {
    "none": {
      "@id": "value1",
      "value": "1539"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/pred1'),
                DF.blankNode('b1')),
              DF.quad(DF.namedNode('http://example.com/entries/value1'), DF.namedNode('http://ex.org/value'),
                DF.literal('1539'), DF.blankNode('b1')),
            ]);
          });
        });

        describe('for combinations', () => {
          it('an index container with a type-scoped context overriding a prop as a type container', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example/",
    "prop": {"@container": "@index"},
    "Outer": {
      "@context": {
        "prop": {
          "@id": "http://example/outer-prop",
          "@container": "@type"
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "ex:outer",
  "prop": {
    "Inner": {
      "prop": {
        "bar": "baz"
      }
    }
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('http://example/outer-prop'),
                DF.blankNode('b0')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Outer')),
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example/prop'),
                DF.literal('baz')),
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Inner')),
            ]);
          });
        });

      });

      describe('@nest properties', () => {

        it('(unaliased) with @id and one valid sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "@nest": {
    "p1": "V1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('with @id and one valid sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "p1": "V1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('with o-o-o @id and one valid sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "nested": {
    "p1": "V1"
  },
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('with @id and one valid sub-property within an array with one entry', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "nested": [{
    "p1": "V1"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('with @id and one valid sub-property within an array with two entries', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1",
    "p2": "ex:p2"
  },
  "@id": "http://ex.org/myid",
  "nested": [{
    "p1": "V1"
  },{
    "p2": "V2"
  }]
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p2'),
              DF.literal('V2')),
          ]);
        });

        it('with @id and two valid sub-properties', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1",
    "p2": "ex:p2"
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "p1": "V1",
    "p2": "V2"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p2'),
              DF.literal('V2')),
          ]);
        });

        it('with @id and one valid sub-property with a sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1",
    "p2": "ex:p2"
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "p1": {
      "@id": "http://ex.org/mysubid",
      "p2": "V1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.namedNode('http://ex.org/mysubid')),
            DF.quad(DF.namedNode('http://ex.org/mysubid'), DF.namedNode('http://ex.org/p2'),
              DF.literal('V1')),
          ]);
        });

        it('with @id and one valid sub-property with a conflicting inner @id should error', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "@id": "http://ex.org/conflictingid",
    "p1": "V1"
  }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects
            .toThrow(new ErrorCoded('Found duplicate @ids \'http://ex.org/myid\' and \'http://ex.org/conflictingid\'',
              ERROR_CODES.COLLIDING_KEYWORDS));
        });

        it('with inner @id and one valid sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "nested": {
    "@id": "http://ex.org/myid",
    "p1": "V1"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('doubly nested, with @id and one valid sub-property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "nested": "@nest",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "nested": {
      "p1": "V1"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/p1'),
              DF.literal('V1')),
          ]);
        });

        it('should error on a string value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "@nest": "invalid"
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Found invalid @nest entry for \'@nest\': \'invalid\'',
            ERROR_CODES.INVALID_NEST_VALUE));
        });

        it('should error on a number value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "@nest": 10
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Found invalid @nest entry for \'@nest\': \'10\'',
            ERROR_CODES.INVALID_NEST_VALUE));
        });

        it('should error on a boolean value', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "@nest": true
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Found invalid @nest entry for \'@nest\': \'true\'',
            ERROR_CODES.INVALID_NEST_VALUE));
        });

        it('should error on a value node', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1"
  },
  "@id": "http://ex.org/myid",
  "@nest": { "@value": true }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Found an invalid @value node for \'@nest\'',
            ERROR_CODES.INVALID_NEST_VALUE));
        });

        it('should error on an aliased value node', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "ex": "http://ex.org/",
    "p1": "ex:p1",
    "v": "@value"
  },
  "@id": "http://ex.org/myid",
  "@nest": { "v": true }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Found an invalid @value node for \'@nest\'',
            ERROR_CODES.INVALID_NEST_VALUE));
        });

      });

      describe('embedded contexts', () => {

        it('should override a single property', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/"
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@context": {
      "@vocab": "http://vocab.1.org/"
    },
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
              DF.namedNode('http://ex.org/myinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
              DF.literal('baz')),
          ]);
        });

        it('should override a single property and propagate to children', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/"
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@context": {
      "@vocab": "http://vocab.1.org/"
    },
    "@id": "http://ex.org/myinnerid",
    "bar": {
      "@id": "http://ex.org/myinnerinnerid",
      "baz": "buzz"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
              DF.namedNode('http://ex.org/myinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
              DF.namedNode('http://ex.org/myinnerinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://vocab.1.org/baz'),
              DF.literal('buzz')),
          ]);
        });

        it('should override a single property and not propagate to children with @propagate: false', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/"
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@context": {
      "@propagate": false,
      "@vocab": "http://vocab.1.org/"
    },
    "@id": "http://ex.org/myinnerid",
    "bar": {
      "@id": "http://ex.org/myinnerinnerid",
      "baz": "buzz"
    }
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
              DF.namedNode('http://ex.org/myinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
              DF.namedNode('http://ex.org/myinnerinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://vocab.org/baz'),
              DF.literal('buzz')),
          ]);
        });

        it('should use proper @vocab scope for defined terms', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "bar": {}
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@context": {
      "@vocab": "http://vocab.1.org/"
    },
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
              DF.namedNode('http://ex.org/myinnerid')),
            DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.org/bar'),
              DF.literal('baz')),
          ]);
        });

      });

      describe('scoped contexts', () => {

        describe('property scoped contexts', () => {

          it('should add a single property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "bar": "http://ex.org/bar"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should add a single property within an array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "bar": "http://ex.org/bar"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": [{
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }]
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should override @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "@vocab": "http://ex.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should propagate by default', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "@vocab": "http://ex.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar1": {
      "@id": "http://ex.org/myinnerinnerid",
      "bar2": "baz"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar1'),
                DF.namedNode('http://ex.org/myinnerinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://ex.org/bar2'),
                DF.literal('baz')),
            ]);
          });

          it('should propagate by default with nullification', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": null
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar1": {
      "@id": "http://ex.org/myinnerinnerid",
      "bar2": "baz"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
            ]);
          });

          it('should propagate for @propagate: true', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "@propagate": true,
        "@vocab": "http://ex.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar1": {
      "@id": "http://ex.org/myinnerinnerid",
      "bar2": "baz"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar1'),
                DF.namedNode('http://ex.org/myinnerinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://ex.org/bar2'),
                DF.literal('baz')),
            ]);
          });

          it('should not propagate for @propagate: false', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "@propagate": false,
        "@vocab": "http://ex.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar1": {
      "@id": "http://ex.org/myinnerinnerid",
      "bar2": "baz"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar1'),
                DF.namedNode('http://ex.org/myinnerinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://vocab.org/bar2'),
                DF.literal('baz')),
            ]);
          });

          it('should not influence neighbour properties', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "bar": "http://ex.org/bar"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid1",
    "bar": "baz"
  },
  "foo2": {
    "@id": "http://ex.org/myinnerid2",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo2'),
                DF.namedNode('http://ex.org/myinnerid2')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid1'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid2'), DF.namedNode('http://vocab.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should add a single property in a 2-level deep nested scoped context', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "foo": {
      "@context": {
        "@vocab": "http://vocab.foo.org/",
        "bar1": {
          "@context": {
            "@vocab": "http://vocab.bar.org/"
          }
        }
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar1": {
      "@id": "http://ex.org/myinnerinnerid",
      "bar2": "baz"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.foo.org/bar1'),
                DF.namedNode('http://ex.org/myinnerinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerinnerid'), DF.namedNode('http://vocab.bar.org/bar2'),
                DF.literal('baz')),
            ]);
          });

          it('should add allow a protected property to be overridden', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "@protected": true,
    "bar": "http://ex.overrideme.org/bar",
    "foo": {
      "@context": {
        "bar": "http://ex.org/bar"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "foo": {
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should handle an @id node within a property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://unused/",
    "bar": {
      "@id": "ex:bar",
      "@context": {
        "@base": "http://example/"
      }
    }
  },
  "@id": "ex:outer",
  "ex:nested": {
    "@id": "ex:inner",
    "bar": {"@id": "a"}
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:bar'), DF.namedNode('http://example/a')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:nested'), DF.namedNode('ex:inner')),
            ]);
          });

          it('should handle an @id node within a property in an array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://unused/",
    "bar": {
      "@id": "ex:bar",
      "@context": {
        "@base": "http://example/"
      }
    }
  },
  "@id": "ex:outer",
  "ex:nested": {
    "@id": "ex:inner",
    "bar": [{"@id": "a"}]
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:bar'), DF.namedNode('http://example/a')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:nested'), DF.namedNode('ex:inner')),
            ]);
          });

          it('should handle an @id node with other properties within a property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://unused/",
    "bar": {
      "@id": "ex:bar",
      "@context": {
        "@base": "http://example/"
      }
    }
  },
  "@id": "ex:outer",
  "ex:nested": {
    "@id": "ex:inner",
    "bar": {"@id": "a", "p": true}
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:bar'), DF.namedNode('http://example/a')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:nested'), DF.namedNode('ex:inner')),
            ]);
          });

          it('should handle an @value node within a property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "nested": "ex:nested",
    "foo": {
      "@id": "ex:foo",
      "@context": {
        "value": "@value"
      }
    }
  },
  "@id": "ex:outer",
  "nested": {
    "@id": "ex:inner",
    "foo": [{"value": "1"}]
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:foo'), DF.literal('1')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:nested'), DF.namedNode('ex:inner')),
            ]);
          });

        });

        describe('type scoped contexts', () => {

          it('should handle a single type and single property', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://ex.org/Foo",
      "@context": {
        "bar": "http://ex.org/bar"
      }
    }
  },
  "@type": "Foo",
  "@id": "http://ex.org/myid",
  "bar": "baz"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should handle a two types and single property with property overriding', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo1": {
      "@id": "http://ex.org/Foo1",
      "@context": {
        "bar": "http://ex.1.org/bar"
      }
    },
    "Foo2": {
      "@id": "http://ex.org/Foo2",
      "@context": {
        "bar": "http://ex.2.org/bar"
      }
    }
  },
  "@type": [ "Foo1", "Foo2" ],
  "@id": "http://ex.org/myid",
  "bar": "baz"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.2.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should handle a two types and single property with property overriding in lexical order', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo1": {
      "@id": "http://ex.org/Foo1",
      "@context": {
        "bar": "http://ex.1.org/bar"
      }
    },
    "Foo2": {
      "@id": "http://ex.org/Foo2",
      "@context": {
        "bar": "http://ex.2.org/bar"
      }
    }
  },
  "@type": [ "Foo2", "Foo1" ],
  "@id": "http://ex.org/myid",
  "bar": "baz"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.2.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('should handle a two types and two properties', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo1": {
      "@id": "http://ex.org/Foo1",
      "@context": {
        "bar1": "http://ex.1.org/bar"
      }
    },
    "Foo2": {
      "@id": "http://ex.org/Foo2",
      "@context": {
        "bar2": "http://ex.2.org/bar"
      }
    }
  },
  "@type": [ "Foo1", "Foo2" ],
  "@id": "http://ex.org/myid",
  "bar1": "baz1",
  "bar2": "baz2"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo2')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.1.org/bar'),
                DF.literal('baz1')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://ex.2.org/bar'),
                DF.literal('baz2')),
            ]);
          });

          it('should not propagate by default', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://ex.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/",
      }
    }
  },
  "@type": "Foo",
  "@id": "http://ex.org/myid",
  "bar": {
    "@id": "http://ex.org/myinnerid",
    "baz": "buzz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.1.org/bar'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.org/baz'),
                DF.literal('buzz')),
            ]);
          });

          it('should propagate on @propagate: true', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://ex.org/Foo",
      "@context": {
        "@propagate": true,
        "@vocab": "http://vocab.1.org/",
      }
    }
  },
  "@type": "Foo",
  "@id": "http://ex.org/myid",
  "bar": {
    "@id": "http://ex.org/myinnerid",
    "baz": "buzz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.1.org/bar'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/baz'),
                DF.literal('buzz')),
            ]);
          });

          it('should handle a value node', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "type": "@type",
    "Type": {
      "@context": {
        "value": "@value"
      }
    }
  },
  "@type": "Type",
  "@id": "http://ex.org/myid",
  "bar": {
    "value": "value",
    "type": "value-type"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://vocab.org/Type')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/bar'),
                DF.literal('value', DF.namedNode('http://vocab.org/value-type'))),
            ]);
          });

          it('should handle a property value datatype', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "type": "@type",
    "Type": {
      "@context": {
        "bar": { "@type": "value-type" }
      }
    }
  },
  "@type": "Type",
  "@id": "http://ex.org/myid",
  "bar": "value"
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://vocab.org/Type')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/bar'),
                DF.literal('value', DF.namedNode('http://vocab.org/value-type'))),
            ]);
          });

          it('should handle @base of @id', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/base-base",
    "@vocab": "http://example/",
    "foo": "http://example/foo",
    "Type": {
      "@context": {
        "@base": "http://example/typed-base"
      }
    }
  },
  "@id": "#base-id",
  "p": {
    "@type": "Type",
    "@id": "#typed-id"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Type')),
              DF.quad(DF.namedNode('http://example/base-base#base-id'), DF.namedNode('http://example/p'),
                DF.namedNode('http://example/typed-base#typed-id')),
            ]);
          });

          it('should handle @base of @id with a nested node with other props', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/base-base",
    "@vocab": "http://example/",
    "foo": "http://example/foo",
    "Type": {
      "@context": {
        "@base": "http://example/typed-base"
      }
    }
  },
  "@id": "#base-id",
  "p": {
    "@type": "Type",
    "@id": "#typed-id",
    "subjectReference": {
      "@id": "#subject-reference-id",
      "p": "0"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example/base-base#subject-reference-id'), DF.namedNode('http://example/p'),
                DF.literal('0')),
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://example/subjectReference'),
                DF.namedNode('http://example/base-base#subject-reference-id')),
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Type')),
              DF.quad(DF.namedNode('http://example/base-base#base-id'), DF.namedNode('http://example/p'),
                DF.namedNode('http://example/typed-base#typed-id')),
            ]);
          });

          it('should handle @base of @id with a nested node without other props', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@base": "http://example/base-base",
    "@vocab": "http://example/",
    "foo": "http://example/foo",
    "Type": {
      "@context": {
        "@base": "http://example/typed-base"
      }
    }
  },
  "@id": "#base-id",
  "p": {
    "@type": "Type",
    "@id": "#typed-id",
    "subjectReference": {
      "@id": "#subject-reference-id"
    }
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://example/subjectReference'),
                DF.namedNode('http://example/typed-base#subject-reference-id')),
              DF.quad(DF.namedNode('http://example/typed-base#typed-id'),
                DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Type')),
              DF.quad(DF.namedNode('http://example/base-base#base-id'), DF.namedNode('http://example/p'),
                DF.namedNode('http://example/typed-base#typed-id')),
            ]);
          });

          it('should handle a graph container', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "foo": "ex:foo",
    "Outer": {
      "@id": "ex:Outer",
      "@context": {
        "nested": {
          "@id": "ex:nested",
          "@container": "@graph"
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "ex:outer",
  "nested": {
    "@id": "ex:inner",
    "foo": "bar"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:foo'), DF.literal('bar'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:nested'), DF.blankNode('g0')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Outer')),
            ]);
          });

          it('should assign appropriate context to @value nodes', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "ex:",
    "Type": {
      "@context": {
        "value": "@value"
      }
    }
  },
  "@id": "ex:outer",
  "prop": {
    "@type": "Type",
    "@id": "ex:inner",
    "prop": {
      "value": "v2"
    }
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:prop'), DF.literal('v2')),
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Type')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:prop'), DF.namedNode('ex:inner')),
            ]);
          });

          it('should assign appropriate context to @value nodes in an array', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "ex:",
    "Type": {
      "@context": {
        "value": "@value"
      }
    }
  },
  "@id": "ex:outer",
  "prop": {
    "@type": "Type",
    "@id": "ex:inner",
    "prop": [
      {
        "value": "v2"
      }
    ]
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('ex:prop'), DF.literal('v2')),
              DF.quad(DF.namedNode('ex:inner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Type')),
              DF.quad(DF.namedNode('ex:outer'), DF.namedNode('ex:prop'), DF.namedNode('ex:inner')),
            ]);
          });

        });

        describe('different scoping combinations', () => {

          it('type-scoping has priority over embedded context', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://ex.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/",
      }
    }
  },
  "@id": "http://ex.org/myid",
  "prop": {
    "@context": {
      "@vocab": "http://vocab.ignored.org/"
    },
    "@type": "Foo",
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/prop'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('type-scoping has priority over property-scoping', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Foo": {
      "@id": "http://ex.org/Foo",
      "@context": {
        "@vocab": "http://vocab.1.org/",
      }
    },
    "prop": {
      "@context": {
        "@vocab": "http://vocab.ignored.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "prop": {
    "@type": "Foo",
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/prop'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://ex.org/Foo')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('embedded context has priority over property-scoping', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "prop": {
      "@context": {
        "@vocab": "http://vocab.ignored.org/"
      }
    }
  },
  "@id": "http://ex.org/myid",
  "prop": {
    "@context": {
      "@vocab": "http://vocab.1.org/"
    },
    "@id": "http://ex.org/myinnerid",
    "bar": "baz"
  }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/prop'),
                DF.namedNode('http://ex.org/myinnerid')),
              DF.quad(DF.namedNode('http://ex.org/myinnerid'), DF.namedNode('http://vocab.1.org/bar'),
                DF.literal('baz')),
            ]);
          });

          it('type-scoping and property-scoping', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://example/",
    "Foo": {
      "@context": {
        "bar": {
          "@context": {
            "baz": {"@type": "@vocab"}
          }
        }
      }
    }
  },
  "@type": "Foo",
  "@id": "http://ex.org/myid",
  "bar": { "baz": "buzz" }
}`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://example/bar'),
                DF.blankNode('b0')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://example/Foo')),
              DF.quad(DF.blankNode('b0'), DF.namedNode('http://example/baz'),
                DF.namedNode('http://example/buzz')),
            ]);
          });

          it('type-scoping and property-scoping with @type: @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Inner": {
      "@context": {
        "foo": {
          "@type": "@vocab",
          "@context": {
            "Foo": "ex:Foo"
          }
        }
      }
    }
  },
  "@id": "http://ex.org/myid",
  "nested": {
    "@type": "Inner",
    "@id": "http://ex.org/myidinner",
    "foo": "Foo"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('ex:Foo')),
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://vocab.org/Inner')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://vocab.org/nested'),
                DF.namedNode('http://ex.org/myidinner')),
            ]);
          });

          it('double type-scoping and property-scoping with @type: @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Outer": {
      "@id": "ex:Outer",
      "@context": {
        "nested": "ex:nested"
      }
    },
    "Inner": {
      "@context": {
        "foo": {
          "@type": "@vocab",
          "@context": {
            "Foo": "ex:Foo"
          }
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "http://ex.org/myid",
  "nested": {
    "@type": "Inner",
    "@id": "http://ex.org/myidinner",
    "foo": "Foo"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://vocab.org/foo'),
                DF.namedNode('ex:Foo')),
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('http://vocab.org/Inner')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Outer')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('ex:nested'),
                DF.namedNode('http://ex.org/myidinner')),
            ]);
          });

          it('double type-scoping and property-scoping with @type: @vocab (2)', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Outer": {
      "@id": "ex:Outer",
      "@context": {
        "nested": "ex:nested"
      }
    },
    "Inner": {
      "@id": "ex:Inner",
      "@context": {
        "foo": {
          "@id": "ex:foo",
          "@type": "@vocab",
          "@context": {
            "Foo": "ex:Foo"
          }
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "http://ex.org/myid",
  "nested": {
    "@type": "Inner",
    "@id": "http://ex.org/myidinner",
    "foo": "Foo"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('ex:foo'),
                DF.namedNode('ex:Foo')),
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Inner')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Outer')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('ex:nested'),
                DF.namedNode('http://ex.org/myidinner')),
            ]);
          });

          it('double type-scoping and property-scoping with @type: @vocab with blank nodes', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "Outer": {
      "@id": "ex:Outer",
      "@context": {
        "nested": "ex:nested"
      }
    },
    "Inner": {
      "@id": "ex:Inner",
      "@context": {
        "foo": {
          "@id": "ex:foo",
          "@type": "@vocab",
          "@context": {
            "Foo": "ex:Foo"
          }
        }
      }
    }
  },
  "@type": "Outer",
  "nested": {
    "@type": "Inner",
    "foo": "Foo"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.blankNode('myidinner'), DF.namedNode('ex:foo'),
                DF.namedNode('ex:Foo')),
              DF.quad(DF.blankNode('myidinner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Inner')),
              DF.quad(DF.blankNode('myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Outer')),
              DF.quad(DF.blankNode('myid'), DF.namedNode('ex:nested'),
                DF.blankNode('myidinner')),
            ]);
          });

          it('double type-scoping and property-scoping with @type: @vocab without @vocab', async () => {
            const stream = streamifyString(`
{
  "@context": {
    "Outer": {
      "@id": "ex:Outer",
      "@context": {
        "nested": "ex:nested"
      }
    },
    "Inner": {
      "@id": "ex:Inner",
      "@context": {
        "foo": {
          "@id": "ex:foo",
          "@type": "@vocab",
          "@context": {
            "Foo": "ex:Foo"
          }
        }
      }
    }
  },
  "@type": "Outer",
  "@id": "http://ex.org/myid",
  "nested": {
    "@type": "Inner",
    "@id": "http://ex.org/myidinner",
    "foo": "Foo"
  }
}
`);
            return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('ex:foo'),
                DF.namedNode('ex:Foo')),
              DF.quad(DF.namedNode('http://ex.org/myidinner'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Inner')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                DF.namedNode('ex:Outer')),
              DF.quad(DF.namedNode('http://ex.org/myid'), DF.namedNode('ex:nested'),
                DF.namedNode('http://ex.org/myidinner')),
            ]);
          });

        });

      });

      describe('protected terms', () => {

        it('should error on protected term overrides', async () => {
          const stream = streamifyString(`
{
  "@context": [
    {
      "@vocab": "http://vocab.org/",
      "@protected": true,
      "foo": "http://ex.org/foo"
    },
    {
      "foo": "http://ex.2.org/foo"
    }
  ],
  "foo": "bar"
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Attempted to override the protected keyword foo from "http://ex.org/foo" to "http://ex.2.org/foo"',
            ERROR_CODES.PROTECTED_TERM_REDEFINITION));
        });

        it('should not error on protected term overrides with identical value', async () => {
          const stream = streamifyString(`
{
  "@context": [
    {
      "@vocab": "http://vocab.org/",
      "@protected": true,
      "foo": "http://ex.org/foo"
    },
    {
      "foo": "http://ex.org/foo"
    }
  ],
  "foo": "bar"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''), DF.namedNode('http://ex.org/foo'),
              DF.literal('bar')),
          ]);
        });

        it('should error on protected term overrides in embedded contexts', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "@protected": true,
    "foo": "http://ex.org/foo"
  },
  "scope": {
    "@context": {
      "foo": "http://ex.2.org/foo"
    },
    "foo": "bar"
  }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Attempted to override the protected keyword foo from "http://ex.org/foo" to "http://ex.2.org/foo"',
            ERROR_CODES.PROTECTED_TERM_REDEFINITION));
        });

        it('should not error on protected term overrides before a property scoped-context', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "@protected": true,
    "foo": "http://ex.org/foo",
    "scope": {
      "@context": {
        "@protected": true,
        "foo": "http://ex.2.org/foo"
      }
    }
  },
  "scope": {
    "foo": "bar"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''), DF.namedNode('http://vocab.org/scope'),
              DF.blankNode('b1')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.2.org/foo'),
              DF.literal('bar')),
          ]);
        });

        it('should error on protected term overrides after a property scoped-context', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@vocab": "http://vocab.org/",
    "scope": {
      "@context": {
        "@protected": true,
        "foo": "http://ex.org/foo"
      }
    }
  },
  "scope": {
    "@context": {
      "foo": "http://ex.2.org/foo"
    },
    "foo": "bar"
  }
}`);
          return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
            'Attempted to override the protected keyword foo from "http://ex.org/foo" to "http://ex.2.org/foo"',
            ERROR_CODES.PROTECTED_TERM_REDEFINITION));
        });

        it('should not error on protected term, context null in a property scoped-context, and override', async () => {
          const stream = streamifyString(`
{
  "@context": {
    "@protected": true,
    "foo": "http://ex.org/foo",
    "scope": {
      "@id": "http://ex.org/scope",
      "@context": null
    }
  },
  "scope": {
    "@context": {
      "foo": "http://ex.2.org/foo"
    },
    "foo": "bar"
  }
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.blankNode(''), DF.namedNode('http://ex.org/scope'),
              DF.blankNode('b1')),
            DF.quad(DF.blankNode('b1'), DF.namedNode('http://ex.2.org/foo'),
              DF.literal('bar')),
          ]);
        });

      });

      describe('array values', () => {
        it('with raw values', async () => {
          parser = new JsonLdParser({processingMode: '1.0'});
          const stream = streamifyString(`
{
  "@id": "ex:id",
  "ex:p": [
    "A",
    "B"
  ]
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.literal('A')),
            DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.literal('B')),
          ]);
        });

        it('with @value', async () => {
          parser = new JsonLdParser({processingMode: '1.0'});
          const stream = streamifyString(`
{
  "@id": "ex:id",
  "ex:p": [
    {"@value": "A"},
    {"@value": "B"}
  ]
}
`);
          return expect(await arrayifyStream(stream.pipe(parser))).toBeRdfIsomorphic([
            DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.literal('A')),
            DF.quad(DF.namedNode('ex:id'), DF.namedNode('ex:p'), DF.literal('B')),
          ]);
        });
      });

      // MARKER: Add tests for new features here, wrapped in new describe blocks.
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
      it('a document with an invalid version for the given processing mode', async () => {
        parser = new JsonLdParser({ processingMode: '1.0' });
        const stream = streamifyString(`
{
  "@context": {
    "@version": 1.1
  },
  "@id": "http://ex.org/myid1"
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toBeTruthy();
      });
      it('a document with @version set to 1.0 under default processing mode', async () => {
        const stream = streamifyString(`
{
  "@context": {
    "@version": 1.0
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
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
          'Found the @id \'http://ex.org/myid\' inside an @reverse property',
          ERROR_CODES.INVALID_REVERSE_PROPERTY_MAP));
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
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
          'Invalid value type for \'@reverse\' with value \'true\'',
          ERROR_CODES.INVALID_REVERSE_VALUE));
      });
      it('@index: true', async () => {
        const stream = streamifyString(`
{
  "http://example/prop": {
    "@index": true
  }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects.toThrow(new ErrorCoded(
          'Invalid value type for \'@index\' with value \'true\'',
          ERROR_CODES.INVALID_INDEX_VALUE));
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
          .toThrow(new ErrorCoded('Found illegal list value in subject position at term',
            ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE));
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
          .toThrow(new ErrorCoded('Found illegal list value in subject position at term',
            ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE));
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
          .toThrow(new ErrorCoded('Found illegal list value in subject position at term',
            ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE));
      });

      it('an @id with a non-string value', async () => {
        const stream = streamifyString(`
{
  "@id": true
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found illegal @id \'true\'',
            ERROR_CODES.INVALID_ID_VALUE));
      });

      it('an @type with a non-string value', async () => {
        const stream = streamifyString(`
{
  "@type": true
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found illegal @type \'true\'',
            ERROR_CODES.INVALID_TYPE_VALUE));
      });

      it('an @type with a non-string value in an array', async () => {
        const stream = streamifyString(`
{
  "@type": [ true ]
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found illegal @type \'true\'',
            ERROR_CODES.INVALID_TYPE_VALUE));
      });

      it('@included with a raw value', async () => {
        const stream = streamifyString(`
{
  "@included": "bla"
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found illegal @included \'bla\'',
            ERROR_CODES.INVALID_INCLUDED_VALUE));
      });

      it('@included with an @value', async () => {
        const stream = streamifyString(`
{
  "@included": { "@value": "bla" }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found an illegal @included @value node \'{"@value":"bla"}\'',
            ERROR_CODES.INVALID_INCLUDED_VALUE));
      });

      it('@included with an @list', async () => {
        const stream = streamifyString(`
{
  "@included": { "@list": [ "bla" ] }
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded('Found an illegal @included @list node \'{"@list":["bla"]}\'',
            ERROR_CODES.INVALID_INCLUDED_VALUE));
      });

      it('@list with @id', async () => {
        const stream = streamifyString(`
{
  "http://example/prop": {"@list": ["foo"], "@id": "http://example/bar"}
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded(
            'Found illegal neighbouring entries next to @list for key: \'http://example/prop\'',
            ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
      });

      it('@id with @list', async () => {
        const stream = streamifyString(`
{
  "http://example/prop": {"@id": "http://example/bar", "@list": ["foo"]}
}`);
        return expect(arrayifyStream(stream.pipe(parser))).rejects
          .toThrow(new ErrorCoded(
            'Found illegal neighbouring entries next to @list for key: \'http://example/prop\'',
            ERROR_CODES.INVALID_SET_OR_LIST_OBJECT));
      });
    });
  });

  describe('when instantiated with strictValues true', () => {
    let parser: any;

    beforeEach(() => {
      parser = new JsonLdParser({ strictValues: true });
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

    it('should error on an @type that is not an IRI', async () => {
      const stream = streamifyString(`
{
  "@type": "http://ex.org/ abc"
}`);
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new Error('Invalid term IRI: http://ex.org/ abc'));
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
        .toEqual(new ErrorCoded('Found illegal literal in subject position: Name',
          ERROR_CODES.INVALID_REVERSE_PROPERTY_VALUE));
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
      parser = new JsonLdParser({ strictValues: true, validateValueIndexes: true });
      return expect(arrayifyStream(stream.pipe(parser))).rejects
        .toEqual(new ErrorCoded('Conflicting @index value for http://example/foo', ERROR_CODES.CONFLICTING_INDEXES));
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
        DF.quad(DF.blankNode(), DF.namedNode('http://example.com/foo'), DF.literal('baz')),
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
        DF.quad(DF.namedNode('http://ex.org/obj1'), DF.namedNode('http://ex.org/pred1'), DF.blankNode('')),
      ]);
    });
  });

  describe('with a context event listener', () => {
    let parser: any;
    let contextListener: any;

    beforeEach(() => {
      parser = new JsonLdParser({strictValues: true});
      contextListener = jest.fn();
      parser.on('context', contextListener);
    });

    it('should not call the listener for an empty document', async () => {
      const stream = streamifyString(`
{
}`);
      await arrayifyStream(stream.pipe(parser));
      return expect(contextListener).not.toHaveBeenCalled();
    });

    it('should call the listener with a root context', async () => {
      const stream = streamifyString(`
{
  "@context": {
    "term": {"@id": "http://example/id"}
  }
}`);
      await arrayifyStream(stream.pipe(parser));
      expect(contextListener).toHaveBeenCalledTimes(1);
      return expect(contextListener).toHaveBeenCalledWith({
        term: { "@id": "http://example/id" },
      });
    });

    it('should call the listener with a root and inner contexts', async () => {
      const stream = streamifyString(`
{
  "@context": {
    "term": {"@id": "http://example/id"}
  },
  "term": {
    "@context": {
      "term2": {"@id": "http://example/id2"}
    },
  }
}`);
      await arrayifyStream(stream.pipe(parser));
      expect(contextListener).toHaveBeenCalledTimes(2);
      expect(contextListener).toHaveBeenCalledWith({
        term: { "@id": "http://example/id" },
      });
      expect(contextListener).toHaveBeenCalledWith({
        term2: { "@id": "http://example/id2" },
      });
    });
  });

  // The following tests check the parser via stateful .write() calls.
  describe('for step-by-step streaming', () => {
    describe('without context', () => {
      let parser: any;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory: DF, streamingProfile: true });
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
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://example.org'), DF.namedNode('http://example.com/p'),
            DF.literal('http://example.com/o')));
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
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://example.org'), DF.namedNode('http://example.com/p2'),
            DF.literal('http://example.com/o2')));
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
      let parser: any;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory: DF, streamingProfile: true });
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
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://example.org'), DF.namedNode('http://example.com/p'),
            DF.literal('http://example.com/o')));
          done();
        });
      });

      it('should emit a quad after another object', (done) => {
        parser.write('"http://example.com/o2"', () => {
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://example.org'), DF.namedNode('http://example.com/p'),
            DF.literal('http://example.com/o2')));
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
      let parser: any;

      beforeAll(() => {
        parser = new JsonLdParser({ dataFactory: DF, streamingProfile: true });
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
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://base.org/id'), DF.namedNode('http://example.org/p'),
            DF.literal('ooo')));
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
          expect(parser.read(1)).toEqualRdfQuad(DF.quad(
            DF.namedNode('http://base.org/id'), DF.namedNode('http://example.com/p2'),
            DF.literal('http://example.com/o2')));
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
    let parser: any;

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
        DF.quad(DF.namedNode('http://example.org/node'),
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://example.org/abc'),
          DF.namedNode('http://example.org/myGraph')),
        DF.quad(DF.namedNode('http://example.org/node'),
          DF.namedNode('http://example.org/p'),
          DF.literal('def'),
          DF.namedNode('http://example.org/myGraph')),
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
        DF.quad(DF.namedNode('http://example.org/node'),
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://example.org/abc')),
        DF.quad(DF.namedNode('http://example.org/node'),
          DF.namedNode('http://example.org/p'),
          DF.literal('def')),
      ]);
    });

    it('should forward error events', async () => {
      const stream = new PassThrough();
      stream._read = () => stream.emit('error', new Error('my error'));
      return expect(arrayifyStream(parser.import(stream))).rejects.toThrow(new Error('my error'));
    });
  });
});
