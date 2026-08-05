import { useId, type ReactNode } from 'react';
import type { Content, SmiteUnit, SmiteUpgradeDef, SmiteUpgradeId, MaliceCopy } from '@dm/content';
import { canClimb, canKeep, climbCost, keepCost, smiteValueAt, type GameState } from '@dm/engine';
import { formatNumber } from '../format.ts';
import { spendEmphasis, type RailPlan, type SpendEmphasis } from '../rail/railPlan.ts';
import '../controls.css';
import './Malice.css';

interface MaliceProps {
  content: Content;
  /** Read-only here, as everywhere outside the engine. */
  state: GameState;
  /** Ranked spends. Only the climbs are read. */
  plan: RailPlan;
  onClimb: (upgradeId: SmiteUpgradeId) => void;
  onKeep: (upgradeId: SmiteUpgradeId) => void;
  copy: MaliceCopy;
}

/**
 * Four ladders, climbed with Evil and locked with souls.
 *
 * **Every ladder shows, always, at every rung.** Four rows fix the panel's height for
 * the whole game, so nothing here moves — the same argument the miscreants panel makes
 * about its wall of empty posts.
 *
 * **Climb is the row's action; Keep sits beside it at secondary weight.** One accent per
 * region, and this panel spends it on the best climb. Keep can never lift: it is a
 * second-order decision about a rung you already own, and a panel with eight equal
 * buttons is the thing the interface rules exist to prevent.
 *
 * Souls can never advance a ladder. `canKeep` refuses a rung that has not been climbed
 * with Evil in this run, so the rule lives in the engine and this panel only draws it.
 */
export function Malice({ content, state, plan, onClimb, onKeep, copy }: MaliceProps): ReactNode {
  return (
    <ul className="malice">
      {content.smite.upgrades.map((upgrade) => (
        <Rung
          key={upgrade.id}
          upgrade={upgrade}
          state={state}
          content={content}
          emphasis={spendEmphasis(plan, 'climb', upgrade.id)}
          onClimb={() => onClimb(upgrade.id)}
          onKeep={() => onKeep(upgrade.id)}
          copy={copy}
        />
      ))}
    </ul>
  );
}

interface RungProps {
  upgrade: SmiteUpgradeDef;
  state: GameState;
  content: Content;
  emphasis: SpendEmphasis;
  onClimb: () => void;
  onKeep: () => void;
  copy: MaliceCopy;
}

function Rung({ upgrade, state, content, emphasis, onClimb, onKeep, copy }: RungProps): ReactNode {
  const rung = state.smiteRungs[upgrade.id];
  const top = upgrade.rungs.length;
  const climb = climbCost(state, content, upgrade.id);
  const keep = keepCost(state, content, upgrade.id);
  const keepable = canKeep(state, content, upgrade.id);

  const now = reads(smiteValueAt(content, upgrade.id, rung), upgrade.unit);
  const next = reads(smiteValueAt(content, upgrade.id, rung + 1), upgrade.unit);

  const id = useId();
  const nameId = `${id}-name`;
  const climbId = `${id}-climb`;
  const keepId = `${id}-keep`;

  return (
    <li className={`malice__rung malice__rung--${emphasis}`}>
      <span className="malice__body">
        <span className="malice__name" id={nameId}>
          {copy.names[upgrade.id]}
        </span>
        <span className="malice__note">{copy.notes[upgrade.id]}</span>
        <span className="malice__step">{climb === null ? now : copy.step({ now, next })}</span>
      </span>

      <span className="malice__standing">
        <span className="malice__at">
          {climb === null ? copy.maxed : copy.rung({ at: String(rung), of: String(top) })}
        </span>
        {state.smiteKept[upgrade.id] >= rung && rung > 0 && (
          <span className="malice__at">{copy.held}</span>
        )}
      </span>

      <span className="malice__actions">
        <button
          type="button"
          id={climbId}
          className={`button${emphasis === 'best' ? ' button--primary' : ''}`}
          aria-labelledby={`${climbId} ${nameId}`}
          disabled={!canClimb(state, content, upgrade.id)}
          onClick={onClimb}
        >
          {copy.climb}
          <span className="malice__price">
            {climb === null ? null : copy.climbCost(formatNumber(climb))}
          </span>
        </button>

        <button
          type="button"
          id={keepId}
          className="button button--quiet"
          aria-labelledby={`${keepId} ${nameId}`}
          disabled={!keepable}
          onClick={onKeep}
        >
          {copy.keep}
          <span className="malice__price">
            {keep === null ? null : copy.keepCost(formatNumber(keep))}
          </span>
        </button>
      </span>

      {emphasis === 'best' && <span className="malice__lifted">{copy.lifted}</span>}
    </li>
  );
}

/**
 * A ladder's value in its own units.
 *
 * The unit is data on the content, not a guess made here from the id. Three formats
 * because three is what the four ladders need: two of them are durations, one is a
 * multiplier and one is a bare amount subtracted from a multiplier.
 *
 * `formatNumber` is not used and should not be: it is the shared formatter for
 * `Decimal` magnitudes, and every one of these is a small display number with a unit.
 * The Evil and soul prices on this row do go through it.
 */
function reads(value: number, unit: SmiteUnit): string {
  switch (unit) {
    case 'seconds':
      return `${Math.round(value / 1000)}s`;
    case 'multiplier':
      return `×${value.toFixed(2)}`;
    case 'amount':
      return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
}
