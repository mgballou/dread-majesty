import type { Onboarding } from '../onboarding.ts';

const SECOND = 1000;

/**
 * The first run, and the voice that interrupts it.
 *
 * Every threshold these beats name is read off the existing economy rather than added
 * to it — `can-afford-tier` and `can-afford-overseer` ask the live cost, so a balance
 * change moves the track with it and nothing here goes stale. Nothing in this file is a
 * balance number in its own right except the one retirement window.
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
      // Minions that arrived without being asked, which is why it cannot be written
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
      // She arrives on the blow itself, on the same condition as the narrator, so she
      // queues directly behind him and takes the bar inside the cooldown — an answer to
      // what the player just did, with the whole cooldown to be read in. It also stops
      // her withdrawing: the old condition lapsed on every cooldown, so she vanished and
      // came back on each cave, which is most of why her lines looked like they repeated.
      //
      // Three lifetime blows ends her: the one that summoned her, plus two caves. A count,
      // not an Apathy band — a band is only reachable near the cooldown floor, so a player
      // striking every forty-five seconds caved over and over and was handed the ending
      // written for someone who resisted. See the spec §2.
      id: 'goad',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      points: { kind: 'smite' },
      voice: 'her',
      clearedBy: { kind: 'superseded', when: { kind: 'smites-at-least', count: 3 } },
      retireAfterMs: 75 * SECOND,
    },
    {
      // Ready always, so it lands however her turn ended, and dismiss-only so the player
      // closes the answer themselves. Which of its two lines it carries is decided by how
      // she was consumed, not by anything read off the state when it shows.
      id: 'verdict',
      ready: { kind: 'always' },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
  ],
};
