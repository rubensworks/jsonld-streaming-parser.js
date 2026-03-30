const { ErrorSkipped } = require('rdf-test-suite');
const { JsonLdParser } = require('..');

module.exports = {
  parse(data, baseIRI, options) {
    if (options.processingMode && (options.processingMode !== '1.0' && options.processingMode !== '1.1')) {
      return Promise.reject(
        new ErrorSkipped(`Test with processing mode ${options.processingMode} was skipped, only 1.0 is supported.`),
      );
    }
    if (options.specVersion && options.specVersion !== '1.1' && options.specVersion !== 'star') {
      return Promise.reject(
        new ErrorSkipped(`Test with spec version ${options.specVersion} was skipped, only 1.1 is supported.`),
      );
    }
    return require('arrayify-stream').default(require('streamify-string')(data)
      .pipe(new JsonLdParser({ baseIRI, validateValueIndexes: true, normalizeLanguageTags: true, // To simplify testing
        rdfDirection: 'disabled', ...options })));
  },
};
