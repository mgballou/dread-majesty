/**
 * Balance harness.
 *
 * Runs the engine headless with a scripted buying policy and reports how long the
 * milestones a player cares about actually take. This is how balance stops being a
 * guess. It is a script, not a test — it must never gate CI.
 *
 *   pnpm harness
 *
 * Slices are 1s rather than the live 100ms. Every cycle duration in the content is a
 * whole number of seconds, so completions stay exact and the run goes ten times
 * faster. If a sub-second cycle is ever added, drop this back to BASE_DT_MS.
 */
import type Decimal from 'break_eternity.js';
import { CURRENT, type Content } from '@dm/content';
import { apply } from '../src/intents.ts';
import { createState } from '../src/state.ts';
import { step } from '../src/step.ts';
import { maxAffordable } from '../src/cost.ts';
import { prestigeGain, productionPerSecond } from '../src/selectors.ts';
import type { GameState } from '../src/types.ts';

const DT_MS = 1000;
const SIMULATED_DAYS = 7;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const CHECKPOINTS = [
  ['15m', 15 * MINUTE],
  ['30m', 30 * MINUTE],
  ['1h', HOUR],
  ['2h', 2 * HOUR],
  ['4h', 4 * HOUR],
  ['8h', 8 * HOUR],
  ['12h', 12 * HOUR],
  ['1d', DAY],
  ['3d', 3 * DAY],
  ['7d', 7 * DAY],
] as const;

/**
 * Each second, buy one of every tier that is affordable, richest first.
 *
 * Not optimal play, but far closer to it than only ever buying the top tier — a real
 * player keeps stacking the cheap tiers while saving for the expensive ones.
 */
function decide(state: GameState, content: Content): void {
  for (const tier of content.tiers) {
    if (maxAffordable(state, content, tier.id) >= 1) {
      apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 });
    }
  }
}

function run(content: Content): void {
  const state = createState(content);
  const firstOwned = new Map<string, number>();
  const rows: string[] = [];
  let firstPrestigeMs: number | null = null;

  const totalMs = SIMULATED_DAYS * DAY;
  let elapsed = 0;
  let nextCheckpoint = 0;

  while (elapsed < totalMs) {
    step(state, content, DT_MS);
    elapsed += DT_MS;
    decide(state, content);

    for (const tier of content.tiers) {
      if (!firstOwned.has(tier.id) && state.gens[tier.id].owned.gte(1)) {
        firstOwned.set(tier.id, elapsed);
      }
    }
    if (firstPrestigeMs === null && prestigeGain(state, content).gte(1)) {
      firstPrestigeMs = elapsed;
    }

    const checkpoint = CHECKPOINTS[nextCheckpoint];
    if (checkpoint && elapsed >= checkpoint[1]) {
      rows.push(snapshot(state, content, checkpoint[0]));
      nextCheckpoint += 1;
    }
  }

  console.log(`\ncontent version: ${content.version}   simulated: ${SIMULATED_DAYS} days\n`);

  console.log('  first of each tier');
  for (const tier of [...content.tiers].reverse()) {
    const at = firstOwned.get(tier.id);
    console.log(`    ${tier.plural.padEnd(14)} ${at === undefined ? 'never' : duration(at)}`);
  }
  console.log(
    `    ${'first prestige'.padEnd(14)} ${firstPrestigeMs === null ? 'never' : duration(firstPrestigeMs)}`,
  );

  console.log(`\n  ${'at'.padEnd(5)}${header(content)}`);
  for (const row of rows) console.log(`  ${row}`);
  console.log();
}

function header(content: Content): string {
  const tiers = [...content.tiers]
    .reverse()
    .map((tier) => tier.plural.slice(0, 9).padStart(10))
    .join('');
  return `${'evil/s'.padStart(12)}${tiers}${'lifetime'.padStart(11)}${'souls'.padStart(9)}`;
}

function snapshot(state: GameState, content: Content, label: string): string {
  const counts = [...content.tiers]
    .reverse()
    .map((tier) => short(state.gens[tier.id].owned).padStart(10))
    .join('');
  return (
    label.padEnd(5) +
    short(productionPerSecond(state, content, 'evil')).padStart(12) +
    counts +
    short(state.lifetimeEvil).padStart(11) +
    short(prestigeGain(state, content)).padStart(9)
  );
}

function short(value: Decimal): string {
  return value.lt(1e6) ? value.floor().toString() : value.toExponential(1).replace('e+', 'e');
}

function duration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return d > 0
    ? `${d}d ${h}h ${m}m`
    : `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

run(CURRENT);
