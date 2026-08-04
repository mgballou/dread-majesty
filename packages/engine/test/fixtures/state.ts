import type { Content } from '@dm/content';
import { createState } from '../../src/state.ts';
import type { GameState } from '../../src/types.ts';

/**
 * A fresh state with every tier automated and nothing else filled.
 *
 * Only the `automate` post, deliberately. A quickened or swollen tier would move
 * every number in the worked example, and the example is the anchor test.
 */
export function appointed(content: Content): GameState {
  const state = createState(content);

  for (const tier of content.tiers) {
    const automator = tier.overseers.find((post) => post.effect.kind === 'automate');
    state.overseers[tier.id] = automator ? [automator.id] : [];
  }

  return state;
}
