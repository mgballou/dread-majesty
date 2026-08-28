/**
 * Opening probe — the first two minutes, at the slice the browser actually runs.
 *
 *   pnpm opening
 *
 * The balance harness answers "how long does the economy take"; it runs at one-second
 * slices, taps perfectly and never smites, which is right for the economy and wrong for
 * the opening. This answers a smaller question: what a stranger does with their hands in
 * the first two minutes, and how long it is before the game gives them anything back.
 *
 * It runs at `BASE_DT_MS`, because a reaction gap shorter than a second is the whole
 * subject, and it reports three things per policy:
 *
 *   - time to first purchase, the same measurement `dread-majesty-opening-cost` took
 *   - taps to first purchase, counting every rouse and every blow
 *   - what the player is holding at second 0, 10 and 30
 *
 * Three kinds of player, not two. `no blow` has not found Smite; `blows` found it before the
 * game mentioned it; `told` strikes when the `strike` beat reaches the bar. That third row is
 * the only one that measures the opening *track* — the other two measure the economy at its
 * two ends and neither is a person following the instructions.
 *
 * It is a script, not a test, and must never gate CI.
 *
 * **The reaction gap is a policy, not a fact about the engine.** A player does not tap
 * on the frame the ring closes; they notice first. `REACTION_MS` is a stated assumption
 * — half a second, picked as an unhurried glance — and every "real" row below carries
 * it. Change it and every row moves together, which is the point of it being one
 * constant.
 */
import type { Content } from '@dm/content';
import { CURRENT } from '@dm/content';
import { apply } from '../src/intents.ts';
import { createState } from '../src/state.ts';
import type { GameState } from '../src/types.ts';
import { BASE_DT_MS, step } from '../src/step.ts';
import { canSmite, isRousable } from '../src/selectors.ts';

const SECOND = 1000;
const WINDOW_MS = 2 * 60 * SECOND;
const REACTION_MS = 500;
const SAMPLE_AT = [0, 10 * SECOND, 30 * SECOND];

/**
 * When the player strikes.
 *
 * `never` and `always` are the two ends and neither is a person: one has not found the verb,
 * the other found it before the game said a word. `told` is the row that measures the track
 * rather than the economy — it strikes on the condition the `strike` beat is ready on, a
 * completed Minion cycle, because that is the frame the beat reaches the bar. Read against
 * `always` it says what the opening's one instructive beat is worth; read against `never` it
 * says what a player who ignores it pays.
 */
type Blows = 'never' | 'told' | 'always';

interface Policy {
  readonly name: string;
  /** Milliseconds a rousable tier waits before the player notices and taps. */
  readonly reactionMs: number;
  readonly blows: Blows;
}

const POLICIES: readonly Policy[] = [
  { name: 'perfect tapping, no blow', reactionMs: 0, blows: 'never' },
  { name: 'perfect tapping, told', reactionMs: 0, blows: 'told' },
  { name: 'perfect tapping, blows', reactionMs: 0, blows: 'always' },
  { name: 'real tapping, no blow', reactionMs: REACTION_MS, blows: 'never' },
  { name: 'real tapping, told', reactionMs: REACTION_MS, blows: 'told' },
  { name: 'real tapping, blows', reactionMs: REACTION_MS, blows: 'always' },
];

/**
 * Whether this player would strike on this frame, before the reaction gap is applied.
 *
 * The `told` arm reads the beat's own `ready` condition off the state — `cycled`, which is
 * `lifetimeProduced > 0` — rather than importing it, because the beat conditions live in the
 * web app and the engine may not depend on it. It is duplicated in one line and named here so
 * a change to the beat has somewhere obvious to land.
 */
function wouldStrike(state: GameState, blows: Blows): boolean {
  switch (blows) {
    case 'never':
      return false;
    case 'always':
      return true;
    case 'told':
      return state.gens.minion.lifetimeProduced.gt(0);
  }
}

interface Reading {
  readonly policy: string;
  readonly firstPurchaseMs: number | null;
  readonly rouses: number;
  readonly blows: number;
  readonly samples: readonly { readonly atMs: number; readonly evil: string }[];
}

function run(content: Content, policy: Policy): Reading {
  const state = createState(content);
  const samples: { atMs: number; evil: string }[] = [];

  let elapsed = 0;
  let rouses = 0;
  let blows = 0;
  let firstPurchaseMs: number | null = null;
  // When the player's eyes get back to a tier that has finished. Null while it turns.
  let noticedAt: number | null = 0;
  // The same, for the blow. Null while the cooldown runs or the player has no reason to strike.
  let noticedBlow: number | null = null;
  let nextSample = 0;

  while (elapsed <= WINDOW_MS) {
    if (nextSample < SAMPLE_AT.length && elapsed >= (SAMPLE_AT[nextSample] ?? 0)) {
      samples.push({ atMs: SAMPLE_AT[nextSample] ?? 0, evil: state.resources.evil.toFixed(0) });
      nextSample += 1;
    }

    // Buying comes first, exactly as the harness orders it: the purchase is what this
    // whole probe is timing, and a rouse in the same slice must not be credited with it.
    if (firstPurchaseMs === null && state.gens.minion.purchased.lte(0)) {
      const bought = apply(state, content, { kind: 'purchase', tierId: 'minion', quantity: 1 });
      if (bought.ok) {
        // Break here, not at the foot of the loop: the counts below are "taps to first
        // purchase", and a rouse issued in the buying slice was never spent getting there.
        firstPurchaseMs = elapsed;
        break;
      }
    }

    // The blow carries the same reaction gap as the tap. A player who is told to strike does
    // not strike on the frame they are told, and the whole point of the `told` row is what the
    // instruction is worth to somebody reading it.
    if (wouldStrike(state, policy.blows) && canSmite(state)) {
      noticedBlow ??= elapsed + policy.reactionMs;
      if (elapsed >= noticedBlow) {
        const struck = apply(state, content, { kind: 'smite' });
        if (struck.ok) {
          blows += 1;
          noticedBlow = null;
        }
      }
    }

    if (isRousable(state, content, 'minion')) {
      noticedAt ??= elapsed + policy.reactionMs;
      if (elapsed >= noticedAt) {
        const roused = apply(state, content, { kind: 'rouse', tierId: 'minion' });
        if (roused.ok) {
          rouses += 1;
          noticedAt = null;
        }
      }
    }

    step(state, content, BASE_DT_MS);
    elapsed += BASE_DT_MS;
  }

  // The samples the loop broke before reaching. The purchase ends the measurement, not
  // the window, so a fast opening would otherwise report fewer readings than a slow one.
  while (nextSample < SAMPLE_AT.length) {
    const at = SAMPLE_AT[nextSample] ?? 0;
    while (elapsed < at) {
      step(state, content, BASE_DT_MS);
      elapsed += BASE_DT_MS;
      if (wouldStrike(state, policy.blows) && canSmite(state))
        apply(state, content, { kind: 'smite' });
      if (isRousable(state, content, 'minion'))
        apply(state, content, { kind: 'rouse', tierId: 'minion' });
    }
    samples.push({ atMs: at, evil: state.resources.evil.toFixed(0) });
    nextSample += 1;
  }

  return { policy: policy.name, firstPurchaseMs, rouses, blows, samples };
}

function clock(ms: number | null): string {
  if (ms === null) return '  never';
  return `${String(Math.floor(ms / SECOND)).padStart(4)}s`;
}

const readings = POLICIES.map((policy) => run(CURRENT, policy));

console.log(`\ncontent version: ${CURRENT.version}   window: 2m   slice: ${BASE_DT_MS}ms`);
console.log(`reaction gap on the "real" rows: ${REACTION_MS}ms\n`);
console.log('  opening                        first buy   rouses   blows   evil @0s  @10s  @30s');
for (const reading of readings) {
  const at = (index: number): string => (reading.samples[index]?.evil ?? '-').padStart(5);
  console.log(
    `  ${reading.policy.padEnd(28)} ${clock(reading.firstPurchaseMs)}   ` +
      `${String(reading.rouses).padStart(6)}  ${String(reading.blows).padStart(6)}   ` +
      `${at(0)} ${at(1)} ${at(2)}`,
  );
}
console.log('');
