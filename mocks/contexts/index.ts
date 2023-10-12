/* istanbul ignore file */

import { IDocumentLoader, IJsonLdContext } from 'jsonld-context-parser';
import vc from './vc';

const allContexts = {
  "https://www.w3.org/2018/credentials/v1": vc,
}

export default allContexts;

export class MockedDocumentLoader implements IDocumentLoader {
  async load(url: string): Promise<IJsonLdContext> {
    if (!(url in allContexts)) {
      throw new Error(`URL [${url}] is not in the set of hard coded contexts`);
    }
    return allContexts[url];
  }
}
