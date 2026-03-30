import { readFileSync } from 'node:fs';
import * as path from 'node:path';

// Tslint:disable-next-line:no-var-requires
const jsonld = require('jsonld');

const fileName = path.resolve(process.cwd(), process.argv[2]);
const TIMER = `Parsing file ${fileName}`;

// Tslint:disable:no-console
console.time(TIMER);

jsonld.promises.toRDF(JSON.parse(readFileSync(fileName, 'utf-8')), { base: 'http://example.org/' })
  .then((plainQuads: any[]) => {
    console.timeEnd(TIMER);
    console.log(`* Quads parsed: ${plainQuads.length}`);
    console.log(`* Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  })
  .catch((e: Error) => {
    console.log((<any> e).details); // TOD
    throw e;
  });
