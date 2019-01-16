import {EntryHandlerKeywordUnknownFallback} from "../../../lib/entryhandler/keyword/EntryHandlerKeywordUnknownFallback";

describe('EntryHandlerKeywordUnknownFallback', () => {
  const handler = new EntryHandlerKeywordUnknownFallback();

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
