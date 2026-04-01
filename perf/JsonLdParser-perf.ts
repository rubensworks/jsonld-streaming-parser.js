/* eslint-disable unicorn/filename-case, import/no-nodejs-modules */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

// eslint-disable-next-line ts/no-unsafe-assignment, ts/no-require-imports, ts/no-var-requires
const jsonld = require('jsonld');

const fileName = path.resolve(process.cwd(), process.argv[2]);
const TIMER = `Parsing file ${fileName}`;

// eslint-disable-next-line no-console
console.time(TIMER);

jsonld.promises.toRDF(JSON.parse(readFileSync(fileName, 'utf-8')), { base: 'http://example.org/' })
  .then((plainQuads: any[]) => {
    // eslint-disable-next-line no-console
    console.timeEnd(TIMER);
    // eslint-disable-next-line no-console
    console.log(`* Quads parsed: ${plainQuads.length}`);
    // eslint-disable-next-line no-console
    console.log(`* Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  })
  .catch((e: Error) => {
    // TOD
    // eslint-disable-next-line no-console
    console.log((<any> e).details);
    throw e;
  });
