import Decimal from 'break_eternity.js';
import type { Content } from '@dm/content';
import type { GameState } from '@dm/engine';

/**
 * How far along the road to the first soul the prestige panel starts showing.
 *
 * A quarter. Late enough that a player in their first half hour is not being sold a
 * reset they cannot take and would not understand, early enough that the panel
 * arrives well before the button lights up, so the mechanic is read about before it
 * is offered.
 */
const SHOW_FROM = 0.25;

/**
 * Whether Damned Souls are worth putting on screen yet.
 *
 * A display threshold, not a rule of the game: nothing here changes what the engine
 * does, and hiding the panel does not stop lifetime Evil accruing toward the first
 * soul. It exists because an opening screen carrying a currency at zero, with no
 * route to earning any, teaches nothing and costs attention.
 */
export function isPrestigeWorthShowing(state: GameState, content: Content): boolean {
  if (state.souls.gt(0) || state.stats.prestiges > 0) return true;

  // Lifetime Evil at which the formula first pays out one soul: souls = k *
  // ((lifetime/scale)^exponent - 1), solved for lifetime at souls = 1. Every constant
  // comes from `content.prestige` rather than a hardcoded shape, matching
  // `lifetimeForSouls` in `apps/web/src/dev/jumps.ts` — a fixed square root here once
  // quoted a lifetime Evil the live formula no longer agreed with.
  const { k, scale, exponent } = content.prestige;
  const firstSoul = new Decimal(scale).mul(
    new Decimal(1)
      .div(k)
      .add(1)
      .pow(1 / exponent),
  );

  return state.lifetimeEvil.gte(firstSoul.mul(SHOW_FROM));
}
