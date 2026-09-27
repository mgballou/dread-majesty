/**
 * Writes `CURRENT` to a JSON file: `JSON.stringify(CURRENT)`, nothing added.
 * The backstage's `script:import-v1` reads this shape.
 *
 * usage: pnpm export:current [path]   (default: packages/content/dist/current.json)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT } from '../src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
const outPath =
  arg === undefined
    ? resolve(HERE, '..', 'dist', 'current.json')
    : resolve(process.env['INIT_CWD'] ?? process.cwd(), arg);

const json = JSON.stringify(CURRENT);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
console.log(`${outPath}: ${Buffer.byteLength(json)} bytes`);
