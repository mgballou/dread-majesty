import Decimal from 'break_eternity.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import type { Content } from '@dm/content';
import {
  createState,
  cloneState,
  step,
  catchUp,
  serialize,
  apply,
  maxAffordable,
  canAppoint,
  isRousable,
  prestigeGain,
} from '../src/index.ts';
import type { GameState } from '../src/types.ts';
import type { SaveBlob } from '../src/save.ts';
import { conformanceFixture } from './fixture.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYER_ONE_THRESHOLD = 9e15;
const TOLERANCE = '1e-11';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function decide(state: GameState, content: Content): void {
  for (const tier of content.tiers) {
    if (maxAffordable(state, content, tier.id) >= 1) {
      apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 });
    }
  }

  const posts = content.tiers
    .flatMap((t) => t.overseers)
    .sort((a, b) => {
      const da = new Decimal(a.cost);
      const db = new Decimal(b.cost);
      if (da.gt(db)) return 1;
      if (da.lt(db)) return -1;
      return 0;
    });

  for (const post of posts) {
    if (canAppoint(state, content, post.id)) {
      apply(state, content, { kind: 'appoint', overseerId: post.id });
    }
  }

  for (const tier of content.tiers) {
    if (isRousable(state, content, tier.id)) {
      apply(state, content, { kind: 'rouse', tierId: tier.id });
    }
  }

  apply(state, content, { kind: 'record-achievements' });
  apply(state, content, { kind: 'record-unlocks' });
}

function runForward(state: GameState, content: Content, ms: number): void {
  const dt = 1000;
  const steps = Math.floor(ms / dt);
  for (let i = 0; i < steps; i += 1) {
    step(state, content, dt);
    decide(state, content);
  }
}

function hasLayerOne(blob: SaveBlob): boolean {
  const above = (s: string): boolean => new Decimal(s).gte(LAYER_ONE_THRESHOLD);

  for (const v of Object.values(blob.resources)) {
    if (v !== undefined && above(v)) return true;
  }
  for (const g of Object.values(blob.gens)) {
    if (g === undefined) continue;
    if (above(g.owned)) return true;
    if (above(g.lifetimeProduced)) return true;
    if (g.purchased !== undefined && above(g.purchased)) return true;
  }
  if (above(blob.souls)) return true;
  if (above(blob.lifetimeEvil)) return true;
  if (blob.soulsSpent !== undefined && above(blob.soulsSpent)) return true;
  return false;
}

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

function emitVector(
  label: string,
  state: GameState,
  content: Content,
  elapsedMs: number,
): VectorEntry {
  const startBlob = serialize(cloneState(state), 0);
  const report = catchUp(state, content, elapsedMs);
  const endBlob = serialize(state, 0);

  const produced: Record<string, string> = {};
  for (const [id, amount] of Object.entries(report.produced)) {
    if (amount !== undefined) produced[id] = amount.toString();
  }

  const crosses = hasLayerOne(startBlob) || hasLayerOne(endBlob);

  return {
    label,
    kind: crosses ? 'toleranced' : 'exact',
    tolerance: crosses ? TOLERANCE : null,
    startState: startBlob,
    elapsedMs,
    expected: { endState: endBlob, produced },
  };
}

function automatedState(content: Content): GameState {
  const state = createState(content);
  for (const tier of content.tiers) {
    const automator = tier.overseers.find((o) => o.effect.kind === 'automate');
    if (automator) state.overseers[tier.id] = [automator.id];
  }
  return state;
}

function syntheticState(
  content: Content,
  overrides: {
    evil?: string;
    minion?: string;
    warren?: string;
    minionProgress?: number;
  },
): GameState {
  const state = automatedState(content);
  if (overrides.evil !== undefined) {
    state.resources.evil = new Decimal(overrides.evil);
    state.lifetimeEvil = new Decimal(overrides.evil);
  }
  if (overrides.minion !== undefined) {
    state.gens.minion.owned = new Decimal(overrides.minion);
    state.gens.minion.purchased = new Decimal(overrides.minion);
  }
  if (overrides.warren !== undefined) {
    state.gens.warren.owned = new Decimal(overrides.warren);
    state.gens.warren.purchased = new Decimal(overrides.warren);
  }
  if (overrides.minionProgress !== undefined) {
    state.gens.minion.progressMs = overrides.minionProgress;
  }
  return state;
}

function emit(): void {
  const content = conformanceFixture;
  const vectors: VectorEntry[] = [];

  // 1. One cycle — simplest possible: 1 Minion about to complete a cycle.
  {
    const state = syntheticState(content, { minionProgress: 23900 });
    vectors.push(emitVector('one-cycle', state, content, 100));
  }

  // 2. Five minutes from a fresh automated state.
  {
    const state = automatedState(content);
    vectors.push(emitVector('five-minutes-fresh', state, content, 5 * MINUTE));
  }

  // 3. State built to 30m with the buy policy, then 1m offline.
  {
    const state = createState(content);
    runForward(state, content, 30 * MINUTE);
    vectors.push(emitVector('thirty-minute-then-one', state, content, MINUTE));
  }

  // 4. State built to 2h, then 1h offline.
  {
    const state = createState(content);
    runForward(state, content, 2 * HOUR);
    vectors.push(emitVector('two-hour-then-one', state, content, HOUR));
  }

  // 5. Just past the layer-1 threshold: Evil at 5e16, meaningful production.
  {
    const state = syntheticState(content, {
      evil: '5e16',
      minion: '1e12',
      warren: '1e8',
    });
    vectors.push(emitVector('layer-1-onset', state, content, 4 * HOUR));
  }

  // 6. Deep in log-space: every value far above the threshold.
  {
    const state = syntheticState(content, {
      evil: '1e100',
      minion: '1e80',
      warren: '1e60',
    });
    vectors.push(emitVector('deep-log-space', state, content, 4 * HOUR));
  }

  // 7. Post-prestige — soul multiplier active, values still small.
  {
    const state = createState(content);
    runForward(state, content, HOUR);
    if (prestigeGain(state, content).gt(0)) {
      apply(state, content, { kind: 'prestige' });
    }
    vectors.push(emitVector('post-prestige', state, content, HOUR));
  }

  // 8. Edge: Evil just under 9e15, stays layer 0 after one cycle.
  {
    const state = syntheticState(content, {
      evil: '8.999e15',
      minionProgress: 23900,
    });
    vectors.push(emitVector('edge-exact', state, content, 100));
  }

  // 9. Edge: Evil at 9e15, first layer-1 value.
  {
    const state = syntheticState(content, {
      evil: '9e15',
      minionProgress: 23900,
    });
    vectors.push(emitVector('edge-toleranced', state, content, 100));
  }

  // 10. Intermediate log-space.
  {
    const state = syntheticState(content, {
      evil: '1e30',
      minion: '1e20',
      warren: '1e12',
    });
    vectors.push(emitVector('intermediate-log-space', state, content, 4 * HOUR));
  }

  const commit = execSync('git rev-parse --short HEAD', {
    cwd: resolve(HERE, '../../../'),
    encoding: 'utf-8',
  }).trim();

  const vectorFile = {
    version: '1',
    emittedAt: new Date().toISOString(),
    engineCommit: commit,
    chain: content,
    vectors,
  };

  const outDir = resolve(HERE, 'vectors');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'v1.json');
  writeFileSync(outPath, JSON.stringify(vectorFile, null, 2) + '\n');

  const exact = vectors.filter((v) => v.kind === 'exact').length;
  const toleranced = vectors.filter((v) => v.kind === 'toleranced').length;

  let maxMag = 0;
  for (const v of vectors) {
    const n = new Decimal(v.expected.endState.lifetimeEvil).log10().toNumber();
    if (n > maxMag) maxMag = n;
  }

  console.log(`Wrote ${vectors.length} vectors to ${outPath}`);
  console.log(`  exact: ${exact}  toleranced: ${toleranced}`);
  console.log(`  largest magnitude: ~1e${Math.floor(maxMag)}`);
  for (const v of vectors) {
    console.log(`  ${v.kind.padEnd(12)} ${v.label}`);
  }
}

emit();
