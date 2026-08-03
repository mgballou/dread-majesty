import { useEffect, useRef, type ReactNode } from 'react';
import './Sheet.css';

interface SheetProps {
  open: boolean;
  /** Names the dialog. The panel inside carries the visible heading. */
  label: string;
  /** What the close control says. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A record, lifted over the game.
 *
 * The platform's `<dialog>`, opened modally, because it already does the four things
 * a hand-rolled overlay gets wrong: it takes focus, it traps it, Escape closes it,
 * and everything behind it goes inert. Reimplementing that is how an interface ends
 * up unreachable by keyboard (ui-sensibility §13).
 *
 * The `close` event is the single source of truth for shutting. Escape and the
 * backdrop both raise it without going through the button, so listening to it is the
 * only way the parent's state cannot drift out of step with what is on screen.
 */
export function Sheet({ open, label, closeLabel, onClose, children }: SheetProps): ReactNode {
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = sheet.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const element = sheet.current;
    if (!element) return undefined;

    element.addEventListener('close', onClose);
    return () => element.removeEventListener('close', onClose);
  }, [onClose]);

  return (
    <dialog className="sheet" ref={sheet} aria-label={label}>
      <div className="sheet__body">{children}</div>
      <div className="sheet__close">
        {/* Closes the element rather than calling `onClose`, so the button, Escape
            and the backdrop all leave by the same door: the `close` event. */}
        <button
          type="button"
          className="button button--quiet"
          onClick={() => sheet.current?.close()}
        >
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}
