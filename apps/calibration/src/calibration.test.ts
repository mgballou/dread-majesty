import { describe, expect, it } from 'vitest';
import { brierScore, reliabilityCurve } from './metrics.ts';

describe('calibration scoring', () => {
  it('scores a perfect prediction as zero', () => {
    expect(brierScore([{ p: 1, outcome: 1 }])).toBe(0);
  });

  it('scores a maximally wrong confident prediction as one', () => {
    expect(brierScore([{ p: 1, outcome: 0 }])).toBe(1);
  });

  it('scores a constant half prediction as one quarter', () => {
    expect(brierScore([{ p: 0.5, outcome: 0 }, { p: 0.5, outcome: 1 }])).toBe(0.25);
  });

  it('reports stated confidence against observed frequency by bucket', () => {
    expect(reliabilityCurve([
      { p: 0.1, outcome: 0 },
      { p: 0.2, outcome: 1 },
      { p: 0.8, outcome: 1 },
      { p: 0.9, outcome: 0 },
    ], 2)).toEqual([
      { bucket: 0, count: 2, stated: 0.15, observed: 0.5 },
      { bucket: 1, count: 2, stated: 0.85, observed: 0.5 },
    ]);
  });
});
