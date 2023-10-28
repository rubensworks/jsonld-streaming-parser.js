const { JsonLdParser } = require("..");
const { ContextParser, FetchDocumentLoader, ContextCache } = require("jsonld-context-parser");
const { ErrorSkipped } = require('rdf-test-suite');


const deepFreeze = obj => {
  Object.keys(obj).forEach(prop => {
    if (typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) deepFreeze(obj[prop]);
  });
  return Object.freeze(obj);
};

class FrozenContextParser extends ContextParser {
  constructor(options) {
    super(options);
  }

  async parse(context, options) {
    const parsed = await super.parse(context, options);
    deepFreeze(parsed);
    return parsed;
  }
}


module.exports = {
  parse: function (data, baseIRI, options) {
    if (options.processingMode && (options.processingMode !== '1.0' && options.processingMode !== '1.1')) {
      return Promise.reject(
        new ErrorSkipped(`Test with processing mode ${options.processingMode} was skipped, only 1.0 is supported.`));
    }
    if (options.specVersion && options.specVersion !== '1.1' && options.specVersion !== 'star') {
      return Promise.reject(
        new ErrorSkipped(`Test with spec version ${options.specVersion} was skipped, only 1.1 is supported.`));
    }
    return require('arrayify-stream').default(require('streamify-string')(data)
      .pipe(new JsonLdParser(Object.assign({
        baseIRI,
        validateValueIndexes: true,
        normalizeLanguageTags: true, // To simplify testing
        contextParser: new FrozenContextParser({
          documentLoader: new FetchDocumentLoader(),
          contextCache: new ContextCache(),
        }),
      }, options))));
  },
};
