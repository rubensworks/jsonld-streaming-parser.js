import {EntryHandlerKeyword} from "../../../lib/entryhandler/keyword/EntryHandlerKeyword";

describe('EntryHandlerKeyword', () => {
  const handler = new (<any> EntryHandlerKeyword)();

  describe('isPropertyHandler', () => {
    it('should return false', async () => {
      expect(handler.isPropertyHandler()).toBe(false);
    });
  });
});
