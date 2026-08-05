import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { formatNumber, formatWhole, formatDuration } from './format.ts';

describe('formatNumber', () => {
  it('shows plain digits below a thousand', () => {
    expect(formatNumber(new Decimal(0))).toBe('0');
    expect(formatNumber(new Decimal(7.5))).toBe('7.5');
    expect(formatNumber(new Decimal(999))).toBe('999');
  });

  it('names magnitudes while the names stay readable', () => {
    expect(formatNumber(new Decimal(1500))).toBe('1.5K');
    expect(formatNumber(new Decimal(4_875_000))).toBe('4.88M');
    expect(formatNumber(new Decimal('1e12'))).toBe('1T');
  });

  it('falls back to scientific once the names get silly', () => {
    expect(formatNumber(new Decimal('1e60'))).toMatch(/e60$/);
    expect(formatNumber(new Decimal('1e300'))).toMatch(/e300$/);
  });

  it('formats counts without a decimal tail below a thousand', () => {
    expect(formatWhole(new Decimal(205))).toBe('205');
    expect(formatWhole(new Decimal(1))).toBe('1');
  });
});

describe('formatDuration', () => {
  it('shows seconds alone under a minute', () => {
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('shows the two largest units that carry meaning', () => {
    expect(formatDuration(8_040_000)).toBe('2h 14m');
    expect(formatDuration(93_600_000)).toBe('1d 2h');
  });

  it('drops a trailing unit that is zero', () => {
    expect(formatDuration(7_200_000)).toBe('2h');
  });

  it('treats a negative span as none at all', () => {
    expect(formatDuration(-5000)).toBe('0s');
  });
});
