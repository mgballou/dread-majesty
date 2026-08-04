import type { CSSProperties, ReactNode } from 'react';
import { quantise } from './segments.ts';
import { useReducedMotion } from './useReducedMotion.ts';
import './Meter.css';

interface MeterProps {
  /**
   * Names what is filling. Required — a bar with no name is a shape, and a shape
   * carries nothing to anyone not looking at it (ui-sensibility §13).
   */
  label: string;
  /** How far along, in whatever units `max` is in. Clamped, so a stale value is safe. */
  value: number;
  /** The full span. Zero or less reads as empty rather than as an error. */
  max: number;
  /** Layout the caller owns — width, margins, position in a row. Never colour. */
  className?: string;
}

/** The style object carries one component token, which plain CSSProperties cannot type. */
type MeterStyle = CSSProperties & Record<'--meter-swept', string>;

/**
 * A chevron-toothed meter with a gold fill sweeping through it.
 *
 * Built to be read at the size a rail row gives it — a sliver, full width. That is
 * why the track is a lit groove with teeth rather than a hairline: at this height a
 * bar has to carry its own edge or it disappears into the row.
 *
 * The gold is low weight. Full strength gold means *act*, and a meter reports rather
 * than offers (ui-sensibility §3, §5).
 *
 * Under reduced motion the fill **jumps** between five steps instead of sweeping.
 * The progress itself never goes missing and the spoken value stays exact — reduced
 * motion drops movement, never content (§8).
 */
export function Meter({ label, value, max, className = '' }: MeterProps): ReactNode {
  const reduced = useReducedMotion();

  const swept = max > 0 ? clamp(value / max) : 0;
  const shown = reduced ? quantise(swept) : swept;
  const style: MeterStyle = { '--meter-swept': `${shown * 100}%` };

  return (
    <div
      className={`meter${className === '' ? '' : ` ${className}`}`}
      data-motion={reduced ? 'reduced' : 'full'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(swept * 100)}
      style={style}
    >
      <span className="meter__fill" />
      <span className="meter__teeth" aria-hidden="true" />
    </div>
  );
}

function clamp(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}
