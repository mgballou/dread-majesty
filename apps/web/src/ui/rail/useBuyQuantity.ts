import { useCallback, useState } from 'react';
import { isBuyQuantity, type BuyQuantity } from './quantity.ts';

const STORAGE_KEY = 'dm.buy-quantity';

export interface BuyQuantitySetting {
  quantity: BuyQuantity;
  setQuantity: (quantity: BuyQuantity) => void;
}

/**
 * The buy quantity, remembered across reloads.
 *
 * `localStorage` rather than the save blob: this is a preference about the
 * interface, not part of the game state, and it must survive an import of someone
 * else's save. It is a handful of bytes written on a click, which is the one thing
 * `localStorage` is still good at.
 *
 * Every touch is wrapped, because a browser in private mode or with storage denied
 * throws on the property access itself. A refused store must cost the player the
 * stickiness and nothing else — never the game.
 */
export function useBuyQuantity(): BuyQuantitySetting {
  const [quantity, setStored] = useState<BuyQuantity>(read);

  const setQuantity = useCallback((next: BuyQuantity): void => {
    setStored(next);
    write(next);
  }, []);

  return { quantity, setQuantity };
}

function read(): BuyQuantity {
  try {
    const raw: unknown = localStorage.getItem(STORAGE_KEY);
    if (raw === 'max') return 'max';
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (isBuyQuantity(parsed)) return parsed;
    }
  } catch {
    // Storage refused. The setting simply does not stick.
  }
  return 1;
}

function write(quantity: BuyQuantity): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(quantity));
  } catch {
    // As above.
  }
}
