# JSON-LD Streaming Parser

[![Build Status](https://travis-ci.org/rubensworks/jsonld-streaming-parser.js.svg?branch=master)](https://travis-ci.org/rubensworks/jsonld-streaming-parser.js)
[![Coverage Status](https://coveralls.io/repos/github/rubensworks/jsonld-streaming-parser.js/badge.svg?branch=master)](https://coveralls.io/github/rubensworks/jsonld-streaming-parser.js?branch=master)
[![npm version](https://badge.fury.io/js/jsonld-streaming-parser.svg)](https://www.npmjs.com/package/jsonld-streaming-parser) [![Greenkeeper badge](https://badges.greenkeeper.io/rubensworks/jsonld-streaming-parser.js.svg)](https://greenkeeper.io/)

A fast and lightweight _streaming_ and 100% _spec-compliant_ [JSON-LD](https://json-ld.org/) parser,
with [RDFJS](https://github.com/rdfjs/representation-task-force/) representations of RDF terms, quads and triples.

The streaming nature allows triples to be emitted _as soon as possible_, and documents _larger than memory_ to be parsed.

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

## Configuration

Optionally, the following parameters can be set in the `JsonLdParser` constructor:

* `dataFactory`: A custom [RDFJS DataFactory](http://rdf.js.org/#datafactory-interface) to construct terms and triples. _(Default: `require('@rdfjs/data-model')`)_
* `context`: An optional root context to use while parsing. This can by anything that is accepted by [jsonld-context-parser](https://github.com/rubensworks/jsonld-context-parser.js), such as a URL, object or array. _(Default: `{}`)_
* `baseIRI`: An initial default base IRI. _(Default: `''`)_
* `allowOutOfOrderContext`: If @context definitions should be allowed as non-first object entries. When enabled, streaming results may not come as soon as possible, and will be buffered until the end when no context is defined at all. _(Default: `false`)_
* `documentLoader` A custom loader for fetching remote contexts. This can be set to anything that implements [`IDocumentLoader`](https://github.com/rubensworks/jsonld-context-parser.js/blob/master/lib/IDocumentLoader.ts) _(Default: [`FetchDocumentLoader`](https://github.com/rubensworks/jsonld-context-parser.js/blob/master/lib/FetchDocumentLoader.ts))_
* `produceGeneralizedRdf`: If blank node predicates should be allowed, they will be ignored otherwise. _(Default: `false`)_
* `processingMode`: The maximum JSON-LD version that should be processable by this parser. _(Default: `1.0`)_
* `errorOnInvalidIris`: By default, JSON-LD requires that all properties (or @id's) that are not URIs, are unknown keywords, and do not occur in the context should be silently dropped. When setting this value to true, an error will be thrown when such properties occur. This is useful for debugging JSON-LD documents. _(Default: `false`)_
* `allowSubjectList`: If RDF lists can appear in the subject position. _(Default: `false`)_
* `validateValueIndexes`: If @index inside array nodes should be validated. I.e., nodes inside the same array with the same @id, should have equal @index values. This is not applicable to this parser as we don't do explicit flattening, but it is required to be spec-compliant. _(Default: `false`)_

```javascript
new JsonLdParser({
  dataFactory: require('@rdfjs/data-model'),
  context: 'https://schema.org/',
  baseIRI: 'http://example.org/',
  allowOutOfOrderContext: false,
  documentLoader: new FetchDocumentLoader(),
  produceGeneralizedRdf: false,
  processingMode: '1.0',
  errorOnInvalidIris: false,
  allowSubjectList: false,
  validateValueIndexes: false,
});
```

## How it works

TODO

## Specification Compliance

By default, this parser is not 100% spec-compliant.
The main reason for this being the fact that this is a _streaming_ parser,
and some edge-cases are really inefficient with the streaming-nature of this parser.

However, by changing a couple of settings, it can easily be made **fully spec-compliant**.
The downside of this is that the whole document will essentially be loaded in memory before results are emitted,
which will void the main benefit of this parser.

```javascript
const mySpecCompliantParser = new JsonLdParser({
  allowOutOfOrderContext: true,
  validateValueIndexes: true,
});
```

Concretely, this parser implements the following [JSON-LD specifications](https://json-ld.org/test-suite/):

* JSON-LD 1.0 - Transform JSON-LD to RDF
* JSON-LD 1.0 - Error handling

## Performance

The following table shows some simple performance comparisons between JSON-LD Streaming Parser and [jsonld.js](https://www.npmjs.com/package/jsonld).

These basic experiments show that even though streaming parsers are typically significantly slower than regular parsers,
JSON-LD Streaming Parser still achieves similar performance as jsonld.js for most typical JSON-LD files.
However, for expanded JSON-LD documents, JSON-LD Streaming Parser is around 3~4 times slower.

| File       | **JSON-LD Streaming Parser** | **jsonld.js** |
| ---------- | ---------------------------- | ------------- |
| [`toRdf-manifest.jsonld`](https://json-ld.org/test-suite/tests/toRdf-manifest.jsonld) (999 triples) | 683.964ms (38MB) | 708.975ms (40MB) |
| [`sparql-init.json`](https://raw.githubusercontent.com/comunica/comunica/master/packages/actor-init-sparql/config/sets/sparql-init.json) (69 triples, many complex nested contexts) | 931.698ms (40MB) | 1088.607ms (47MB) |
| [`person.json`](https://json-ld.org/playground/) (5 triples) | 309.419ms (30MB) | 313.138ms (41MB) |
| `dbpedia-10000-expanded.json` (First 10000 triples of DBpedia in expanded JSON-LD) | 785.557ms (70MB) | 202.363ms (62MB) |

[Code for measurements](https://github.com/rubensworks/jsonld-streaming-parser.js/tree/master/perf).

## License
This software is written by [Ruben Taelman](http://rubensworks.net/).

This code is released under the [MIT license](http://opensource.org/licenses/MIT).
