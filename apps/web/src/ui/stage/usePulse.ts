import { useEffect, useRef, useState } from 'react';
import type Decimal from 'break_eternity.js';

/** One completion, ready to draw. */
export interface Pulse {
  /**
   * Increments on every completion.
   *
   * Re-keying on it remounts whatever draws the pulse, which restarts the drawing.
   * No timer is involved and nothing has to be cleaned up.
   */
  id: number;
  /** How much the producer made. Drives how heavy the pulse is drawn. */
  amount: Decimal;
}

/**
 * Notice that a producer completed a cycle.
 *
 * Growth in `lifetimeProduced` is exactly a cycle completion, so both halves of the
 * cascade — the link that carries the units down and the node that receives them —
 * can watch the same field and need nothing else. `state` is mutated in place, so its
 * identity never changes; `version` is what a render hangs on.
 *
 * `produced` is null for a rung nothing feeds. The head of the chain is fed by
 * nobody, and a hook may not be called conditionally.
 */
export function usePulse(produced: Decimal | null, version: number): Pulse | null {
  const seen = useRef(produced);
  const issued = useRef(0);
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    if (produced === null) return;

    const previous = seen.current;
    seen.current = produced;
    if (previous === null) return;

    const amount = produced.sub(previous);
    if (amount.lte(0)) return;

    issued.current += 1;
    setPulse({ id: issued.current, amount });
  }, [produced, version]);

  return pulse;
}
