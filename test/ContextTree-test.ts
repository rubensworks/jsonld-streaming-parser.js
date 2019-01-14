import {ContextTree} from "../lib/ContextTree";

describe('ContextTree', () => {

  describe('an empty instance', () => {
    let tree;

    beforeEach(() => {
      tree = new ContextTree();
    });

    it('should have no contexts', async () => {
      expect(tree.getContext([])).toBeFalsy();
      expect(tree.getContext(['a'])).toBeFalsy();
      expect(tree.getContext(['a', 'b'])).toBeFalsy();
    });

    it('should should set a context at depth 1', async () => {
      const c = Promise.resolve({});
      tree.setContext(['a'], c);
      expect(tree.getContext(['a'])).toBe(c);
      expect(tree.getContext(['a', 'b'])).toBe(c);
    });

    it('should should set a context at depth 2', async () => {
      const c = Promise.resolve({});
      tree.setContext(['a', 'b'], c);
      expect(tree.getContext(['a'])).toBeFalsy();
      expect(tree.getContext(['a', 'b'])).toBe(c);
    });

    it('should allow branched context setting', async () => {
      const c1 = Promise.resolve({});
      const c2 = Promise.resolve({});
      tree.setContext(['a', 'b'], c1);
      tree.setContext(['a', 'c'], c2);

      expect(tree.getContext(['a'])).toBeFalsy();
      expect(tree.getContext(['a', 'b'])).toBe(c1);
      expect(tree.getContext(['a', 'c'])).toBe(c2);
    });

    it('should not allow overriding contexts', async () => {
      const c1 = Promise.resolve({});
      const c2 = Promise.resolve({});
      tree.setContext(['a', 'b'], c1);
      tree.setContext(['a', 'b'], c2);

      expect(tree.getContext(['a'])).toBeFalsy();
      expect(tree.getContext(['a', 'b'])).toBe(c2);
    });
  });

  describe('an instance with a root context', () => {
    let tree;
    const root = Promise.resolve({});

    beforeEach(() => {
      tree = new ContextTree();
      tree.setContext(['a', 'b'], root);
    });

    it('should return the root', async () => {
      expect(tree.getContext([])).toBeFalsy();
      expect(tree.getContext(['a'])).toBeFalsy();
      expect(tree.getContext(['a', 'b'])).toBe(root);
      expect(tree.getContext(['a', 'b', 'c'])).toBe(root);
    });
  });
});
