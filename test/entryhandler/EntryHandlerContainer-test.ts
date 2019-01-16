import {EntryHandlerContainer} from "../../lib/entryhandler/EntryHandlerContainer";

describe('EntryHandlerContainer', () => {
  const handler = new EntryHandlerContainer();

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
