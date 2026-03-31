/* istanbul ignore file */

import type { IDocumentLoader, IJsonLdContext } from 'jsonld-context-parser';
import vc from './vc';

const allContexts = {
  'https://www.w3.org/2018/credentials/v1': vc,
};

export default allContexts;

export class MockedDocumentLoader implements IDocumentLoader {
  public async load(url: string): Promise<IJsonLdContext> {
    if (!(url in allContexts)) {
      throw new Error(`URL [${url}] is not in the set of hard coded contexts`);
    }
    // eslint-disable-next-line ts/no-unsafe-return
    return allContexts[url];
  }
}
