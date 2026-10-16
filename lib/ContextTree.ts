import type { JsonLdContextNormalized } from 'jsonld-context-parser';

/**
 * A tree structure that holds all contexts,
 * based on their position in the JSON object.
 *
 * Positions are identified by a path of keys.
 */
export class ContextTree {
  private readonly subTrees: Record<string, ContextTree> = {};
  private context: Promise<JsonLdContextNormalized> | null = null;

  public getContext(keys: string[], index = 0): Promise<{ context: JsonLdContextNormalized; depth: number }> | null {
    // Walk the tree using an index into `keys` rather than `[ head, ...tail ]`,
    // which would allocate a fresh `tail` array on every recursive call.
    if (index < keys.length) {
      const subTree = this.subTrees[keys[index]];
      if (subTree) {
        const subContext = subTree.getContext(keys, index + 1);
        if (subContext) {
          return subContext.then(({ context, depth }) => ({ context, depth: depth + 1 }));
        }
      }
    }
    return this.context ? this.context.then(context => ({ context, depth: 0 })) : null;
  }

  /**
   * Synchronously check whether {@link #getContext} would return a context (i.e. a non-null value)
   * for the given path.
   *
   * This is a pure boolean mirror of {@link #getContext}'s non-null semantics. It is used for
   * truthiness tests where only the *presence* of a context matters, avoiding the intermediate
   * Promise (and its `.then` closure) that {@link #getContext} allocates for that check.
   *
   * @param keys The path of keys to check.
   * @param index The current offset into `keys` (defaults to 0).
   * @param end The exclusive upper bound within `keys` to walk (defaults to `keys.length`).
   * @return {boolean} True if a context exists at or above the given path.
   */
  public hasContext(keys: string[], index = 0, end: number = keys.length): boolean {
    if (index < end) {
      const subTree = this.subTrees[keys[index]];
      if (subTree && subTree.hasContext(keys, index + 1, end)) {
        return true;
      }
    }
    return Boolean(this.context);
  }

  public setContext(keys: any[], context: Promise<JsonLdContextNormalized> | null): void {
    if (keys.length === 0) {
      this.context = context;
    } else {
      // eslint-disable-next-line ts/no-unsafe-assignment
      const [ head, ...tail ] = keys;
      let subTree = this.subTrees[head];
      if (!subTree) {
        subTree = this.subTrees[head] = new ContextTree();
      }
      subTree.setContext(tail, context);
    }
  }

  public removeContext(path: string[]): void {
    this.setContext(path, null);
  }
}
