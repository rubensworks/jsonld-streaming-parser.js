import { JsonLdContextNormalized } from 'jsonld-context-parser';
import { EntryHandlerPredicate } from '../../lib/entryhandler/EntryHandlerPredicate';
import { ParsingContext } from '../../lib/ParsingContext';
import { Util } from '../../lib/Util';

describe('EntryHandlerPredicate', () => {
  const handler = new EntryHandlerPredicate();

  let parsingContext: ParsingContext;
  let util: Util;

  beforeEach(() => {
    parsingContext = new ParsingContext(<any> {});
    util = new Util({ parsingContext });
  });

  describe('isPropertyHandler', () => {
    it('should return true', async() => {
      expect(handler.isPropertyHandler()).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return false for empty keys', async() => {
      await expect(handler.validate(parsingContext, util, [ '' ], 0, false)).resolves.toBeFalsy();
    });

    it('should return false on blank node properties', async() => {
      await expect(handler.validate(parsingContext, util, [ '_:b' ], 0, false)).resolves.toBeFalsy();
    });

    it('should return true on regular properties', async() => {
      await expect(handler.validate(parsingContext, util, [ 'http://prop.com' ], 0, false)).resolves.toBeTruthy();
    });

    it('should return true on compacted properties', async() => {
      parsingContext.contextTree.setContext([], Promise.resolve(new JsonLdContextNormalized({ prop: 'http://example.org/' })));
      await expect(handler.validate(parsingContext, util, [ 'prop' ], 0, false)).resolves.toBeTruthy();
    });

    it('should return false on compacted properties without known expansion', async() => {
      parsingContext.contextTree.setContext([], Promise.resolve(new JsonLdContextNormalized({ prop: 'http://example.org/' })));
      await expect(handler.validate(parsingContext, util, [ 'propDifferent' ], 0, false)).resolves.toBeFalsy();
    });
  });
});
