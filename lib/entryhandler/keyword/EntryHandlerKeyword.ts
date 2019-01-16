import {ParsingContext} from "../../ParsingContext";
import {Util} from "../../Util";
import {IEntryHandler} from "../IEntryHandler";

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

  public async validate(parsingContext: ParsingContext, util: Util, keys: any[], depth: number, inProperty: boolean)
    : Promise<boolean> {
    return false;
  }

  public async test(parsingContext: ParsingContext, util: Util, key: any, keys: any[], depth: number)
    : Promise<boolean> {
    return key === this.keyword;
  }

  public abstract handle(parsingContext: ParsingContext, util: Util, key: any, keys: any[], value: any, depth: number,
                         testResult: boolean): Promise<any>;

}
