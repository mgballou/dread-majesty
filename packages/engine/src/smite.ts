import type { Content, SmiteUpgradeDef, SmiteUpgradeId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * What each ladder reads at the rung the player stands on.
 *
 * Every question about a blow's weight, its length, how fast Apathy bleeds and what a
 * point of it costs goes through here. `step` calls `smiteBleedMs` once a slice —
 * 36,000 times to catch up an hour — so the walk is over four entries and allocates
 * nothing but the result.
 *
 * Selectors here take `(state, content)` and `(state, content, id)` positionally, which
 * matches every neighbouring selector in this package rather than the object-parameter
 * rule. See the plan's Task 3 note.
 */

function ladder(content: Content, id: SmiteUpgradeId): SmiteUpgradeDef | undefined {
  return content.smite.upgrades.find((upgrade) => upgrade.id === id);
}

/**
 * A ladder's value at an arbitrary rung, clamped to the ladder's own length.
 *
 * Exported because the ranking in the interface needs to ask what a rung the player has
 * not bought yet would read. Rung 0 and anything below it is the base; anything above
 * the top rung is the top rung, so asking for one past the end of a maxed ladder gives
 * the honest answer that nothing would change.
 */
export function smiteValueAt(content: Content, id: SmiteUpgradeId, rung: number): number {
  const upgrade = ladder(content, id);
  if (!upgrade) return 0;
  if (rung <= 0) return upgrade.base;

  const index = Math.min(rung, upgrade.rungs.length) - 1;
  return upgrade.rungs[index]?.value ?? upgrade.base;
}

function valueNow(state: GameState, content: Content, id: SmiteUpgradeId): number {
  return smiteValueAt(content, id, state.smiteRungs[id]);
}

/** What a blow multiplies production by at zero Apathy. */
export function smiteWeight(state: GameState, content: Content): number {
  return valueNow(state, content, 'weight');
}

/** How long a blow holds. */
export function smiteDurationMs(state: GameState, content: Content): number {
  return valueNow(state, content, 'reach');
}

/** How long one whole point of Apathy takes to bleed away. */
export function smiteBleedMs(state: GameState, content: Content): number {
  return valueNow(state, content, 'forgetting');
}

/** What one point of Apathy takes off a blow. */
export function smiteStep(state: GameState, content: Content): number {
  return valueNow(state, content, 'restraint');
}
