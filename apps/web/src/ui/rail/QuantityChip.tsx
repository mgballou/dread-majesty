import type { KeyboardEvent, ReactNode } from 'react';
import type { RailCopy } from '@dm/content';
import {
  BUY_QUANTITIES,
  nextQuantity,
  previousQuantity,
  quantityLabel,
  quantityName,
  type BuyQuantity,
} from './quantity.ts';
import './QuantityChip.css';

interface QuantityChipProps {
  quantity: BuyQuantity;
  onChange: (quantity: BuyQuantity) => void;
  /** The rail's writing. `copy.rail` at the call site. */
  copy: RailCopy;
}

/**
 * How many the rail buys at a press: one chip, showing what is set, cycling on a press.
 *
 * Four radios marked the active one too quietly to find without looking for it. One
 * control that *is* its own state cannot be misread — and four states with a wrap means
 * any of them is three presses away at worst, which is what makes cycling acceptable
 * here and would not at eight.
 *
 * **A setting, so it never wears the accent.** Its weight ramps through the gold ramp
 * with the quantity, and stops one rung short of `--accent` — full-strength gold means
 * *act*, and this governs the buttons rather than being one (ui-sensibility §3, §5).
 *
 * What the radio group gave for free and this has to pay for: the arrow keys move
 * through the set without cycling, and the accessible name says which quantity is set
 * rather than what pressing will do. A control whose label changes on press has to name
 * its state, or a screen reader user hears the future instead of the present.
 */
export function QuantityChip({ quantity, onChange, copy }: QuantityChipProps): ReactNode {
  const step = BUY_QUANTITIES.indexOf(quantity) + 1;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    const on = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    if (!back && !on) return;

    event.preventDefault();
    onChange(back ? previousQuantity(quantity) : nextQuantity(quantity));
  };

  return (
    <button
      type="button"
      className="quantity-chip"
      data-step={step}
      aria-label={`${copy.quantity}: ${quantityName(quantity, copy)}`}
      onClick={() => onChange(nextQuantity(quantity))}
      onKeyDown={onKeyDown}
    >
      <span aria-hidden="true">{quantityLabel(quantity)}</span>
    </button>
  );
}
