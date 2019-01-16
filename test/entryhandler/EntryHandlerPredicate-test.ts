import {EntryHandlerPredicate} from "../../lib/entryhandler/EntryHandlerPredicate";

describe('EntryHandlerPredicate', () => {
  const handler = new EntryHandlerPredicate();

  describe('isPropertyHandler', () => {
    it('should return true', async () => {
      expect(handler.isPropertyHandler()).toBe(true);
    });
  });
});
