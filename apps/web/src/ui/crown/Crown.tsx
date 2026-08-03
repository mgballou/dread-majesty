import type { ReactNode } from 'react';
import type { Content, Copy } from '@dm/content';
import { globalMultiplier, overseenProductionPerSecond, smitePhase } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { formatNumber } from '../format.ts';
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
      {/* One line, two facts. The countdown lives here rather than on the control,
          because this line has nothing to its right to push about when it changes. */}
      <p className="crown__rate">
        {formatNumber(rate)} {copy.evil.name} per second
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
 * `ready` and a countdown, never a label whose width depends on the number. The
 * control beside it holds a five-character verb and does not move.
 */
function standing(
  phase: ReturnType<typeof smitePhase>,
  copy: Copy['smite'],
  content: Content,
): string {
  if (phase.kind === 'ready') return copy.ready;

  const left = phase.kind === 'active' ? content.smite.durationMs : content.smite.cooldownMs;
  return copy.until(`${Math.max(0, Math.ceil((phase.share * left) / 1000))}s`);
}
