import type { ReactNode } from 'react';
import type { Content, Copy } from '@dm/content';
import { globalMultiplier, overseenProductionPerSecond } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { formatNumber } from '../format.ts';
import './Crown.css';

interface CrownProps {
  state: GameState;
  content: Content;
  copy: Pick<Copy, 'evil' | 'smite' | 'prestige'>;
  /** True while nothing on the rail is affordable, which is when smiting is the move. */
  smiteIsTheAction: boolean;
  onSmite: () => void;
}

/**
 * The standing of the realm, and the tap verb.
 *
 * No title and no description of the game — the player knows what they opened
 * (ui-sensibility §11). What sits here is the material: how much Evil, how fast it
 * arrives, and what the last reset bought.
 *
 * Smite wears the accent only while nothing on the rail can be bought. One primary
 * action per screen, always, and always the right one: in the opening minutes that
 * is smiting, and from the first affordable Minion onward it is the purchase.
 */
export function Crown({ state, content, copy, smiteIsTheAction, onSmite }: CrownProps): ReactNode {
  // Only what runs by itself. A headline rate that counts tiers nobody has roused
  // is a number the player is not actually earning. See the selector.
  const rate = overseenProductionPerSecond(state, content, 'evil');
  const multiplier = globalMultiplier(state, content);

  return (
    <header className="crown">
      <div className="crown__standing">
        <p
          className="crown__evil"
          aria-label={`${formatNumber(state.resources.evil)} ${copy.evil.name}`}
        >
          {formatNumber(state.resources.evil)}
        </p>
        <p className="crown__rate">
          {formatNumber(rate)} {copy.evil.name} per second
        </p>
      </div>

      <div className="crown__aside">
        {state.souls.gt(0) && (
          <p className="crown__souls">
            {formatNumber(state.souls)} {copy.prestige.name} · ×{formatNumber(multiplier)} to
            everything
          </p>
        )}
        <button
          type="button"
          className={smiteIsTheAction ? 'button button--primary' : 'button'}
          onClick={onSmite}
          title={copy.smite.hint}
        >
          {copy.smite.action}
        </button>
      </div>
    </header>
  );
}
