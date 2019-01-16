import {JsonLdParser} from "../index";
import {createReadStream} from "fs";
import * as path from "path";

const fileName = path.resolve(process.cwd(), process.argv[2]);
const TIMER = 'Parsing file ' + fileName;

// tslint:disable:no-console
console.time(TIMER);

let count = 0;
const parsed = createReadStream(fileName).pipe(new JsonLdParser({ baseIRI: 'http://example.org/' }));
parsed.on('data', (quad) => {
  count++;
});
parsed.on('error', (e) => {
  throw e;
});
parsed.on('end', () => {
  console.timeEnd(TIMER);
  console.log('* Quads parsed: ' + count);
  console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
});
