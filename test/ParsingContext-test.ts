import {ParsingContext} from "../lib/ParsingContext";
import {ParsingContextMocked} from "../mocks/ParsingContextMocked";

describe('ParsingContext', () => {

  describe('an empty instance', () => {
    let parsingContext: ParsingContext;

    beforeEach(() => {
      parsingContext = new ParsingContextMocked({
        context: { '@vocab': 'http://vocab.org/' },
        parser: <any> null,
      });
    });

    describe('getContext', () => {

      describe('for basic context trees', () => {

        it('should return the root context when no contexts have been set', async () => {
          return expect(await parsingContext.getContext(['']))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
        });

        it('should return the root context when a non-matching context has been set', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({}));
          return expect(await parsingContext.getContext(['']))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
        });

        it('should return a set context with offset 0', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla.org/' }));
          return expect(await parsingContext.getContext(['', 'a'], 0))
            .toEqual({
              '@vocab': 'http://bla.org/',
            });
        });

        it('should return a set context with offset 1', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla.org/' }));
          return expect(await parsingContext.getContext(['', 'a', 'b']))
            .toEqual({
              '@vocab': 'http://bla.org/',
            });
        });

        it('should fail to return a set context with offset 2 and fallback to root', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla.org/' }));
          return expect(await parsingContext.getContext(['', 'a', 'b'], 2))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
        });

        it('should return for two nested set contexts with offset 0', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla1.org/' }));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'], Promise.resolve({ '@vocab': 'http://bla2.org/' }));
          expect(await parsingContext.getContext(['', 'a'], 0))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b'], 0))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c'], 0))
            .toEqual({
              '@vocab': 'http://bla2.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd']))
            .toEqual({
              '@vocab': 'http://bla2.org/',
            });
        });

        it('should return for two nested set contexts with offset 1', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla1.org/' }));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'], Promise.resolve({ '@vocab': 'http://bla2.org/' }));
          expect(await parsingContext.getContext(['', 'a']))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b']))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c']))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd']))
            .toEqual({
              '@vocab': 'http://bla2.org/',
            });
        });

        it('should return for two nested set contexts with offset 2', async () => {
          parsingContext.contextTree.setContext(['', 'a'], Promise.resolve({ '@vocab': 'http://bla1.org/' }));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'], Promise.resolve({ '@vocab': 'http://bla2.org/' }));
          expect(await parsingContext.getContext(['', 'a'], 2))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b'], 2))
            .toEqual({
              '@vocab': 'http://vocab.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c'], 2))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd'], 2))
            .toEqual({
              '@vocab': 'http://bla1.org/',
            });
        });

      });

      describe('for property-scoped contexts', () => {

        beforeEach(() => {
          parsingContext.contextTree.setContext([''], Promise.resolve({
            '@vocab': 'http://vocab.main.org/',
            'a': {
              '@context': {
                '@vocab': 'http://vocab.a.org/',
              },
              '@id': 'http://a.org',
            },
          }));
        });

        it('should ignore non-applicable properties', async () => {
          return expect(await parsingContext.getContext(['', 'b', 'subKey']))
            .toEqual({
              '@vocab': 'http://vocab.main.org/',
              'a': {
                '@context': {
                  '@vocab': 'http://vocab.a.org/',
                },
                '@id': 'http://a.org',
              },
            });
        });

        it('should consider an applicable property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey']))
            .toEqual({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
            });
        });

        it('should consider an applicable property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
            });
        });

        it('should only parse a scoped context once for repeated getContext calls', async () => {
          const spy = jest.spyOn(parsingContext, 'parseContext');
          await parsingContext.getContext(['', 'a', 'subKey']);
          await parsingContext.getContext(['', 'a', 'subKey']);
          await parsingContext.getContext(['', 'a', 'subKey']);
          return expect(spy).toHaveBeenCalledTimes(1);
        });

        it('should only parse a scoped context once depth-first getContext calls', async () => {
          const spy = jest.spyOn(parsingContext, 'parseContext');
          await parsingContext.getContext(['', 'a', 'subKey', 'subSubKey', 'subSubSubKey']);
          await parsingContext.getContext(['', 'a', 'subKey', 'subSubKey']);
          await parsingContext.getContext(['', 'a', 'subKey']);
          return expect(spy).toHaveBeenCalledTimes(1);
        });

      });

      describe('for nested property-scoped contexts', () => {

        beforeEach(() => {
          parsingContext.contextTree.setContext([''], Promise.resolve({
            '@vocab': 'http://vocab.main.org/',
            'a': {
              '@context': {
                '@vocab': 'http://vocab.a.org/',
                'b': {
                  '@context': {
                    '@vocab': 'http://vocab.b.org/',
                  },
                  '@id': 'http://b.org',
                },
              },
              '@id': 'http://a.org',
            },
          }));
        });

        it('should ignore non-applicable properties', async () => {
          return expect(await parsingContext.getContext(['', 'b', 'subKey']))
            .toEqual({
              '@vocab': 'http://vocab.main.org/',
              'a': {
                '@context': {
                  '@vocab': 'http://vocab.a.org/',
                  'b': {
                    '@context': {
                      '@vocab': 'http://vocab.b.org/',
                    },
                    '@id': 'http://b.org',
                  },
                },
                '@id': 'http://a.org',
              },
            });
        });

        it('should consider an applicable property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey']))
            .toEqual({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@context': {
                  '@vocab': 'http://vocab.b.org/',
                },
                '@id': 'http://b.org',
              },
            });
        });

        it('should consider an applicable sub-property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'b', 'subKey']))
            .toEqual({
              '@vocab': 'http://vocab.b.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@id': 'http://b.org',
              },
            });
        });

        it('should consider an applicable property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@context': {
                  '@vocab': 'http://vocab.b.org/',
                },
                '@id': 'http://b.org',
              },
            });
        });

        it('should consider an applicable sub-property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'b', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual({
              '@vocab': 'http://vocab.b.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@id': 'http://b.org',
              },
            });
        });

      });

    });

  });
});
