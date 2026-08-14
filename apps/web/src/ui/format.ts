import Decimal from 'break_eternity.js';

const SHORT_SCALE = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
] as const;

/**
 * The one number formatter. Everything on screen goes through it.
 *
 * Plain digits below a thousand, short-scale names while they stay readable, then
 * scientific once the names get silly. This is among the most-read text in the game.
 */
export function formatNumber(value: Decimal, places = 2): string {
  if (value.lt(1000)) {
    return value.lt(100) ? trimZeros(value.toFixed(places)) : value.floor().toString();
  }

  const magnitude = Math.floor(value.log10().toNumber() / 3);
  const suffix = SHORT_SCALE[magnitude];

  if (suffix !== undefined) {
    const scaled = value.div(Decimal.pow(10, magnitude * 3));
    return `${trimZeros(scaled.toFixed(places))}${suffix}`;
  }

  return value.toExponential(places).replace('e+', 'e');
}

/**
 * For anything that never wants a decimal tail: generator counts, and Evil.
 *
 * **Evil belongs here and not in `formatNumber`.** A Minion's row promises 5 Evil every
 * four seconds and the player counts it out — so a total reading `34.72` breaks the one
 * contract the chain makes. The engine keeps every fraction a multiplier produces; this
 * only declines to print them. It floors rather than rounds, because a currency you
 * cannot quite afford must not read as one you can.
 *
 * The crown's rate is here too, and that is a reversal. The decimal is true, but a blow
 * multiplies the rate by `smiteBlow`, which is not a round number — so a surge turned a readable
 * 12.5 into 23.38, and the headline changed shape exactly when the player was looking at it. The
 * cost is that one automated Minion reads as 1 rather than 1.25; the rail still states the exact
 * yield per tier, which is where a player checks the arithmetic.
 */
export function formatWhole(value: Decimal): string {
  return value.lt(1000) ? value.floor().toString() : formatNumber(value, 2);
}

/**
 * A span of time, in the two largest units that carry meaning.
 *
 * "2h 14m", never "2h 14m 6s" — the third unit is noise at every scale a player
 * reads this at, and the offline summary is the main caller.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;

  const parts: [number, string][] = [
    [Math.floor(seconds / 86400), 'd'],
    [Math.floor((seconds % 86400) / 3600), 'h'],
    [Math.floor((seconds % 3600) / 60), 'm'],
    [seconds % 60, 's'],
  ];

  const from = parts.findIndex(([value]) => value > 0);
  return parts
    .slice(from, from + 2)
    .filter(([value], index) => value > 0 || index === 0)
    .map(([value, unit]) => `${value}${unit}`)
    .join(' ');
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
