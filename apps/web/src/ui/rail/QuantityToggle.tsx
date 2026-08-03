import { useId, type ReactNode } from 'react';
import type { RailCopy } from '@dm/content';
import { BUY_QUANTITIES, quantityLabel, quantityName, type BuyQuantity } from './quantity.ts';

interface QuantityToggleProps {
  quantity: BuyQuantity;
  onChange: (quantity: BuyQuantity) => void;
  /** The rail's writing. `copy.rail` at the call site. */
  copy: RailCopy;
}

/**
 * How many the rail buys at a press. One control for every row.
 *
 * A setting, not the screen's action, so it never wears the accent — the selected
 * option is marked structurally, and it carries the word as well as the tone
 * (ui-sensibility §3, §5).
 *
 * Real radio inputs, visually restyled. The platform gives arrow-key movement, a
 * single tab stop for the group and a label bound to each control for free; a row of
 * buttons with `aria-pressed` would be a hand-rolled version of all three.
 *
 * The legend is visible now that the control sits inside the list it governs rather
 * than in the panel band above it. In the band the title said what the region was and
 * the toggle read as furniture; on its own strip it needs to say what it does.
 */
export function QuantityToggle({ quantity, onChange, copy }: QuantityToggleProps): ReactNode {
  const group = useId();

  return (
    <fieldset className="quantity">
      <legend className="quantity__legend">{copy.quantity}</legend>

      <div className="quantity__ticks">
        {BUY_QUANTITIES.map((option) => {
          const id = `${group}-${option}`;
          const name = quantityName(option, copy);

          return (
            <div className="quantity__option" key={option}>
              <input
                className="quantity__input"
                type="radio"
                id={id}
                name={group}
                value={String(option)}
                checked={option === quantity}
                onChange={() => onChange(option)}
              />
              <label className="quantity__label" htmlFor={id} title={name}>
                <span aria-hidden="true">{quantityLabel(option)}</span>
                <span className="quantity__name">{name}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
