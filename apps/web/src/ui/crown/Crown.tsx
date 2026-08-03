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
  /** True while nothing on the rail is worth buying, which is when smiting is the move. */
  smiteIsTheAction: boolean;
  onSmite: () => void;
}

/**
 * The standing of the realm, and the tap verb — which are now the same control.
 *
 * **The Evil total is the button.** A separate control beside it was a phone-sized
 * mistake: the largest, most-looked-at thing on the screen sat inert while the thing
 * you had to hit was a 36px target in the corner. Striking the total is also simply
 * what the verb means.
 *
 * Its accessible name carries the figure as well as the verb, because otherwise the
 * total stops being readable to anyone who cannot see it (`copy.smite.spoken`).
 *
 * The strike wears the accent only while nothing on the rail can be bought. One
 * primary action per screen, always, and always the right one: in the opening minutes
 * that is smiting, and from the first affordable purchase onward it is the rail's.
 *
 * No title and no description of the game — the player knows what they opened
 * (ui-sensibility §11). What sits here is the material: how much Evil, how fast it
 * arrives on its own, and what the last blow came to.
 */
export function Crown({ state, content, copy, smiteIsTheAction, onSmite }: CrownProps): ReactNode {
  // Only what runs by itself. A headline rate that counts tiers nobody has roused
  // is a number the player is not actually earning. See the selector.
  const rate = overseenProductionPerSecond(state, content, 'evil');
  const multiplier = globalMultiplier(state, content);
  const evil = formatNumber(state.resources.evil);

  return (
    <header className="crown">
      <button
        type="button"
        className={smiteIsTheAction ? 'crown__strike crown__strike--lifted' : 'crown__strike'}
        onClick={onSmite}
        aria-label={copy.smite.spoken(evil)}
        title={copy.smite.hint}
      >
        <span className="crown__evil">{evil}</span>
        <span className="crown__verb">{copy.smite.action}</span>
      </button>

      <p className="crown__rate">
        {formatNumber(rate)} {copy.evil.name} per second
      </p>

      {/* Held open whether or not there is a report, so a blow does not move the page. */}
      <p className="crown__report">{report(state, copy.smite.results)}</p>

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
 * What the last blow came to.
 *
 * Chosen by the smite count rather than at random: the engine forbids `Math.random`
 * and there is no reason for the interface to hold a different standard. Cycling also
 * means a player who taps ten times sees ten different lines rather than the same one
 * twice by chance.
 */
function report(state: GameState, results: readonly string[]): string {
  if (state.stats.smites === 0 || results.length === 0) return '';
  return results[(state.stats.smites - 1) % results.length] ?? '';
}
