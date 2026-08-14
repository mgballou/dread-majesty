/**
 * How far along its cap Apathy stands, 0 to 1.
 *
 * Shared because two places read it — the arc that draws it and the band lookup below —
 * and two copies of a clamp are two chances to disagree about what a cap of zero means.
 */
export function apathyShare(apathy: number, cap: number): number {
  return cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;
}

/**
 * Which band Apathy falls in, 0 to `bandCount - 1`.
 *
 * `Math.min` rather than a bare `Math.floor`, so a full share lands in the last band
 * rather than one past it. `bandCount` is a parameter, not a constant, so a caller
 * always passes the length of the band copy it is about to read — the count and the
 * words it indexes into can never drift apart.
 */
export function bandIndex({
  apathy,
  cap,
  bandCount,
}: {
  apathy: number;
  cap: number;
  bandCount: number;
}): number {
  return Math.min(bandCount - 1, Math.floor(apathyShare(apathy, cap) * bandCount));
}
