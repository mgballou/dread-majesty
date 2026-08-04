/**
 * How many segments a cycle is read in, on the ring and on the bar alike.
 *
 * Five, because the job is to be read at a glance rather than measured: "three of
 * five" is read, a sweep two-thirds along is estimated. It doubles as the number of
 * steps the fill holds under reduced motion, which is what it was already doing
 * separately in two files at eight.
 */
export const CYCLE_SEGMENTS = 5;

/**
 * A fraction, rounded down to whole segments.
 *
 * Down, never nearest: a segment lights when it is filled, so a lit segment always
 * means at least that much has run. Rounding to nearest would light the last one
 * early, which on a ninety-minute Throne cycle is a lie worth minutes.
 */
export function quantise(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.floor(clamped * CYCLE_SEGMENTS) / CYCLE_SEGMENTS;
}
