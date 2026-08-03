import type { ReactNode } from 'react';
import type { StageCopy } from '@dm/content';
import { useReducedMotion } from '../useReducedMotion.ts';
import './CycleRing.css';

/**
 * Ring geometry, in the viewBox's own units. Not tokens: this is the drawing, the
 * same way `TierArt` carries its path data. The rendered size is set in CSS.
 */
const CENTRE = 24;
const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How many discrete positions the ring holds under reduced motion.
 *
 * Eight is enough that a long cycle still visibly advances and few enough that each
 * change reads as a jump rather than a sweep. See the note on reduced motion below.
 */
const REDUCED_STEPS = 8;

interface CycleRingProps {
  /** Milliseconds accumulated toward the next completion. A plain number on `TierState`. */
  progressMs: number;
  /** The full cycle, in milliseconds. */
  cycleMs: number;
  /** Names what is cycling. Carries into the ring's text alternative. */
  label: string;
  /** The stage's writing. `copy.stage` at the call site. */
  copy: StageCopy;
}

/**
 * One tier's cycle, swept as a ring.
 *
 * Driven straight from the value React already re-renders on — there is no second
 * animation clock and no CSS transition, because the loop commits a slice every
 * 100ms and a transition longer than that would draw the ring behind the data it is
 * meant to show. The engine's own slice is the frame budget.
 *
 * Under reduced motion the ring **jumps** between discrete steps instead of
 * sweeping. The progress itself never goes missing — the same fraction is reported,
 * quantised, and the text alternative carries it either way (ui-sensibility §8).
 *
 * Colour and shape are never the only carrier, so the ring is a `progressbar` with a
 * spoken value, not a bare arc.
 */
export function CycleRing({ progressMs, cycleMs, label, copy }: CycleRingProps): ReactNode {
  const reduced = useReducedMotion();

  const swept = cycleMs > 0 ? clamp(progressMs / cycleMs) : 0;
  const fraction = reduced ? Math.floor(swept * REDUCED_STEPS) / REDUCED_STEPS : swept;
  const percent = Math.round(fraction * 100);

  return (
    <div
      className="stage-ring"
      data-motion={reduced ? 'reduced' : 'full'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={copy.cycle({ label, swept: `${percent}%` })}
    >
      <svg className="stage-ring__art" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="stage-ring__track" cx={CENTRE} cy={CENTRE} r={RADIUS} />
        <circle
          className="stage-ring__sweep"
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
    </div>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
