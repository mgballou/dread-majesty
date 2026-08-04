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
 *
 * The simulated player taps perfectly: every manual tier is roused the instant its
 * cycle frees, and an Overseer is appointed as soon as one is affordable. That is
 * deliberate (spec §5.6). The harness measures the idle economy, exactly as §5.2
 * tuned it; a harness that modelled imperfect tapping would be measuring a guess
 * about players rather than the economy. What it reports instead is *when* each
 * Overseer first comes within reach, and the manual layer is then priced by feel
 * against those times.
 */
import Decimal from 'break_eternity.js';
import { CURRENT, type Content, type OverseerId } from '@dm/content';
import { apply } from '../src/intents.ts';
import { hasPost } from '../src/roster.ts';
import { createState } from '../src/state.ts';
import { step } from '../src/step.ts';
import { maxAffordable } from '../src/cost.ts';
import { canAppoint, isRousable, prestigeGain, productionPerSecond } from '../src/selectors.ts';
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
 * Each second: buy, then appoint, then rouse.
 *
 * **Buying comes first, always.** The buying policy is the instrument's calibration
 * (spec §5.7) — every number in §5.2 is the output of it — so an Overseer may only
 * ever be paid for out of what the buying pass left behind. Reversing the order
 * would let appointments starve the generator stack and quietly re-tune the whole
 * economy. Overseers are then taken cheapest first, so the early ones land as soon
 * as they are within reach rather than waiting behind a Castellan.
 *
 * The buying pass itself is one of every tier that is affordable, richest first. Not
 * optimal play, but far closer to it than only ever buying the top tier — a real
 * player keeps stacking the cheap tiers while saving for the expensive ones.
 *
 * Rousing comes last because a tier bought or freed this second is then already
 * turning when the next slice runs. That is the perfect tapping the header explains.
 *
 * **All fifteen posts are in play, cheapest across the whole chain first** — not
 * cheapest within a tier, not tier order. An early automator lands as soon as it is
 * within reach rather than waiting behind a Castellan's quicken or swell. Buying
 * still comes first (see above): a post is only ever paid for out of the change the
 * generator stack left behind.
 */
function decide(state: GameState, content: Content): void {
  for (const tier of content.tiers) {
    if (maxAffordable(state, content, tier.id) >= 1) {
      apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 });
    }
  }

  const posts = content.tiers
    .flatMap((tier) => tier.overseers)
    .sort((one, other) => (new Decimal(one.cost).gt(new Decimal(other.cost)) ? 1 : -1));

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

  // The simulated player records progress at the same cadence the real one does.
  // Every shipping achievement grants a multiplier of 1, so this changes no number
  // in the table today — but the moment one of them grants more, a harness that
  // never recorded them would quietly report a slower game than the one shipped.
  apply(state, content, { kind: 'record-achievements' });
  apply(state, content, { kind: 'record-unlocks' });
}

function run(content: Content): void {
  const state = createState(content);
  // Lowest tier first, matching every other table in this report; the three posts
  // within a tier stay in content order (automate, then quicken, then swell).
  const posts = [...content.tiers]
    .reverse()
    .flatMap((tier) => tier.overseers.map((post) => ({ tier, post })));
  const firstOwned = new Map<string, number>();
  const overseerAffordableAt = new Map<OverseerId, number>();
  const overseerAppointedAt = new Map<OverseerId, number>();
  const rows: string[] = [];
  let firstPrestigeMs: number | null = null;

  const totalMs = SIMULATED_DAYS * DAY;
  let elapsed = 0;
  let nextCheckpoint = 0;

  while (elapsed < totalMs) {
    step(state, content, DT_MS);
    elapsed += DT_MS;

    // Read before the buying pass spends anything, so this answers "could the player
    // have appointed at this moment", not "was there change left afterwards".
    for (const { post } of posts) {
      if (!overseerAffordableAt.has(post.id) && canAppoint(state, content, post.id)) {
        overseerAffordableAt.set(post.id, elapsed);
      }
    }

    decide(state, content);

    for (const tier of content.tiers) {
      if (!firstOwned.has(tier.id) && state.gens[tier.id].owned.gte(1)) {
        firstOwned.set(tier.id, elapsed);
      }
    }
    for (const { tier, post } of posts) {
      if (!overseerAppointedAt.has(post.id) && hasPost(state, tier.id, post.id)) {
        overseerAppointedAt.set(post.id, elapsed);
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

  console.log('\n  overseers');
  for (const { post } of posts) {
    const affordable = overseerAffordableAt.get(post.id);
    const hired = overseerAppointedAt.get(post.id);
    console.log(
      `    ${post.name.padEnd(29)}` +
        `within reach ${(affordable === undefined ? 'never' : duration(affordable)).padEnd(14)}` +
        `appointed ${hired === undefined ? 'never' : duration(hired)}`,
    );
  }

  console.log(`\n  ${'at'.padEnd(5)}${header(content)}`);
  for (const row of rows) console.log(`  ${row}`);
  console.log(
    `\n  achievements earned: ${state.earnedAchievements.length} of ${content.achievements.length}`,
  );
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
