import type { ParsingContext } from '../ParsingContext';
import type { Util } from '../Util';
import type { IEntryHandler } from './IEntryHandler';

/**
 * A catch-all for properties, that will either emit an error or ignore,
 * depending on whether or not the `strictValues` property is set.
 */
export class EntryHandlerInvalidFallback implements IEntryHandler<boolean> {
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
    _key: any,
    _keys: any[],
    _depth: number,
  ): Promise<boolean> {
    return true;
  }

  public async handle(
    parsingContext: ParsingContext,
    _util: Util,
    _key: any,
    _keys: any[],
    _value: any,
    depth: number,
  ): Promise<any> {
    parsingContext.emittedStack[depth] = false;
  }
}
