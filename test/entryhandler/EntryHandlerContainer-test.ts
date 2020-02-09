import {EntryHandlerContainer} from "../../lib/entryhandler/EntryHandlerContainer";
import {Util} from "../../lib/Util";
import {ParsingContextMocked} from "../../mocks/ParsingContextMocked";

describe('EntryHandlerContainer', () => {
  const handler = new EntryHandlerContainer();

  let parsingContext;
  let util;

  beforeEach(() => {
    parsingContext = new ParsingContextMocked({ parser: null });
    util = new Util({ parsingContext });
  });

  describe('isSimpleGraphContainer', () => {
    it('should return true for @graph', () => {
      expect(EntryHandlerContainer.isSimpleGraphContainer({ '@graph': true }))
        .toBe(true);
    });

    it('should return true for @graph and @set', () => {
      expect(EntryHandlerContainer.isSimpleGraphContainer({ '@graph': true, '@set': true }))
        .toBe(true);
    });

    it('should return false for @graph and @id', () => {
      expect(EntryHandlerContainer.isSimpleGraphContainer({ '@graph': true, '@id': true }))
        .toBe(false);
    });

    it('should return false for @graph and @index', () => {
      expect(EntryHandlerContainer.isSimpleGraphContainer({ '@graph': true, '@index': true }))
        .toBe(false);
    });

    it('should return false for @graph, @index and @set', () => {
      expect(EntryHandlerContainer.isSimpleGraphContainer({ '@graph': true, '@index': true, '@set': true }))
        .toBe(false);
    });
  });

  describe('isComplexGraphContainer', () => {
    it('should return false for @graph', () => {
      expect(EntryHandlerContainer.isComplexGraphContainer({ '@graph': true }))
        .toBe(false);
    });

    it('should return false for @graph and @set', () => {
      expect(EntryHandlerContainer.isComplexGraphContainer({ '@graph': true, '@set': true }))
        .toBe(false);
    });

    it('should return true for @graph and @id', () => {
      expect(EntryHandlerContainer.isComplexGraphContainer({ '@graph': true, '@id': true }))
        .toBe(true);
    });

    it('should return true for @graph and @index', () => {
      expect(EntryHandlerContainer.isComplexGraphContainer({ '@graph': true, '@index': true }))
        .toBe(true);
    });

    it('should return true for @graph, @index and @set', () => {
      expect(EntryHandlerContainer.isComplexGraphContainer({ '@graph': true, '@index': true, '@set': true }))
        .toBe(true);
    });
  });

  describe('getContainerGraphIndex', () => {
    it('should return for @graph without arrays', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true}, 2, [null, 'cont', 'key']))
        .toEqual('');
    });

    it('should return for @graph with one array', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true}, 2, [null, 'cont', 0, 'key']))
        .toEqual(':0');
    });

    it('should return for @graph with arrays', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true}, 2, [null, 'cont', 0, 1, 0, 'key']))
        .toEqual(':0:1:0');
    });

    it('should return for @graph-@id without arrays', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 'id']))
        .toEqual(':id');
    });

    it('should return for @graph-@id with one array after id', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 'id', 0]))
        .toEqual(':id:0');
    });

    it('should return for @graph-@id with arrays after id', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 'id', 0, 1, 0]))
        .toEqual(':id:0:1:0');
    });

    it('should return for @graph-@id with one array before id', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 0, 'id']))
        .toEqual(':0:id');
    });

    it('should return for @graph-@id with arrays before id', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 0, 1, 0, 'id']))
        .toEqual(':0:1:0:id');
    });

    it('should return for @graph-@id with arrays before and after id', () => {
      expect(EntryHandlerContainer.getContainerGraphIndex({'@graph': true, '@id': true}, 3,
        [null, 'cont', 'graph', 0, 1, 0, 'id', 0, 1, 0]))
        .toEqual(':0:1:0:id:0:1:0');
    });
  });

  describe('getContainerHandler', () => {
    it('should return fallback on an empty array', async () => {
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, [], 0))
        .toMatchObject({
          containers: { '@set': true },
          depth: 0,
          fallback: true,
        });
    });

    it('should return fallback on one number', async () => {
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, [0], 0))
        .toMatchObject({
          containers: { '@set': true },
          depth: 0,
          fallback: true,
        });
    });

    it('should return fallback on all numbers', async () => {
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, [0, 1, 2], 2))
        .toMatchObject({
          containers: { '@set': true },
          depth: 2,
          fallback: true,
        });
    });

    it('should return when targeting a depth in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toMatchObject({
          containers: { '@id': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth in an @index container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@index": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toMatchObject({
          containers: { '@index': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth in an @language container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@language": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toMatchObject({
          containers: { '@language': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth in an @type container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@type": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toMatchObject({
          containers: { '@type': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return fallback when targeting a depth in an unknown container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@bla": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toMatchObject({
          containers: { '@set': true },
          depth: 3,
          fallback: true,
        });
    });

    it('should return when targeting a depth within one array in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true  } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", 0, "subSubKey"], 4))
        .toMatchObject({
          containers: { '@id': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth within two arrays in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true  } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", 0, 1, "subSubKey"], 4))
        .toMatchObject({
          containers: { '@id': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return fallback when targeting a depth within an object in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toMatchObject({
          containers: { '@set': true },
          depth: 4,
          fallback: true,
        });
    });

    it('should return when targeting a depth in an @graph container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key"], 2))
        .toMatchObject({
          containers: { '@graph': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth in an @graph @set container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@set": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key"], 2))
        .toMatchObject({
          containers: { '@graph': true, '@set': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return fallback when targeting a depth above an @graph container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key"], 1))
        .toMatchObject({
          containers: { '@set': true },
          depth: 1,
          fallback: true,
        });
    });

    it('should return fallback when targeting a depth below an @graph container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true } } }));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext, ["a", "container", "key", "keyDeeper"], 3))
        .toMatchObject({
          containers: { '@set': true },
          depth: 3,
          fallback: true,
        });
    });

    it('should return when targeting a depth within a graph index container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toMatchObject({
          containers: { '@graph': true, '@index': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth within a graph id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toMatchObject({
          containers: { '@graph': true, '@id': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth of a graph index container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toMatchObject({
          containers: { '@graph': true, '@index': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return when targeting a depth of a graph id container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toMatchObject({
          containers: { '@graph': true, '@id': true },
          depth: 2,
          fallback: false,
        });
    });

    it('should return fallback when targeting a depth of a graph type container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@type": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toMatchObject({
          containers: { '@set': true },
          depth: 3,
          fallback: true,
        });
    });

    it('should return fallback when targeting a depth of a graph language container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@language": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toMatchObject({
          containers: { '@set': true },
          depth: 3,
          fallback: true,
        });
    });

    it('should return fallback when targeting a depth below a graph index container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey", "subSubSubKey"], 5))
        .toMatchObject({
          containers: { '@set': true },
          depth: 5,
          fallback: true,
        });
    });

    it('should return fallback when targeting a depth below a graph id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.getContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey", "subSubSubKey"], 5))
        .toMatchObject({
          containers: { '@set': true },
          depth: 5,
          fallback: true,
        });
    });
  });

  describe('isBufferableContainerHandler', () => {
    it('should return false on an empty array', async () => {
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext, [], 0))
        .toBe(false);
    });

    it('should return false on one number', async () => {
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext, [0], 0))
        .toBe(false);
    });

    it('should return false on all numbers', async () => {
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext, [0, 1, 2], 2))
        .toBe(false);
    });

    it('should return true when targeting a depth in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @index container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@index": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @language container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@language": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @type container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@type": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an unknown container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@bla": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(false);
    });

    it('should return true when targeting a depth within one array in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true  } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", 0, "subSubKey"], 4))
        .toBe(true);
    });

    it('should return true when targeting a depth within two arrays in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true  } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", 0, 1, "subSubKey"], 4))
        .toBe(true);
    });

    it('should return false when targeting a depth within an object in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@id": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toBe(false);
    });

    it('should return false when targeting a depth in an @graph container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 2))
        .toBe(false);
    });

    it('should return true when targeting a depth below an @graph container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true } } }));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey"], 3))
        .toBe(false);
    });

    it('should return false when targeting a depth within a graph index container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toBe(false);
    });

    it('should return false when targeting a depth within a graph id container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toBe(false);
    });

    it('should return false when targeting a depth of a graph index container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toBe(false);
    });

    it('should return false when targeting a depth of a graph id container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 3))
        .toBe(false);
    });

    it('should return false when targeting a depth below a graph index container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@index": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey", "subSubSubKey"], 5))
        .toBe(false);
    });

    it('should return false when targeting a depth below a graph id container in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": { "@graph": true, "@id": true } }}));
      expect(await EntryHandlerContainer.isBufferableContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey", "subSubSubKey"], 5))
        .toBe(false);
    });
  });

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
