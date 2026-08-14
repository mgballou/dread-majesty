import { describe, expect, it } from 'vitest';
import { ART } from '../src/index.ts';

describe('the art manifest', () => {
  it('gives the game its own mark', () => {
    expect(ART['mark/dread-majesty']?.fallback.shape).toBe('hammer');
  });

  it("draws the mark in the resource tone rather than a tier's", () => {
    expect(ART['mark/dread-majesty']?.fallback.tone).toBe('resource');
  });

  it('gives every slot an accessible name', () => {
    for (const slot of Object.values(ART)) expect(slot.alt.length).toBeGreaterThan(0);
  });

  it('ships no slot pointing at a file, so the build needs no art', () => {
    for (const slot of Object.values(ART)) expect(slot.src).toBeNull();
  });
});
