import Decimal from 'break_eternity.js';
import type { Content, ProducibleId } from '@dm/content';
import { BASE_DT_MS, step } from './step.ts';
import type { GameState, OfflineReport } from './types.ts';

const HOUR_MS = 60 * 60 * 1000;

/** Beyond an hour away, slices widen. Cost drops tenfold; drift stays under 0.1%. */
export const COARSE_DT_MS = 1000;
export const COARSEN_ABOVE_MS = HOUR_MS;

/**
 * Catch up an absence.
 *
 * Calls the same `step` the live loop calls. There is no second simulation, no
 * aggregate shortcut and no closed form, so offline and online agree by
 * construction rather than by test.
 */
export function catchUp(state: GameState, content: Content, elapsedMs: number): OfflineReport {
  // A wall clock that moved backwards yields nothing rather than negative time.
  const clamped = Math.max(0, Math.floor(elapsedMs));
  const capped = Math.min(clamped, content.offlineCapMs);
  const coarsened = capped > COARSEN_ABOVE_MS;
  const dt = coarsened ? COARSE_DT_MS : BASE_DT_MS;

  const produced: Partial<Record<ProducibleId, Decimal>> = {};
  const whole = Math.floor(capped / dt);

  for (let i = 0; i < whole; i += 1) {
    accumulate(produced, step(state, content, dt));
  }

  const remainder = capped - whole * dt;
  if (remainder > 0) accumulate(produced, step(state, content, remainder));

  // Both clocks move by the same clamped span: the Evil and the generators an
  // absence produced are real regardless of who was watching, so the current run
  // genuinely lasted this long, the same as lifetime play time did. They part ways
  // only at `prestige`, which zeroes `runMs` and leaves `playTimeMs` alone — an
  // absence is not a reset.
  state.stats.playTimeMs += capped;
  state.stats.runMs += capped;

  return {
    elapsedMs: capped,
    capped: clamped > content.offlineCapMs,
    coarsened,
    produced,
  };
}

function accumulate(
  into: Partial<Record<ProducibleId, Decimal>>,
  report: { produced: Partial<Record<ProducibleId, Decimal>> },
): void {
  for (const [id, amount] of Object.entries(report.produced)) {
    if (amount === undefined) continue;
    const key = id as ProducibleId;
    into[key] = (into[key] ?? new Decimal(0)).add(amount);
  }
}
