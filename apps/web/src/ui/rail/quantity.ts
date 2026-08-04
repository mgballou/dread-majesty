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

/**
 * The face of the chip. Monospaced, and four characters in every state — `×1`, `×10`,
 * `×100`, `×MAX` — so the control cannot change width as it cycles.
 *
 * Max keeps the word. `∞` is wrong: the quantity is bounded twice over, by the purse
 * and by `MAX_AFFORDABLE_CAP`, and a player who presses ∞ and gets four has been lied
 * to. The Evil sigil is worse — it is the currency everywhere else on the screen, and
 * reusing it as a quantifier would make it mean two things at once.
 */
export function quantityLabel(quantity: BuyQuantity): string {
  return quantity === 'max' ? '×MAX' : `×${quantity}`;
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

/**
 * The next quantity in the cycle, wrapping at the end.
 *
 * The control is one chip rather than four ticks, so the set is walked rather than
 * chosen from. Four states and a wrap means every one of them is at most three presses
 * away, which is what makes a cycling control acceptable here at all.
 */
export function nextQuantity(quantity: BuyQuantity): BuyQuantity {
  return step(quantity, 1);
}

/** The previous quantity, wrapping at the start. Bound to the arrow keys. */
export function previousQuantity(quantity: BuyQuantity): BuyQuantity {
  return step(quantity, -1);
}

function step(quantity: BuyQuantity, by: number): BuyQuantity {
  const at = BUY_QUANTITIES.indexOf(quantity);
  const count = BUY_QUANTITIES.length;
  return BUY_QUANTITIES[(at + by + count) % count] ?? 1;
}
