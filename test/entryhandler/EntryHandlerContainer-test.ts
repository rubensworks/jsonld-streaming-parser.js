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

  describe('isContainerHandler', () => {
    it('should return false on an empty array', async () => {
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, [], 0))
        .toBe(false);
    });

    it('should return false on one number', async () => {
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, [0], 0))
        .toBe(false);
    });

    it('should return false on all numbers', async () => {
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, [0, 1, 2], 2))
        .toBe(false);
    });

    it('should return true when targeting a depth in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@id" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @index container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@index" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @language container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@language" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an @type container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@type" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toBe(true);
    });

    it('should return true when targeting a depth in an unknown container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@bla" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext, ["a", "container", "key", "subKey"], 3))
        .toBe(false);
    });

    it('should return true when targeting a depth within one array in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@id" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext,
        ["a", "container", "key", 0, "subSubKey"], 4))
        .toBe(true);
    });

    it('should return true when targeting a depth within two arrays in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@id" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext,
        ["a", "container", "key", 0, 1, "subSubKey"], 4))
        .toBe(true);
    });

    it('should return false when targeting a depth within an object in an @id container', async () => {
      parsingContext.contextTree.setContext(["a", "container"],
        Promise.resolve({ container: { "@container": "@id" } }));
      expect(await EntryHandlerContainer.isContainerHandler(parsingContext,
        ["a", "container", "key", "subKey", "subSubKey"], 4))
        .toBe(false);
    });
  });

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
