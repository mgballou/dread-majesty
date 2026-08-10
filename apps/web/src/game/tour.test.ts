import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetTour, hasSeenTour, markTourSeen } from './tour.ts';

afterEach(() => {
  forgetTour();
  vi.restoreAllMocks();
});

describe('the tour flag', () => {
  it('starts unseen', () => {
    expect(hasSeenTour()).toBe(false);
  });

  it('remembers once marked', () => {
    markTourSeen();

    expect(hasSeenTour()).toBe(true);
  });

  it('stays marked across repeated reads', () => {
    markTourSeen();
    hasSeenTour();

    expect(hasSeenTour()).toBe(true);
  });

  it('forgets on demand', () => {
    markTourSeen();
    forgetTour();

    expect(hasSeenTour()).toBe(false);
  });
});

describe('a browser that refuses storage', () => {
  it('reports the tour seen rather than showing it every visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(hasSeenTour()).toBe(true);
  });

  it('swallows a refused write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => markTourSeen()).not.toThrow();
  });
});
