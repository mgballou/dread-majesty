import type { ReactNode } from 'react';
import { CYCLE_SEGMENTS } from '../segments.ts';
import './ApathyArc.css';

interface ApathyArcProps {
  /** How tired the realm is, 0 to `cap`. */
  apathy: number;
  cap: number;
}

/** The arc's radius and sweep, in the SVG's own units. */
const SIZE = 100;
const RADIUS = 46;
/** Degrees of arc the whole gauge spans, centred on the bottom of the medallion. */
const SWEEP = 140;
/** Degrees of blank between one segment and the next. */
const GAP = 4;

/**
 * The realm's patience, drawn around the medallion it belongs to.
 *
 * **A share of the cap, never a count of it.** There are always `CYCLE_SEGMENTS`
 * segments and the cap decides only how far along them a point of Apathy carries you.
 * Raising the cap from three to six later is a content edit and nothing here moves —
 * which is the whole reason this is not one segment per point.
 *
 * **Around the medallion, not beside the control and not under the thumb.** It used to
 * be a row of dots below the button, which read as a floating widget because nothing
 * tied it to what it described. Beside the control is worse: the button is centred and
 * pinned, so a gauge on one edge either pushes the medallion off centre or eats the tap
 * target on a phone. Curved around the disc it is inside the control's boundary and
 * outside the part anybody presses — a fingertip lands on the middle, not the rim.
 *
 * **Always mounted and empty at rest**, so nothing moves when it fills.
 *
 * **It prints no number, and it is hidden from assistive tech.** The strike button owns
 * an `aria-label`, which overrides anything inside it, so a label here would never be
 * announced. The band sentence rides on that label instead — see `SmiteCopy.spoken`.
 *
 * **Reduced motion needs no special case.** Segments are discrete: one lights or it does
 * not, at every motion setting. There is no sweep to strip, which is the property the
 * row of dots had and the reason this drawing keeps it.
 */
export function ApathyArc({ apathy, cap }: ApathyArcProps): ReactNode {
  const share = apathyShare(apathy, cap);
  // Upward bound, and **deliberately the opposite of the flooring `quantise` does for
  // the cycle rings.** A ring measures how much of a cycle has elapsed, so it must not
  // claim progress that has not happened — floor. This measures where a level stands, so
  // a segment owns the band beneath it and stays lit until the value drops clear of it.
  //
  // Flooring here made the top segment unreachable in practice. Apathy is capped at
  // exactly `cap`, so a full share held for the single 100ms slice after a blow landed on
  // the cap and `step` bled it below — the last segment flashed for one frame a minute. A
  // player striking on every cooldown holds Apathy between 2.56 and 3.0 of 3 for ever.
  const lit = Math.ceil(share * CYCLE_SEGMENTS);

  const span = (SWEEP - GAP * (CYCLE_SEGMENTS - 1)) / CYCLE_SEGMENTS;
  const start = 90 - SWEEP / 2;

  return (
    <span className="apathy" aria-hidden="true">
      <svg className="apathy__dial" viewBox={`0 0 ${SIZE} ${SIZE}`} focusable="false">
        {Array.from({ length: CYCLE_SEGMENTS }, (_, index) => (
          <path
            key={index}
            className={index < lit ? 'apathy__segment apathy__segment--lit' : 'apathy__segment'}
            d={segment(start + index * (span + GAP), span)}
          />
        ))}
      </svg>
    </span>
  );
}

/**
 * How far along its cap Apathy stands, 0 to 1.
 *
 * Exported because the arc draws this and the control it sits inside speaks it, and two
 * copies of a clamp are two chances to disagree about what a cap of zero means.
 */
export function apathyShare(apathy: number, cap: number): number {
  return cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;
}

/** One segment's arc, as an SVG path from its start angle across `span` degrees. */
function segment(from: number, span: number): string {
  const a = point(from);
  const b = point(from + span);

  return `M ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x} ${b.y}`;
}

/** A point on the arc, in the SVG's units. Degrees, clockwise from three o'clock. */
function point(degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: SIZE / 2 + RADIUS * Math.cos(radians),
    y: SIZE / 2 + RADIUS * Math.sin(radians),
  };
}
