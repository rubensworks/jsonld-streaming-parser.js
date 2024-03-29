import {JsonLdContextNormalized, ContextParser} from "jsonld-context-parser";
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

    describe('getContextPropagationAware', () => {

      it('should return the root context when no contexts have been set', async () => {
        return expect(await parsingContext.getContextPropagationAware(['']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should return the root context when a non-matching context has been set', async () => {
        parsingContext.contextTree.setContext(['', 'a'],
          Promise.resolve(new JsonLdContextNormalized({})));
        return expect(await parsingContext.getContextPropagationAware(['']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should return a set context', async () => {
        parsingContext.contextTree.setContext(['', 'a'],
          Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }),
            depth: 2,
          });
      });

      it('should propagate to a direct parent', async () => {
        parsingContext.contextTree.setContext(['', 'a'],
          Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }),
            depth: 2,
          });
      });

      it('should propagate to indirect parents', async () => {
        parsingContext.contextTree.setContext(['', 'a'],
          Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b', 'c', 'd']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }),
            depth: 2,
          });
      });

      it('should skip a non-propagating parent', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should return a non-propagating context if at that exact depth', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@propagate': false,
              '@vocab': 'http://bla.org/',
            }),
            depth: 2,
          });
      });

      it('should skip an indirect non-propagating parent', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b', 'c', 'd']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should skip multiple indirect non-propagating parent', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla1.org/',
        })));
        parsingContext.contextTree.setContext(['', 'a', 'b', 'c'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla2.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b', 'c', 'd']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should ignore non-propagating contexts from above', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': false,
          '@vocab': 'http://bla1.org/',
        })));
        parsingContext.contextTree.setContext(['', 'a', 'b', 'c'], Promise.resolve(new JsonLdContextNormalized({
          '@propagate': true,
          '@vocab': 'http://bla2.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b', 'c', 'd']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@propagate': true,
              '@vocab': 'http://bla2.org/',
            }),
            depth: 4,
          });
      });

      it('should return an empty context when the root is non-propagating', async () => {
        parsingContext = new ParsingContextMocked({
          context: { '@vocab': 'http://vocab.org/', '@propagate': false },
          parser: <any> null,
        });
        return expect(await parsingContext.getContextPropagationAware(['']))
          .toEqual({
            context: new JsonLdContextNormalized({}),
            depth: 0,
          });
      });

      it('should return an empty context when the root is non-propagating unless root is retrieved', async () => {
        parsingContext = new ParsingContextMocked({
          context: { '@vocab': 'http://vocab.org/', '@propagate': false },
          parser: <any> null,
        });
        return expect(await parsingContext.getContextPropagationAware([]))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@propagate': false,
              '@vocab': 'http://vocab.org/',
            }),
            depth: 0,
          });
      });

      it('should return a non-propagating context if at that exact depth with a fallback context', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@__propagateFallback': { fallback: true },
          '@propagate': false,
          '@vocab': 'http://bla.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a']))
          .toEqual({
            context: new JsonLdContextNormalized({
              '@__propagateFallback': { fallback: true },
              '@propagate': false,
              '@vocab': 'http://bla.org/',
            }),
            depth: 2,
          });
      });

      it('should return the fallback context from a non-propagating context if calling from deeper', async () => {
        parsingContext.contextTree.setContext(['', 'a'], Promise.resolve(new JsonLdContextNormalized({
          '@__propagateFallback': { fallback: true },
          '@propagate': false,
          '@vocab': 'http://bla.org/',
        })));
        return expect(await parsingContext.getContextPropagationAware(['', 'a', 'b']))
          .toEqual({
            context: new JsonLdContextNormalized({ fallback: true }),
            depth: 2,
          });
      });

    });

    describe('getContext', () => {

      describe('for basic context trees', () => {

        it('should return the root context when no contexts have been set', async () => {
          return expect(await parsingContext.getContext(['']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
        });

        it('should return the root context when a non-matching context has been set', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({})));
          return expect(await parsingContext.getContext(['']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
        });

        it('should return a set context with offset 0', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 1', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 'b']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 0 and ignore one array key', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 1], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 1 and ignore one array key', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 'b', 1]))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 0 and ignore multiple array keys', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 1, 0, 2], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 1 and ignore multiple array key', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 'b', 1, 0, 2]))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 0 and not ignore non-last array keys', async () => {
          parsingContext.contextTree.setContext(['', 1, 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 1, 'a'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should return a set context with offset 1 and not ignore non-last array keys', async () => {
          parsingContext.contextTree.setContext(['', 1, 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 1, 'a', 'b']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
            }));
        });

        it('should fail to return a set context with offset 2 and fallback to root', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla.org/' })));
          return expect(await parsingContext.getContext(['', 'a', 'b'], 2))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
        });

        it('should return for two nested set contexts with offset 0', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla1.org/' })));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla2.org/' })));
          expect(await parsingContext.getContext(['', 'a'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla2.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla2.org/',
            }));
        });

        it('should return for two nested set contexts with offset 1', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla1.org/' })));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla2.org/' })));
          expect(await parsingContext.getContext(['', 'a']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla2.org/',
            }));
        });

        it('should return for two nested set contexts with offset 2', async () => {
          parsingContext.contextTree.setContext(['', 'a'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla1.org/' })));
          parsingContext.contextTree.setContext(['', 'a', 'b', 'c'],
            Promise.resolve(new JsonLdContextNormalized({ '@vocab': 'http://bla2.org/' })));
          expect(await parsingContext.getContext(['', 'a'], 2))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b'], 2))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c'], 2))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
          expect(await parsingContext.getContext(['', 'a', 'b', 'c', 'd'], 2))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla1.org/',
            }));
        });

      });

      describe('for property-scoped contexts', () => {

        beforeEach(() => {
          parsingContext.contextTree.setContext([''], Promise.resolve(new JsonLdContextNormalized({
            '@vocab': 'http://vocab.main.org/',
            'a': {
              '@context': {
                '@vocab': 'http://vocab.a.org/',
              },
              '@id': 'http://a.org',
            },
          })));
        });

        it('should ignore non-applicable properties', async () => {
          return expect(await parsingContext.getContext(['', 'b', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.main.org/',
              'a': {
                '@context': {
                  '@vocab': 'http://vocab.a.org/',
                },
                '@id': 'http://a.org',
              },
            }));
        });

        it('should consider an applicable property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
            }));
        });

        it('should consider an applicable property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
            }));
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

      describe('for non-propagating property-scoped contexts', () => {

        beforeEach(() => {
          parsingContext.contextTree.setContext([''], Promise.resolve(new JsonLdContextNormalized({
            '@vocab': 'http://vocab.main.org/',
            'a': {
              '@context': {
                '@propagate': false,
                '@vocab': 'http://vocab.a.org/',
              },
              '@id': 'http://a.org',
            },
          })));
        });

        it('should ignore non-applicable properties', async () => {
          return expect(await parsingContext.getContext(['', 'b', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.main.org/',
              'a': {
                '@context': {
                  '@propagate': false,
                  '@vocab': 'http://vocab.a.org/',
                },
                '@id': 'http://a.org',
              },
            }));
        });

        it('should consider an applicable property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.a.org/',
              'a': {
                '@id': 'http://a.org',
              },
            }));
        });

        it('should not consider an applicable property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.main.org/',
              'a': {
                '@context': {
                  '@propagate': false,
                  '@vocab': 'http://vocab.a.org/',
                },
                '@id': 'http://a.org',
              },
            }));
        });

      });

      describe('for nested property-scoped contexts', () => {

        beforeEach(() => {
          parsingContext.contextTree.setContext([''], Promise.resolve(new JsonLdContextNormalized({
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
          })));
        });

        it('should ignore non-applicable properties', async () => {
          return expect(await parsingContext.getContext(['', 'b', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
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

        it('should consider an applicable property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
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
            }));
        });

        it('should consider an applicable sub-property', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'b', 'subKey']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.b.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@id': 'http://b.org',
              },
            }));
        });

        it('should consider an applicable property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual(new JsonLdContextNormalized({
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
            }));
        });

        it('should consider an applicable sub-property when called via sub-properties', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'b', 'subKey1', 'subKey2', 'subKey3']))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://vocab.b.org/',
              'a': {
                '@id': 'http://a.org',
              },
              'b': {
                '@id': 'http://b.org',
              },
            }));
        });

      });

      describe('for type-scoped and property-scoped contexts', () => {

        beforeEach(() => {
          const contextParser = new ContextParser();
          parsingContext.contextTree.setContext(['', 'a'], contextParser.parse({
            '@vocab': 'http://bla.org/',
            'bar': {
              '@context': {
                baz: { '@type': '@vocab' },
              },
            },
          }));
        });

        it('should consider the applicable property-scoped context', async () => {
          return expect(await parsingContext.getContext(['', 'a', 'bar'], 0))
            .toEqual(new JsonLdContextNormalized({
              '@vocab': 'http://bla.org/',
              'bar': { '@id': 'http://bla.org/bar' },
              'baz': { '@type': '@vocab', '@id': 'http://bla.org/baz' },
            }));
        });
      });

    });

  });
});
