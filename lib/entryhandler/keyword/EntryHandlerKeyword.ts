import type { ParsingContext } from '../../ParsingContext';
import type { Util } from '../../Util';
import type { IEntryHandler } from '../IEntryHandler';

/**
 * An abstract keyword entry handler.
 */
export abstract class EntryHandlerKeyword implements IEntryHandler<boolean> {
  private readonly keyword: string;

  protected constructor(keyword: string) {
    this.keyword = keyword;
  }

  public isPropertyHandler(): boolean {
    return false;
  }

  public isStackProcessor(): boolean {
    return true;
  }

  public async validate(
    _parsingContext: ParsingContext,
    _util: Util,
    _keys: any[],
    _depth: number,
    _inProperty: boolean,
  ): Promise<boolean> {
    return false;
  }

  public async test(
    _parsingContext: ParsingContext,
    _util: Util,
    key: any,
    _keys: any[],
    _depth: number,
  ): Promise<boolean> {
    return key === this.keyword;
  }

  public abstract handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number,
    testResult: boolean): Promise<any>;
}
