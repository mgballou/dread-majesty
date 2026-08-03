import { useRef, useState, type ReactNode } from 'react';
import type { Content, Copy } from '@dm/content';
import type { GameState } from '@dm/engine';
import { Panel } from '../ui/Panel.tsx';
import { formatDuration, formatNumber } from '../ui/format.ts';
import './Ledger.css';

interface LedgerProps {
  state: GameState;
  content: Content;
  copy: Copy['ledger'];
  errors: Copy['errors'];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExport: () => string;
  onImport: (blob: string) => boolean;
  onAbdicate: () => void;
}

/**
 * The record, and the controls that act on it.
 *
 * An inline reveal rather than a screen: nothing here is a change of task
 * (ui-sensibility §2.10). The export blob doubles as the bug-report format, which is
 * why it is plain text a player can select and paste rather than a download.
 */
export function Ledger({
  state,
  content,
  copy,
  errors,
  soundEnabled,
  onToggleSound,
  onExport,
  onImport,
  onAbdicate,
}: LedgerProps): ReactNode {
  const [blob, setBlob] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const confirming = useRef<HTMLDialogElement>(null);

  function reveal(): void {
    setBlob(onExport());
    setNotice(copy.exportDone);
  }

  function restore(): void {
    setNotice(onImport(blob) ? copy.importDone : errors.corruptSave);
  }

  return (
    <Panel title={copy.title} glyph="※" trailing={formatDuration(state.stats.playTimeMs)}>
      <dl className="ledger__stats">
        <div className="ledger__stat">
          <dt>{copy.lifetimeEvil}</dt>
          <dd>{formatNumber(state.lifetimeEvil)}</dd>
        </div>
        <div className="ledger__stat">
          <dt>{copy.smites}</dt>
          <dd>{state.stats.smites.toLocaleString()}</dd>
        </div>
        <div className="ledger__stat">
          <dt>{copy.resets}</dt>
          <dd>{state.stats.prestiges}</dd>
        </div>
        <div className="ledger__stat">
          <dt>{copy.deeds}</dt>
          <dd>
            {state.earnedAchievements.length} of {content.achievements.length}
          </dd>
        </div>
      </dl>

      <div className="ledger__controls">
        <button type="button" className="button button--quiet" onClick={onToggleSound}>
          {soundEnabled ? copy.soundOn : copy.soundOff}
        </button>
        <button type="button" className="button" onClick={reveal}>
          {copy.exportAction}
        </button>
        <button type="button" className="button" onClick={restore} disabled={blob.length === 0}>
          {copy.importAction}
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => confirming.current?.showModal()}
        >
          {copy.abdicate}
        </button>
      </div>

      <label className="ledger__blob">
        <span className="ledger__blob-label">{copy.blobLabel}</span>
        <textarea
          className="ledger__field"
          value={blob}
          onChange={(event) => setBlob(event.target.value)}
          rows={3}
          spellCheck={false}
          placeholder={copy.blobPlaceholder}
        />
      </label>

      {notice !== null && (
        <p className="ledger__notice" role="status">
          {notice}
        </p>
      )}

      <dialog className="ledger__confirm" ref={confirming}>
        <h3 className="ledger__confirm-title">{copy.abdicateTitle}</h3>
        <p className="ledger__confirm-body">{copy.abdicateBody}</p>
        <form method="dialog" className="ledger__confirm-actions">
          <button type="submit" className="button">
            {copy.abdicateCancel}
          </button>
          <button
            type="submit"
            className="button button--danger"
            onClick={() => {
              onAbdicate();
              setBlob('');
              setNotice(copy.abdicated);
            }}
          >
            {copy.abdicateConfirm}
          </button>
        </form>
      </dialog>
    </Panel>
  );
}
