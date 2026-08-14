import type { ReactNode } from 'react';
import type { BeatVoice } from '@dm/content';
import './Prompt.css';

interface PromptProps {
  line: string;
  voice: BeatVoice;
  /** Names the bar to a screen reader. Changes with the voice. */
  label: string;
  /** The opening beat's two ways out, and nowhere else. See the spec §4.2. */
  bail?: {
    skip: string;
    loadSave: string;
    onSkip: () => void;
    onLoadSave: () => void;
  };
  /** For a beat that gates nothing and so has no action to be cleared by. */
  dismiss?: {
    label: string;
    onDismiss: () => void;
  };
}

/**
 * One line at the foot of the frame, and at most one at a time.
 *
 * A `status` region rather than a dialog: it never takes focus, never traps it, and the
 * game behind it stays fully operable. The gating is done by the controls themselves,
 * which is what lets this be so much less machinery than the modal tour it replaced.
 *
 * `aria-live` is on the region so a beat arriving mid-play is announced without the
 * player being moved. The text is swapped in place rather than remounted, so a screen
 * reader reads the change rather than the whole bar again.
 *
 * **It decides nothing.** Which beat, which line and when are all worked out in
 * `game/onboarding.ts`; this is handed the result.
 */
export function Prompt({ line, voice, label, bail, dismiss }: PromptProps): ReactNode {
  return (
    <div
      className={`prompt prompt--${voice}`}
      role="status"
      // `role="status"` already implies a polite live region; this is kept explicit as
      // belt-and-braces against assistive tech that does not infer it reliably.
      aria-live="polite"
      aria-label={label}
    >
      <p className="prompt__line">{line}</p>

      {(bail || dismiss) && (
        <div className="prompt__actions">
          {bail && (
            <>
              <button type="button" className="button button--quiet" onClick={bail.onSkip}>
                {bail.skip}
              </button>
              <button type="button" className="button button--quiet" onClick={bail.onLoadSave}>
                {bail.loadSave}
              </button>
            </>
          )}
          {dismiss && (
            <button type="button" className="button button--quiet" onClick={dismiss.onDismiss}>
              {dismiss.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
