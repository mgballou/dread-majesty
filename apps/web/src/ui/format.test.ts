import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { formatCount, formatNumber } from './format.ts';

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
    expect(formatCount(new Decimal(205))).toBe('205');
    expect(formatCount(new Decimal(1))).toBe('1');
  });
});
