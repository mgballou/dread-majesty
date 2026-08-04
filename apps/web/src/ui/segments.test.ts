import { describe, expect, it } from 'vitest';
import { CYCLE_SEGMENTS, quantise } from './segments.ts';

describe('the cycle reads in fifths', () => {
  it('is five segments', () => {
    expect(CYCLE_SEGMENTS).toBe(5);
  });

  it('drops a part-filled segment rather than rounding it up', () => {
    expect(quantise(0.39)).toBeCloseTo(0.2);
  });

  it('holds an exact boundary', () => {
    expect(quantise(0.6)).toBeCloseTo(0.6);
  });

  it('reports nothing below the first segment', () => {
    expect(quantise(0.19)).toBe(0);
  });

  it('reports full at one', () => {
    expect(quantise(1)).toBe(1);
  });

  it('treats a value that is not a number as empty', () => {
    expect(quantise(Number.NaN)).toBe(0);
  });
});
