import Decimal from 'break_eternity.js';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Content, PrestigeCopy } from '@dm/content';
import { msToNextSoul, prestigeGain, type GameState } from '@dm/engine';
import { Panel } from '../Panel.tsx';
import { formatCount, formatDuration, formatNumber } from '../format.ts';
import '../controls.css';
import './PrestigePanel.css';

interface PrestigePanelProps {
  content: Content;
  /** Read-only here, as everywhere outside the engine. */
  state: GameState;
  version: number;
  onPrestige: () => void;
  copy: PrestigeCopy;
}

/**
 * Damned Souls: what the run is worth if you end it now.
 *
 * A reset is irreversible, so it is confirmed, and the claim never wears the accent
 * — destructive weight, never primary, never the default (ui-sensibility §3). The
 * confirmation is the platform's own `<dialog>`, which supplies focus handling and
 * dismissal that a hand-rolled overlay gets wrong (§13). The way out is listed first,
 * so the destructive choice is not the one focus lands on.
 */
export function PrestigePanel({
  content,
  state,
  version,
  onPrestige,
  copy,
}: PrestigePanelProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const { gain, multiplier, waitMs } = useMemo(
    () => ({
      gain: prestigeGain(state, content),
      multiplier: new Decimal(1).add(state.souls.mul(content.prestige.perSoul)),
      waitMs: msToNextSoul(state, content),
    }),
    [state, content, version],
  );

  const owed = gain.gt(0);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (confirming) showDialog(node);
    else hideDialog(node);
  }, [confirming]);

  const claim = (): void => {
    setConfirming(false);
    onPrestige();
  };

  return (
    <Panel title={copy.name} glyph="✧" trailing={formatCount(state.souls)}>
      <dl className="prestige__figures">
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.held}</dt>
          <dd className="prestige__value">{formatCount(state.souls)}</dd>
        </div>
        <div className="prestige__figure">
          <dt className="prestige__term">
            {copy.favour(`${formatNumber(new Decimal(content.prestige.perSoul).mul(100))}%`)}
          </dt>
          <dd className="prestige__value">×{formatNumber(multiplier)}</dd>
        </div>
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.reckoning}</dt>
          <dd className="prestige__value">{formatCount(gain)}</dd>
        </div>
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.runLength}</dt>
          <dd className="prestige__value">{formatDuration(state.stats.runMs)}</dd>
        </div>
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.nextSoul}</dt>
          <dd className="prestige__value">
            {waitMs === null ? copy.nextSoulUnknown : formatDuration(waitMs)}
          </dd>
        </div>
      </dl>

      <div className="prestige__ledger">
        <section className="prestige__column">
          <h3 className="prestige__heading">{copy.clearsTitle}</h3>
          <ul className="prestige__list">
            <li>{copy.clears}</li>
          </ul>
        </section>

        <section className="prestige__column">
          <h3 className="prestige__heading">{copy.keepsTitle}</h3>
          <ul className="prestige__list">
            <li>{copy.keeps}</li>
          </ul>
        </section>
      </div>

      <p className="prestige__note">{owed ? copy.available : copy.unavailable}</p>

      <button
        type="button"
        className="button button--danger prestige__claim"
        disabled={!owed}
        onClick={() => setConfirming(true)}
      >
        {owed ? copy.claim(formatCount(gain)) : copy.noneOwed}
      </button>

      <dialog
        className="prestige__dialog"
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={() => setConfirming(false)}
        onClose={() => setConfirming(false)}
      >
        <h3 className="prestige__dialog-title" id={titleId}>
          {copy.confirmTitle}
        </h3>
        <p className="prestige__dialog-body">{copy.confirmBody(formatCount(gain))}</p>
        <div className="prestige__choices">
          <button type="button" className="button" onClick={() => setConfirming(false)}>
            {copy.cancel}
          </button>
          <button type="button" className="button button--danger" onClick={claim}>
            {copy.confirmAction}
          </button>
        </div>
      </dialog>
    </Panel>
  );
}

/**
 * `showModal` where the platform has it, the open attribute where it does not.
 *
 * jsdom implements neither `showModal` nor `close`, and a test runner that cannot
 * open the dialog cannot check that the reset is confirmed at all. The fallback
 * renders the same element in its open state, so the branch under test is the real
 * one everywhere the real method exists.
 */
function showDialog(node: HTMLDialogElement): void {
  if (node.open) return;
  if (typeof node.showModal === 'function') node.showModal();
  else node.setAttribute('open', '');
}

function hideDialog(node: HTMLDialogElement): void {
  if (!node.open) return;
  if (typeof node.close === 'function') node.close();
  else node.removeAttribute('open');
}
