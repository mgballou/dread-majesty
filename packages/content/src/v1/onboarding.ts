import type { Onboarding } from '../onboarding.ts';

const SECOND = 1000;

/**
 * The first run, and the voice that interrupts it.
 *
 * Every threshold these beats name is read off the existing economy rather than added
 * to it — `can-afford-tier` and `can-afford-overseer` ask the live cost, so a balance
 * change moves the track with it and nothing here goes stale. Nothing in this file is a
 * balance number in its own right except the two retirement windows.
 *
 * The Dominion track ends at the first Warren's first cycle, which the harness puts at
 * about eleven minutes. See the spec §3.
 */
export const v1Onboarding: Onboarding = {
  dominion: [
    {
      id: 'stir',
      ready: { kind: 'always' },
      gate: { kind: 'rouse', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'orders',
      ready: { kind: 'idle-after-cycle', tierId: 'minion' },
      gate: { kind: 'rouse', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'muster',
      ready: { kind: 'can-afford-tier', tierId: 'minion' },
      gate: { kind: 'buy', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'appoint',
      ready: { kind: 'can-afford-overseer', overseerId: 'minion-hand' },
      gate: { kind: 'appoint', overseerId: 'minion-hand' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'warren',
      ready: { kind: 'can-afford-tier', tierId: 'warren' },
      gate: { kind: 'buy', tierId: 'warren' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'rouse-warren',
      ready: { kind: 'owned-and-idle', tierId: 'warren' },
      gate: { kind: 'rouse', tierId: 'warren' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      // The finale, and the only Dominion beat that gates nothing. It is a caption on
      // five Minions that arrived without being asked, which is why it cannot be written
      // any earlier: until the Warren has cycled there is nothing to caption.
      id: 'cascade',
      ready: { kind: 'cycled', tierId: 'warren' },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
  ],
  malice: [
    {
      // Dismiss-only. It is the longest line in the tutorial — about 38 words, some
      // twelve seconds of reading — so a window that retired it would be a coin toss on
      // whether the player finished it. It has a button; that is what ends it.
      id: 'first-blow',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
    {
      // She is not spent by one strike. Her lines are chosen from Apathy, and Apathy
      // *rises* when the player caves — so caving lands her back on "Again", which is the
      // insistence. What ends her is the narrator: when Apathy crosses band 2 on the
      // second cave, `apathy` becomes ready and takes the bar from her. If the player
      // resists instead, she walks down to her honest line and gives up at her window,
      // which is the only ending she has that is not an interruption.
      id: 'goad',
      ready: { kind: 'blow-ready-after-first' },
      gate: { kind: 'none' },
      voice: 'her',
      clearedBy: 'next-ready',
      retireAfterMs: 120 * SECOND,
    },
    {
      // Band 2, not band 1 — see the 2026-08-13 spec §5.3 for the strike-by-strike walk.
      // Dismiss-only: it is the answer to her, and the player should close it themselves.
      id: 'apathy',
      ready: { kind: 'band-at-least', band: 2 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
  ],
};
