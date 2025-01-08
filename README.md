# JSON-LD Streaming Parser

[![Build status](https://github.com/rubensworks/jsonld-streaming-parser.js/workflows/CI/badge.svg)](https://github.com/rubensworks/jsonld-streaming-parser.js/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/rubensworks/jsonld-streaming-parser.js/badge.svg?branch=master)](https://coveralls.io/github/rubensworks/jsonld-streaming-parser.js?branch=master)
[![npm version](https://badge.fury.io/js/jsonld-streaming-parser.svg)](https://www.npmjs.com/package/jsonld-streaming-parser)

A fast and lightweight _streaming_ and 100% _spec-compliant_ [JSON-LD 1.1](https://json-ld.org/) parser,
with [RDFJS](https://github.com/rdfjs/representation-task-force/) representations of RDF terms, quads and triples.

The streaming nature allows triples to be emitted _as soon as possible_, and documents _larger than memory_ to be parsed.

Make sure to enable the `streamingProfile` flag when parsing a JSON-LD document with a streaming profile
to exploit the streaming capabilities of this parser, as this is disabled by default.

## Installation

```bash
$ npm install jsonld-streaming-parser
```

or

```bash
$ yarn add jsonld-streaming-parser
```

This package also works out-of-the-box in browsers via tools such as [webpack](https://webpack.js.org/) and [browserify](http://browserify.org/).

## Require

```javascript
import {JsonLdParser} from "jsonld-streaming-parser";
```

_or_

```javascript
const JsonLdParser = require("jsonld-streaming-parser").JsonLdParser;
```


## Usage

`JsonLdParser` is a Node [Transform stream](https://nodejs.org/api/stream.html#stream_class_stream_transform)
that takes in chunks of JSON-LD data,
and outputs [RDFJS](http://rdf.js.org/)-compliant quads.

It can be used to [`pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options) streams to,
or you can write strings into the parser directly.

### Print all parsed triples from a file to the console

```javascript
const myParser = new JsonLdParser();

fs.createReadStream('myfile.jsonld')
  .pipe(myParser)
  .on('data', console.log)
  .on('error', console.error)
  .on('end', () => console.log('All triples were parsed!'));
```

### Manually write strings to the parser

```javascript
const myParser = new JsonLdParser();

myParser
  .on('data', console.log)
  .on('error', console.error)
  .on('end', () => console.log('All triples were parsed!'));

myParser.write('{');
myParser.write(`"@context": "https://schema.org/",`);
myParser.write(`"@type": "Recipe",`);
myParser.write(`"name": "Grandma's Holiday Apple Pie",`);
myParser.write(`"aggregateRating": {`);
myParser.write(`"@type": "AggregateRating",`);
myParser.write(`"ratingValue": "4"`);
myParser.write(`}}`);
myParser.end();
```

### Convert a JSON-LD string to an RDF/JS dataset

```javascript
import { Store } from 'n3';
import { JsonLdParser } from 'jsonld-streaming-parser';
import { promisifyEventEmitter } from 'event-emitter-promisify';

const store = new Store();
const parser = new JsonLdParser();
parser.write('{"@id": "http://example.org/jesse", "@type": "http://example.org/Thing"}');
parser.end();
await promisifyEventEmitter(store.import(parser));

// Logs all the quads in the store
console.log(...store);
```

### Import streams

This parser implements the RDFJS [Sink interface](https://rdf.js.org/#sink-interface),
which makes it possible to alternatively parse streams using the `import` method.

```javascript
const myParser = new JsonLdParser();

const myTextStream = fs.createReadStream('myfile.jsonld');

myParser.import(myTextStream)
  .on('data', console.log)
  .on('error', console.error)
  .on('end', () => console.log('All triples were parsed!'));
```

### Capture detected contexts

Using a `context` event listener,
you can collect all detected contexts.

```javascript
const myParser = new JsonLdParser();

const myTextStream = fs.createReadStream('myfile.jsonld');

myParser.import(myTextStream)
  .on('context', console.log)
  .on('data', console.error)
  .on('error', console.error)
  .on('end', () => console.log('All triples were parsed!'));
```

### Parse from HTTP responses

Usually, JSON-LD is published via the `application/ld+json` media type.
However, when a JSON-LD context is attached via a link header,
then it can also be published via `application/json` and `+json` extension types.

This library exposes the `JsonLdParser.fromHttpResponse`
function to abstract these cases,
so that you can call it for any HTTP response,
and it will return an appropriate parser
which may or may not contain a custom header-defined context:

```javascript
const myParser = JsonLdParser.fromHttpResponse(
  'http://example.org/my-file.json', // For example: response.url
  'application/json', // For example: headers.get('content-type')
  new Headers({ 'Link': '<my-context.jsonld>; rel=\"http://www.w3.org/ns/json-ld#context\"' }), // Optional: WHATWG Headers 
  {}, // Optional: Any options you want to pass to the parser
);

// Parse anything with myParser like usual
const quads = myParser.import(response.body);
```

The `Headers` object must implement the [Headers interface from the WHATWG Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Headers).

This function will automatically detect the `http://www.w3.org/ns/json-ld#streaming` profile and set the `streamingProfile` flag.

## Configuration

Optionally, the following parameters can be set in the `JsonLdParser` constructor:

* `dataFactory`: A custom [RDFJS DataFactory](http://rdf.js.org/#datafactory-interface) to construct terms and triples. _(Default: `require('@rdfjs/data-model')`)_
* `context`: An optional root context to use while parsing. This can by anything that is accepted by [jsonld-context-parser](https://github.com/rubensworks/jsonld-context-parser.js), such as a URL, object or array. _(Default: `{}`)_
* `baseIRI`: An initial default base IRI. _(Default: `''`)_
* `streamingProfile`: If this parser can assume that parsed documents follow the streaming JSON-LD profile. If true, and a non-streaming document is detected, an error may be thrown. If false, non-streaming documents will be handled by preemptively buffering entries, which will lose many of the streaming benefits of this parser. _(Default: `true`)_
* `documentLoader` A custom loader for fetching remote contexts. This can be set to anything that implements [`IDocumentLoader`](https://github.com/rubensworks/jsonld-context-parser.js/blob/master/lib/IDocumentLoader.ts) _(Default: [`FetchDocumentLoader`](https://github.com/rubensworks/jsonld-context-parser.js/blob/master/lib/FetchDocumentLoader.ts))_
* `ignoreMissingContextLinkHeader`: If the lack of JSON-LD context link headers on raw JSON documents should NOT result in an error. If true, raw JSON documents can be considered first-class JSON-LD documents. _(Default: `false`)_
* `produceGeneralizedRdf`: If blank node predicates should be allowed, they will be ignored otherwise. _(Default: `false`)_
* `processingMode`: The maximum JSON-LD version that should be processable by this parser. _(Default: `1.1`)_
* `strictValues`: By default, JSON-LD requires that all properties (or @id's) that are not URIs, are unknown keywords, and do not occur in the context should be silently dropped. When setting this value to true, an error will be thrown when such properties occur. This also applies to invalid values such as language tags. This is useful for debugging JSON-LD documents. _(Default: `false`)_
* `allowSubjectList`: If RDF lists can appear in the subject position. _(Default: `false`)_
* `validateValueIndexes`: If @index inside array nodes should be validated. I.e., nodes inside the same array with the same @id, should have equal @index values. This is not applicable to this parser as we don't do explicit flattening, but it is required to be spec-compliant. _(Default: `false`)_
* `defaultGraph`: The default graph for constructing [quads](http://rdf.js.org/#dom-datafactory-quad). _(Default: `defaultGraph()`)_
* `rdfDirection`: The [mode](https://w3c.github.io/json-ld-api/#dom-jsonldoptions-rdfdirection) under which `@direction` should be handled. If undefined, `@direction` is considered a regular RDF 1.2 literal with a base direction. Alternatively, it can be set to either `'i18n-datatype'` or `'compound-literal'` _(Default: `undefined`)_
* `normalizeLanguageTags`: Whether or not language tags should be normalized to lowercase. _(Default: `false` for JSON-LD 1.1 (and higher), `true` for JSON-LD 1.0)_
* `streamingProfileAllowOutOfOrderPlainType`: When the streaming profile flag is enabled, `@type` entries MUST come before other properties since they may defined a type-scoped context. However, when this flag is enabled, `@type` entries that do NOT define a type-scoped context may appear anywhere just like a regular property.. _(Default: `false`)_
* `skipContextValidation`: If JSON-LD context validation should be skipped. This is useful when parsing large contexts that are known to be valid. _(Default: `false`)_
* `rdfstar`: If embedded nodes and annotated objects should be parsed according to the [JSON-LD star specification](https://json-ld.github.io/json-ld-star/). _(Default: `true`)_
* `rdfstarReverseInEmbedded`: If embedded nodes in JSON-LD star can have reverse properties. _(Default: `false`)_
* `wellKnownMediaTypes`: an array of media types that can also be parsed as JSON-LD. _(Default: `['application/activity+json']`)_

```javascript
new JsonLdParser({
  dataFactory: require('@rdfjs/data-model'),
  context: 'https://schema.org/',
  baseIRI: 'http://example.org/',
  streamingProfile: true,
  documentLoader: new FetchDocumentLoader(),
  ignoreMissingContextLinkHeader: false,
  produceGeneralizedRdf: false,
  processingMode: '1.0',
  errorOnInvalidIris: false,
  allowSubjectList: false,
  validateValueIndexes: false,
  defaultGraph: namedNode('http://example.org/graph'),
  rdfDirection: undefined,
  normalizeLanguageTags: true,
  rdfstar: true,
});
```

## How it works

This parser does _not_ follow the [recommended procedure for transforming JSON-LD to RDF](https://www.w3.org/TR/json-ld/#serializing-deserializing-rdf),
because this does not allow stream-based handling of JSON.
Instead, this tool introduces an alternative _streaming_ algorithm that achieves spec-compliant JSON-LD parsing.

This parser builds on top of the [jsonparse](https://www.npmjs.com/package/jsonparse) library,
which is a sax-based streaming JSON parser.
With this, several in-memory stacks are maintained.
These stacks are needed to accumulate the required information to emit triples/quads.
These stacks are deleted from the moment they are not needed anymore, to limit memory usage.

The algorithm makes a couple of (soft) assumptions regarding the structure of the JSON-LD document,
which is true for most typical JSON-LD documents.

* If there is a `@context`, it is the first entry of an object.
* If there is an `@id`, it comes right after `@context`, or is the first entry of an object.

If these assumptions are met, (almost) each object entry corresponds to a triple/quad that can be emitted.
For example, the following document allows a triple to be emitted after each object entry (except for first two lines):

```
{
  "@context": "http://schema.org/",
  "@id": "http://example.org/",
  "@type": "Person",               // --> <http://example.org/> a schema:Person.
  "name": "Jane Doe",              // --> <http://example.org/> schema:name "Jane Doe".
  "jobTitle": "Professor",         // --> <http://example.org/> schema:jobTitle "Professor".
  "telephone": "(425) 123-4567",   // --> <http://example.org/> schema:telephone "(425) 123-4567".
  "url": "http://www.janedoe.com"  // --> <http://example.org/> schema:url <http://www.janedoe.com>.
}
```

If not all of these assumptions are met, entries of an object are buffered until enough information becomes available, or if the object is closed.
For example, if no `@id` was present, values will be buffered until an `@id` is read, or if the object closed.

For example:

```
{
  "@context": "http://schema.org/",
  "@type": "Person",
  "name": "Jane Doe",
  "jobTitle": "Professor",
  "@id": "http://example.org/",    // --> <http://example.org/> a schema:Person.
                                   // --> <http://example.org/> schema:name "Jane Doe".
                                   // --> <http://example.org/> schema:jobTitle "Professor".
  "telephone": "(425) 123-4567",   // --> <http://example.org/> schema:telephone "(425) 123-4567".
  "url": "http://www.janedoe.com"  // --> <http://example.org/> schema:url <http://www.janedoe.com>.
}
```

As such, JSON-LD documents that meet these requirements will be parsed very efficiently.
Other documents will still be parsed correctly as well, with a slightly lower efficiency.

## Streaming Profile

This parser adheres to the [JSON-LD 1.1](https://www.w3.org/TR/json-ld/) specification,
the [JSON-LD 1.1 Streaming](https://w3c.github.io/json-ld-streaming/) specification,
and the [JSON-LD star](https://json-ld.github.io/json-ld-star/) specification.

By default, this parser assumes that JSON-LD document
are *not* in the [streaming document form](https://w3c.github.io/json-ld-streaming/#streaming-document-form).
This means that the parser may buffer large parts of the document before quads are produced,
to make sure that the document is interpreted correctly.

Since this buffering neglects the streaming benefits of this parser,
the `streamingProfile` flag *should* be enabled when a [streaming JSON-LD document](https://w3c.github.io/json-ld-streaming/#streaming-document-form)
is being parsed.

If non-streaming JSON-LD documents are encountered when the `streamingProfile` flag is enabled,
an error may be thrown.

## Specification compliance

This parser implements the following [JSON-LD specifications](https://json-ld.org/test-suite/):

* JSON-LD 1.1 - Transform JSON-LD to RDF
* JSON-LD 1.1 - Error handling
* JSON-LD 1.1 - Streaming Transform JSON-LD to RDF
* [JSON-LD star](https://json-ld.github.io/json-ld-star/) - Transform JSON-LD star to RDF
* [JSON-LD star](https://json-ld.github.io/json-ld-star/) - Error handling

## Performance

The following table shows some simple performance comparisons between JSON-LD Streaming Parser and [jsonld.js](https://www.npmjs.com/package/jsonld).

These basic experiments show that even though streaming parsers are typically significantly slower than regular parsers,
_JSON-LD Streaming Parser still achieves similar performance as jsonld.js_ for most typical JSON-LD files.
However, for expanded JSON-LD documents, JSON-LD Streaming Parser is around 3~4 times slower.

| File       | **JSON-LD Streaming Parser** | **jsonld.js** |
| ---------- | ---------------------------- | ------------- |
| [`toRdf-manifest.jsonld`](https://json-ld.org/test-suite/tests/toRdf-manifest.jsonld) (999 triples) | 683.964ms (38MB) | 708.975ms (40MB) |
| [`sparql-init.json`](https://raw.githubusercontent.com/comunica/comunica/master/packages/actor-init-sparql/config/sets/sparql-init.json) (69 triples) | 931.698ms (40MB) | 1088.607ms (47MB) |
| [`person.json`](https://json-ld.org/playground/) (5 triples) | 309.419ms (30MB) | 313.138ms (41MB) |
| `dbpedia-10000-expanded.json` (10,000 triples) | 785.557ms (70MB) | 202.363ms (62MB) |

Tested files:

* `toRdf-manifest.jsonld`: The JSON-LD toRdf test manifest. A typical JSON-LD file with a single context.
* `sparql-init.json`: A [Comunica](https://github.com/comunica/comunica) configuration file. A JSON-LD file with a large number of complex, nested, and remote contexts.
* `person.jsonld`: A very small JSON-LD example from the [JSON-LD playground](https://json-ld.org/playground/).
* `dbpedia-10000-expanded.json` First 10000 triples of DBpedia in expanded JSON-LD.

[Code for measurements](https://github.com/rubensworks/jsonld-streaming-parser.js/tree/master/perf)

## License
This software is written by [Ruben Taelman](http://rubensworks.net/).

This code is released under the [MIT license](http://opensource.org/licenses/MIT).
