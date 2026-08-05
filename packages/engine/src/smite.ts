import Decimal from 'break_eternity.js';
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

/**
 * What the next blow would multiply production by, at the Apathy standing now.
 *
 * **Floored at 1.** A blow that made things worse would be a trap, and the floor means
 * a player who has not worked the system out can only ever waste taps rather than lose
 * ground. It also means a content edit cannot accidentally invert the verb.
 */
export function nextBlowMultiplier(state: GameState, content: Content): number {
  const raw = smiteWeight(state, content) - smiteStep(state, content) * state.smiteApathy;
  return Math.max(1, raw);
}

/** The rung a ladder would climb to next, or undefined at the top of it. */
function nextRung(state: GameState, content: Content, id: SmiteUpgradeId) {
  return ladder(content, id)?.rungs[state.smiteRungs[id]];
}

/** The rung a ladder's floor would rise to next, or undefined at the top of it. */
function nextFloor(state: GameState, content: Content, id: SmiteUpgradeId) {
  return ladder(content, id)?.rungs[state.smiteKept[id]];
}

/** Evil to climb one rung. Null at the top of the ladder. */
export function climbCost(state: GameState, content: Content, id: SmiteUpgradeId): Decimal | null {
  const rung = nextRung(state, content, id);
  return rung ? new Decimal(rung.evil) : null;
}

/** Souls to raise the floor one rung. Null at the top of the ladder. */
export function keepCost(state: GameState, content: Content, id: SmiteUpgradeId): Decimal | null {
  const rung = nextFloor(state, content, id);
  return rung ? new Decimal(rung.souls) : null;
}

export function canClimb(state: GameState, content: Content, id: SmiteUpgradeId): boolean {
  const cost = climbCost(state, content, id);
  return cost !== null && state.resources.evil.gte(cost);
}

/**
 * Whether the floor can rise.
 *
 * Souls can never advance a ladder: the rung has to have been climbed with Evil in this
 * run first. That is the whole of the "climb with Evil, keep with souls" rule, and it
 * lives here so no caller has to remember it.
 */
export function canKeep(state: GameState, content: Content, id: SmiteUpgradeId): boolean {
  if (state.smiteKept[id] >= state.smiteRungs[id]) return false;

  const cost = keepCost(state, content, id);
  return cost !== null && state.souls.gte(cost);
}

/**
 * The average production multiplier a player striking on every cooldown would hold.
 *
 * The shop ranks by the gain in this per Evil spent (spec §5.2). The cooldown's rhythm
 * is an assumption, and a stated one — a player who paces their blows instead gets a
 * different answer, and the panel does not know which they are. It is the assumption a
 * majority will match, and a defined number beats a hand-waved "best".
 *
 * Pass `bump` to ask what the figure would read with one more rung of that ladder. At
 * the top of a ladder `smiteValueAt` clamps, so a bump there reports no gain at all,
 * which is the honest answer.
 */
export function smiteAverageMultiplier(
  state: GameState,
  content: Content,
  bump: SmiteUpgradeId | null,
): number {
  const at = (id: SmiteUpgradeId): number =>
    smiteValueAt(content, id, state.smiteRungs[id] + (bump === id ? 1 : 0));

  const cooldownMs = content.smite.cooldownMs;
  const uptime = Math.min(1, at('reach') / cooldownMs);
  // Where Apathy settles for somebody striking on every cooldown. A blow adds
  // `perBlow` and `cooldownMs / bleedMs` of a point bleeds away before the next one —
  // so Apathy only piles up to the cap when a blow adds at least as much as the wait
  // gives back. Below that it bleeds faster than it accrues and settles at nothing,
  // and the naive `cap - P/bleed` would read a fatigue the player never feels.
  const bledPerCycle = cooldownMs / at('forgetting');
  const settled =
    content.smite.apathy.perBlow >= bledPerCycle
      ? Math.max(0, content.smite.apathy.cap - bledPerCycle)
      : 0;
  const blow = Math.max(1, at('weight') - at('restraint') * settled);

  return uptime * blow + (1 - uptime);
}
