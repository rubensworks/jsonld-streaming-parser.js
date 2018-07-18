import {JsonLdParser} from "../index";
const arrayifyStream = require('arrayify-stream');
const streamifyString = require('streamify-string');
import "jest-rdf";
import * as dataFactory from "rdf-data-model";
import {blankNode, namedNode, triple} from "rdf-data-model";

describe('JsonLdParser', () => {
  describe('when instantiated', () => {
    let parser;

    beforeEach(() => {
      parser = new JsonLdParser({ dataFactory });
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
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
          ]);
        });

        it('with @id', async () => {
          const stream = streamifyString(`
{
  "@id": "http://ex.org/myid",
  "http://ex.org/pred1": "http://ex.org/obj1"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
          ]);
        });

        it('with out-of-order @id', async () => {
          const stream = streamifyString(`
{
  "http://ex.org/pred1": "http://ex.org/obj1",
  "@id": "http://ex.org/myid"
}`);
          return expect(await arrayifyStream(stream.pipe(parser))).toEqualRdfQuadArray([
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
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
            triple(blankNode(), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            triple(blankNode(), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj2')),
            triple(blankNode(), namedNode('http://ex.org/pred3'), namedNode('http://ex.org/obj3')),
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
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred3'), namedNode('http://ex.org/obj3')),
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
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj2')),
            triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred3'), namedNode('http://ex.org/obj3')),
          ]);
        });
      });
    });
  });
});
