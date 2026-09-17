import Decimal from 'break_eternity.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catchUp, deserialize, serialize } from '../src/index.ts';
import type { Content } from '@dm/content';
import type { SaveBlob } from '../src/save.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

interface VectorEntry {
  label: string;
  kind: 'exact' | 'toleranced';
  tolerance: string | null;
  startState: SaveBlob;
  elapsedMs: number;
  expected: {
    endState: SaveBlob;
    produced: Record<string, string>;
  };
}

interface VectorFile {
  version: string;
  chain: Content;
  vectors: VectorEntry[];
}

export interface Failure {
  label: string;
  errors: string[];
}

export interface VerifyResult {
  total: number;
  passed: number;
  failures: Failure[];
}

function compareDecimal(
  path: string,
  actual: string,
  expected: string,
  tolerance: number | null,
): string | null {
  if (tolerance === null) {
    return actual !== expected ? `${path}: expected "${expected}", got "${actual}"` : null;
  }
  const da = new Decimal(actual);
  const de = new Decimal(expected);
  if (de.eq(0)) {
    return da.eq(0) ? null : `${path}: expected 0, got "${actual}"`;
  }
  const relError = da.sub(de).abs().div(de.abs()).toNumber();
  return relError > tolerance
    ? `${path}: relative error ${relError.toExponential(3)} exceeds ${tolerance}`
    : null;
}

function compareBlobs(actual: SaveBlob, expected: SaveBlob, tolerance: number | null): string[] {
  const errors: string[] = [];
  const add = (e: string | null): void => {
    if (e) errors.push(e);
  };

  for (const key of Object.keys(expected.resources)) {
    add(
      compareDecimal(
        `resources.${key}`,
        actual.resources[key] ?? '0',
        expected.resources[key] ?? '0',
        tolerance,
      ),
    );
  }

  for (const key of Object.keys(expected.gens)) {
    const a = actual.gens[key];
    const e = expected.gens[key];
    if (!a || !e) continue;
    add(compareDecimal(`gens.${key}.owned`, a.owned, e.owned, tolerance));
    add(
      compareDecimal(
        `gens.${key}.lifetimeProduced`,
        a.lifetimeProduced,
        e.lifetimeProduced,
        tolerance,
      ),
    );
    if (e.purchased !== undefined) {
      add(compareDecimal(`gens.${key}.purchased`, a.purchased ?? '0', e.purchased, tolerance));
    }
    if (a.progressMs !== e.progressMs) {
      errors.push(`gens.${key}.progressMs: expected ${e.progressMs}, got ${a.progressMs}`);
    }
    if (a.running !== e.running) {
      errors.push(`gens.${key}.running: expected ${String(e.running)}, got ${String(a.running)}`);
    }
  }

  add(compareDecimal('souls', actual.souls, expected.souls, tolerance));
  add(compareDecimal('lifetimeEvil', actual.lifetimeEvil, expected.lifetimeEvil, tolerance));
  if (expected.soulsSpent !== undefined) {
    add(compareDecimal('soulsSpent', actual.soulsSpent ?? '0', expected.soulsSpent, tolerance));
  }

  if (actual.stats.playTimeMs !== expected.stats.playTimeMs)
    errors.push(
      `stats.playTimeMs: expected ${expected.stats.playTimeMs}, got ${actual.stats.playTimeMs}`,
    );
  if (actual.stats.runMs !== expected.stats.runMs)
    errors.push(`stats.runMs: expected ${expected.stats.runMs}, got ${actual.stats.runMs}`);
  if (actual.stats.smites !== expected.stats.smites)
    errors.push(`stats.smites: expected ${expected.stats.smites}, got ${actual.stats.smites}`);
  if (actual.stats.prestiges !== expected.stats.prestiges)
    errors.push(
      `stats.prestiges: expected ${expected.stats.prestiges}, got ${actual.stats.prestiges}`,
    );

  if ((actual.smiteActiveMs ?? 0) !== (expected.smiteActiveMs ?? 0))
    errors.push(`smiteActiveMs: expected ${expected.smiteActiveMs}, got ${actual.smiteActiveMs}`);
  if ((actual.smiteCooldownMs ?? 0) !== (expected.smiteCooldownMs ?? 0))
    errors.push(
      `smiteCooldownMs: expected ${expected.smiteCooldownMs}, got ${actual.smiteCooldownMs}`,
    );

  return errors;
}

function compareProduced(
  actual: Record<string, string>,
  expected: Record<string, string>,
  tolerance: number | null,
): string[] {
  const errors: string[] = [];
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of allKeys) {
    const err = compareDecimal(
      `produced.${key}`,
      actual[key] ?? '0',
      expected[key] ?? '0',
      tolerance,
    );
    if (err) errors.push(err);
  }
  return errors;
}

export function verify(): VerifyResult {
  const path = resolve(HERE, 'vectors', 'v1.json');
  const raw = readFileSync(path, 'utf-8');
  const file: VectorFile = JSON.parse(raw) as VectorFile;
  const content = file.chain;

  const failures: Failure[] = [];
  let passed = 0;

  for (const vector of file.vectors) {
    const tolerance = vector.tolerance !== null ? parseFloat(vector.tolerance) : null;
    const state = deserialize(vector.startState);
    const report = catchUp(state, content, vector.elapsedMs);
    const actualEnd = serialize(state, 0);

    const actualProduced: Record<string, string> = {};
    for (const [id, amount] of Object.entries(report.produced)) {
      if (amount !== undefined) actualProduced[id] = amount.toString();
    }

    const errors: string[] = [
      ...compareBlobs(actualEnd, vector.expected.endState, tolerance),
      ...compareProduced(actualProduced, vector.expected.produced, tolerance),
    ];

    if (errors.length > 0) {
      failures.push({ label: vector.label, errors });
    } else {
      passed += 1;
    }
  }

  return { total: file.vectors.length, passed, failures };
}

if (process.argv[1]?.endsWith('verify.ts')) {
  const result = verify();
  console.log(
    `Verified ${result.total} vectors: ${result.passed} passed, ${result.failures.length} failed`,
  );
  for (const f of result.failures) {
    console.log(`\nFAILED: ${f.label}`);
    for (const e of f.errors) console.log(`  ${e}`);
  }
  if (result.failures.length > 0) process.exit(1);
}
