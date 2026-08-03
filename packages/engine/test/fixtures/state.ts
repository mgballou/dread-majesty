import type { Content } from '@dm/content';
import { TIER_IDS } from '@dm/content';
import { createState } from '../../src/state.ts';
import type { GameState } from '../../src/types.ts';

/**
 * A fresh state with every Overseer already appointed.
 *
 * Every tier now begins manual and accrues no progress until somebody rouses it, so
 * a state straight out of `createState` produces nothing at all. The appointment
 * belongs here in the setup rather than in `createState`: the opening the game ships
 * is manual by design, and what these tests measure is the cascade, not the tapping.
 */
export function appointed(content: Content): GameState {
  const state = createState(content);
  for (const id of TIER_IDS) state.overseers[id] = true;
  return state;
}
