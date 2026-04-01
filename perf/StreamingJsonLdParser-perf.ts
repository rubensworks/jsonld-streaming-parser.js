/* eslint-disable unicorn/filename-case, import/no-nodejs-modules */
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import { JsonLdParser } from '../index';

const fileName = path.resolve(process.cwd(), process.argv[2]);
const TIMER = `Parsing file ${fileName}`;

// eslint-disable-next-line no-console
console.time(TIMER);

let count = 0;
const parsed = createReadStream(fileName).pipe(new JsonLdParser({ baseIRI: 'http://example.org/' }));
parsed.on('data', (_quad) => {
  count++;
});
parsed.on('error', (e) => {
  throw e;
});
parsed.on('end', () => {
  // eslint-disable-next-line no-console
  console.timeEnd(TIMER);
  // eslint-disable-next-line no-console
  console.log(`* Quads parsed: ${count}`);
  // eslint-disable-next-line no-console
  console.log(`* Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
});
