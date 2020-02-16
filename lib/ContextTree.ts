import {IJsonLdContextNormalized} from "jsonld-context-parser";

/**
 * A tree structure that holds all contexts,
 * based on their position in the JSON object.
 *
 * Positions are identified by a path of keys.
 */
export class ContextTree {

  private readonly subTrees: {[key: string]: ContextTree} = {};
  private context: Promise<IJsonLdContextNormalized> | null;

  public getContext([head, ...tail]: string[]): Promise<{ context: IJsonLdContextNormalized, depth: number }> | null {
    if (head || tail.length) {
      const subTree = this.subTrees[head];
      if (subTree) {
        const subContext = subTree.getContext(tail);
        if (subContext) {
          return subContext.then(({ context, depth }) => ({ context, depth: depth + 1 }));
        }
      }
    }
    return this.context ? this.context.then((context) => ({ context, depth: 0 })) : null;
  }

  public setContext([head, ...tail]: string[], context: Promise<IJsonLdContextNormalized> | null) {
    if (!head && !tail.length) {
      this.context = context;
    } else {
      let subTree = this.subTrees[head];
      if (!subTree) {
        subTree = this.subTrees[head] = new ContextTree();
      }
      subTree.setContext(tail, context);
    }
  }

  public removeContext(path: string[]) {
    this.setContext(path, null);
  }

}
