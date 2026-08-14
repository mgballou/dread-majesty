import type { ReactNode } from 'react';
import type { Content, Copy } from '@dm/content';
import { globalMultiplier, overseenProductionPerSecond, smitePhase } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { formatNumber, formatWhole } from '../format.ts';
import './Crown.css';

interface CrownProps {
  state: GameState;
  content: Content;
  copy: Pick<Copy, 'evil' | 'prestige' | 'smite'>;
}

/**
 * The standing of the realm. A band, not a screen.
 *
 * **The total and the verb are not here.** Both moved onto the Evil node at the end of
 * the chain, where the thing you press is the thing you are pressing *for* — see
 * `EvilNode`. What is left is what the chain has no room to say: the rate the realm
 * produces without being asked, and what the last reset bought.
 *
 * The rate counts only the tiers that keep turning on their own, because a headline
 * figure that includes tiers nobody has roused is a number the player is not earning.
 *
 * No title and no description of the game — the player knows what they opened
 * (ui-sensibility §11).
 */
export function Crown({ state, content, copy }: CrownProps): ReactNode {
  const rate = overseenProductionPerSecond(state, content, 'evil');
  const multiplier = globalMultiplier(state, content);
  const smite = smitePhase(state, content);

  return (
    <header className="crown">
      {/* The figure and its label in their own span, so the surge can light the thing it
          actually changes. The standing beside it is a different fact and keeps its own
          color — lighting the whole line would say the whole line had changed. */}
      <p className="crown__rate">
        <span className="crown__figure" data-smite={smite.kind}>
          {formatWhole(rate)} {copy.evil.name} per second
        </span>
        <span className="crown__dot" aria-hidden="true" />
        <span className="crown__standing">{standing(smite, copy.smite, content)}</span>
      </p>

      {state.souls.gt(0) && (
        <p className="crown__souls">
          {formatNumber(state.souls)} {copy.prestige.name} · ×{formatNumber(multiplier)} to
          everything
        </p>
      )}
    </header>
  );
}

/**
 * What the blow is doing, said on the status line.
 *
 * Three states, not two. Running and cooling are both "not ready", and reading the
 * countdown off `share` without asking which one you are in says "til ready" through
 * the whole surge — which is the one moment it is emphatically not what is happening.
 *
 * Only the cooling state carries a number. While the surge runs the chain is burning
 * end to end, and that is a better clock than a digit.
 */
function standing(
  phase: ReturnType<typeof smitePhase>,
  copy: Copy['smite'],
  content: Content,
): string {
  if (phase.kind === 'ready') return copy.ready;
  if (phase.kind === 'active') return copy.reigning;

  return copy.until(`${Math.max(0, Math.ceil((phase.share * content.smite.cooldownMs) / 1000))}s`);
}
