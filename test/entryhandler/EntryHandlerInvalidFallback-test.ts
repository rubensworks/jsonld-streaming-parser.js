import {EntryHandlerInvalidFallback} from "../../lib/entryhandler/EntryHandlerInvalidFallback";

describe('EntryHandlerInvalidFallback', () => {
  const handler = new EntryHandlerInvalidFallback();

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
