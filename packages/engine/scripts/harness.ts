/**
 * Balance harness.
 *
 * Runs the engine headless with a scripted buying policy and reports how long the
 * milestones a player cares about actually take. This is how balance stops being a
 * guess. It is a script, not a test — it must never gate CI.
 *
 *   pnpm harness
 */
import { CURRENT, type Content, type TierId } from '@dm/content';
import { BASE_DT_MS } from '../src/step.ts';
import { apply } from '../src/intents.ts';
import { createState } from '../src/state.ts';
import { step } from '../src/step.ts';
import { maxAffordable } from '../src/cost.ts';
import { prestigeGain } from '../src/selectors.ts';

const SIMULATED_DAYS = 3;
const DECIDE_EVERY_MS = 1000;

/** Buy one of the highest tier currently affordable. A player pushing up-chain. */
function decide(state: ReturnType<typeof createState>, content: Content): void {
  for (const tier of content.tiers) {
    if (maxAffordable(state, content, tier.id) >= 1) {
      apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 });
      return;
    }
  }
}

function run(content: Content): void {
  const state = createState(content);
  const firstOwned = new Map<TierId, number>();
  let firstPrestigeMs: number | null = null;

  const totalMs = SIMULATED_DAYS * 24 * 60 * 60 * 1000;
  let elapsed = 0;

  while (elapsed < totalMs) {
    step(state, content, BASE_DT_MS);
    elapsed += BASE_DT_MS;

    if (elapsed % DECIDE_EVERY_MS === 0) decide(state, content);

    for (const tier of content.tiers) {
      if (!firstOwned.has(tier.id) && state.gens[tier.id].owned.gte(1)) {
        firstOwned.set(tier.id, elapsed);
      }
    }
    if (firstPrestigeMs === null && prestigeGain(state, content).gte(1)) {
      firstPrestigeMs = elapsed;
    }
  }

  console.log(`\ncontent version: ${content.version}`);
  console.log(`simulated: ${SIMULATED_DAYS} days\n`);

  for (const tier of [...content.tiers].reverse()) {
    const at = firstOwned.get(tier.id);
    console.log(`  first ${tier.name.padEnd(12)} ${at === undefined ? 'never' : format(at)}`);
  }

  console.log(
    `\n  first prestige  ${firstPrestigeMs === null ? 'never' : format(firstPrestigeMs)}`,
  );
  console.log(`  souls available ${prestigeGain(state, content).toString()}`);
  console.log(`  lifetime evil   ${state.lifetimeEvil.toStringWithDecimalPlaces(2)}\n`);
}

function format(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

run(CURRENT);
