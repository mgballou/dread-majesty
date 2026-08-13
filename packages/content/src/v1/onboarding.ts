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
      id: 'first-blow',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: 12 * SECOND,
    },
    {
      // She arrives when the first blow has worn off and the button has relit — twenty
      // seconds after the strike on the shipped numbers. Two minutes of play time, then
      // she gives up, so a player who strikes once and never again is not left with a
      // permanent bar.
      id: 'goad',
      ready: { kind: 'blow-ready-after-first' },
      gate: { kind: 'none' },
      voice: 'her',
      clearedBy: 'smite',
      retireAfterMs: 120 * SECOND,
    },
    {
      // Band 2, not band 1. Bands are the floor of Apathy against a cap of 3, so band 1
      // arrives on the *second* rapid blow — scolding a player for taking her advice
      // exactly once. Band 2 lands on the third. See the spec §5.3 for the walk.
      id: 'apathy',
      ready: { kind: 'band-at-least', band: 2 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: 12 * SECOND,
    },
  ],
};
