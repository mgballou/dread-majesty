import Decimal from 'break_eternity.js';
import type { Content, OverseerDef, OverseerId, TierDef, TierId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * Who is watching what, and what that is worth.
 *
 * Every question about a tier's effective cycle or yield goes through here. `step`
 * calls both of the latter once per tier per slice — 36,000 times to catch up an
 * hour — so both walk a list of at most three and allocate nothing but the result.
 */
export function findOverseer(
  content: Content,
  overseerId: OverseerId,
): { tier: TierDef; post: OverseerDef } | undefined {
  for (const tier of content.tiers) {
    const post = tier.overseers.find((candidate) => candidate.id === overseerId);
    if (post) return { tier, post };
  }
  return undefined;
}

export function hasPost(state: GameState, tierId: TierId, overseerId: OverseerId): boolean {
  return state.overseers[tierId].includes(overseerId);
}

/** Whether this tier runs without being told. The only question `step` asks. */
export function hasAutomator(state: GameState, content: Content, tierId: TierId): boolean {
  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  if (!tier) return false;

  return tier.overseers.some(
    (post) => post.effect.kind === 'automate' && hasPost(state, tierId, post.id),
  );
}

/** The post that takes this tier off the player's hands, if the content defines one. */
export function automatorOf(tier: TierDef): OverseerDef | undefined {
  return tier.overseers.find((post) => post.effect.kind === 'automate');
}

/**
 * The cycle this tier actually runs on.
 *
 * A whole number of milliseconds, and content guarantees a whole number of seconds
 * (see the content test in `packages/content/test/generators.test.ts`). `Math.round`
 * is belt and braces against a factor that does not divide evenly — a fractional
 * cycle would make completions inexact, which is the one thing `step` cannot have.
 *
 * Takes `content` it does not read, matching every other query here — `tier` already
 * carries its own posts, but the signature stays uniform so a caller never has to
 * remember which of these needs the whole content and which does not.
 */
export function effectiveCycleMs(state: GameState, _content: Content, tier: TierDef): number {
  let factor = 1;
  for (const post of tier.overseers) {
    if (post.effect.kind !== 'quicken') continue;
    if (hasPost(state, tier.id, post.id)) factor *= post.effect.factor;
  }
  return Math.max(1, Math.round(tier.cycleMs / factor));
}

export function effectiveYield(state: GameState, _content: Content, tier: TierDef): Decimal {
  let amount = new Decimal(tier.yield);
  for (const post of tier.overseers) {
    if (post.effect.kind !== 'swell') continue;
    if (hasPost(state, tier.id, post.id)) amount = amount.mul(post.effect.factor);
  }
  return amount;
}
