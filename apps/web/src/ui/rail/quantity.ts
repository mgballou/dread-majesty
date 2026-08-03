import type { RailCopy } from '@dm/content';

/**
 * How many units one press of a rail row buys.
 *
 * One global setting for the whole rail, never a control per row. `'max'` is
 * resolved against the player's purse at render time, so it is a quantity here and
 * a number by the time it reaches the engine.
 */
export const BUY_QUANTITIES = [1, 10, 100, 'max'] as const;

export type BuyQuantity = (typeof BUY_QUANTITIES)[number];

export function isBuyQuantity(value: unknown): value is BuyQuantity {
  return (BUY_QUANTITIES as readonly unknown[]).includes(value);
}

/** The face of the control. Monospaced, so the four sit on one rhythm. */
export function quantityLabel(quantity: BuyQuantity): string {
  return quantity === 'max' ? '×max' : `×${quantity}`;
}

/**
 * The accessible name, which says what the setting does rather than how it looks.
 *
 * `copy` is `copy.rail` at the call site. `'max'` reads differently from a number, so
 * it has its own line rather than being forced through the same sentence.
 */
export function quantityName(quantity: BuyQuantity, copy: RailCopy): string {
  return quantity === 'max' ? copy.maxHint : copy.quantityOption(String(quantity));
}
