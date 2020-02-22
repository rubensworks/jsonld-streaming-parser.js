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
      expect(await tree.getContext(['a'])).toEqual({ context: await c, depth: 1 });
      expect(await tree.getContext(['a', 'b'])).toEqual({ context: await c, depth: 1 });
    });

    it('should should set a context at depth 1 for an undefined key', async () => {
      const c = Promise.resolve({ a: 'b' });
      tree.setContext([undefined], c);
      expect(await tree.getContext([undefined])).toEqual({ context: await c, depth: 1 });
      expect(await tree.getContext([undefined, 'b'])).toEqual({ context: await c, depth: 1 });
    });

    it('should should set a context at depth 2', async () => {
      const c = Promise.resolve({});
      tree.setContext(['a', 'b'], c);
      expect(tree.getContext(['a'])).toBeFalsy();
      expect(await tree.getContext(['a', 'b'])).toEqual({ context: await c, depth: 2 });
    });

    it('should allow branched context setting', async () => {
      const c1 = Promise.resolve({});
      const c2 = Promise.resolve({});
      tree.setContext(['a', 'b'], c1);
      tree.setContext(['a', 'c'], c2);

      expect(tree.getContext(['a'])).toBeFalsy();
      expect(await tree.getContext(['a', 'b'])).toEqual({ context: await c1, depth: 2 });
      expect(await tree.getContext(['a', 'c'])).toEqual({ context: await c2, depth: 2 });
    });

    it('should not allow overriding contexts', async () => {
      const c1 = Promise.resolve({});
      const c2 = Promise.resolve({});
      tree.setContext(['a', 'b'], c1);
      tree.setContext(['a', 'b'], c2);

      expect(tree.getContext(['a'])).toBeFalsy();
      expect(await tree.getContext(['a', 'b'])).toEqual({ context: await c2, depth: 2 });
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
      expect(await tree.getContext(['a', 'b'])).toEqual({ context: await root, depth: 2 });
      expect(await tree.getContext(['a', 'b', 'c'])).toEqual({ context: await root, depth: 2 });
    });
  });
});
