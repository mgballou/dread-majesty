import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Banner } from './Banner.tsx';
import { Sheet } from './Sheet.tsx';
import './controls.css';
import './Confirm.css';

/** Which way the player went. Nothing else can come back from a confirmation. */
export type ConfirmChoice = 'confirm' | 'cancel';

interface ConfirmProps {
  open: boolean;
  /** Names the sheet and heads it. A question, in the caller's own words. */
  title: string;
  /** What the choice is about: what it costs, what it changes, what it undoes. */
  children: ReactNode;
  confirmLabel: string;
  /** Also what the sheet's own way out says, so every exit reads the same. */
  cancelLabel: string;
  onChoose: (choice: ConfirmChoice) => void;
}

/**
 * Ask, then act. One question, two answers, and the caller is told which.
 *
 * Built over `Sheet`, so it inherits the platform `<dialog>` and the four things a
 * hand-rolled overlay gets wrong — it takes focus, traps it, closes on Escape and
 * makes everything behind it inert (ui-sensibility §13). Everything behind being
 * inert is also what lets the confirming action wear the accent without breaking the
 * one-per-screen rule: while this is up, this is the screen.
 *
 * **The sheet's close control is the cancel.** Escape, the backdrop and the button
 * all leave by the same door and all mean the same thing, so there is no second way
 * out saying the same word twice.
 *
 * It knows nothing about what is being confirmed — an appointment, a reset, anything
 * later. A caller hands it a question, a body and two words.
 */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onChoose,
}: ConfirmProps): ReactNode {
  /*
   * A caller that shuts the sheet on confirming makes the dialog raise `close`, which
   * would otherwise report a cancel a beat after the confirm. The flag swallows that
   * one event and nothing else.
   */
  const confirmed = useRef(false);

  useEffect(() => {
    if (open) confirmed.current = false;
  }, [open]);

  const leave = useCallback((): void => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    onChoose('cancel');
  }, [onChoose]);

  return (
    <Sheet open={open} label={title} closeLabel={cancelLabel} onClose={leave}>
      <div className="confirm">
        <Banner as="h2" weight="primary" className="confirm__title">
          {title}
        </Banner>

        <div className="confirm__body">{children}</div>

        <button
          type="button"
          className="button button--primary confirm__act"
          onClick={() => {
            confirmed.current = true;
            onChoose('confirm');
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
