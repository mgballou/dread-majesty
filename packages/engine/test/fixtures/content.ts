import type { Content } from '@dm/content';

const SECOND = 1000;

/**
 * Fixture content. Owned by the tests, not by the game.
 *
 * Engine tests must never import shipping content — a balance change must not be
 * able to fail an engine test. These numbers match the worked example in the
 * original design docs, and they exist so that example can be asserted exactly.
 */
export const fixture: Content = {
  version: 'fixture',

  tiers: [
    {
      id: 'warren',
      name: 'Warren',
      plural: 'Warrens',
      produces: 'minion',
      yield: '100',
      cycleMs: 60 * SECOND,
      costResource: 'evil',
      baseCost: '1500',
      costRate: 1.089,
      overseers: [
        { id: 'warren-hand', name: 'Fixture Warden', cost: '600', effect: { kind: 'automate' } },
        {
          id: 'warren-goad',
          name: 'Fixture Goad',
          cost: '2400',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'warren-glut',
          name: 'Fixture Glut',
          cost: '9600',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
      art: 'tier/warren',
    },
    {
      id: 'minion',
      name: 'Minion',
      plural: 'Minions',
      produces: 'evil',
      yield: '15',
      cycleMs: 24 * SECOND,
      costResource: 'evil',
      baseCost: '90',
      costRate: 1.089,
      overseers: [
        {
          id: 'minion-hand',
          name: 'Fixture Taskmaster',
          cost: '400',
          effect: { kind: 'automate' },
        },
        {
          id: 'minion-goad',
          name: 'Fixture Goad',
          cost: '1600',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'minion-glut',
          name: 'Fixture Glut',
          cost: '6400',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
      art: 'tier/minion',
    },
  ],

  // None, deliberately. The worked example is about the cascade; a milestone
  // multiplier firing inside it would silently change every expected number.
  milestones: [],

  // One of every condition kind, all granting nothing. Earning these must not move a
  // single number in the worked example. Anything that multiplies lives in
  // `fixtureWithAchievementMultiplier` below, for exactly that reason.
  achievements: [
    {
      id: 'minion-10',
      name: 'Ten Minions',
      description: 'Own 10 Minions.',
      condition: { kind: 'tier-owned', tierId: 'minion', atLeast: '10' },
      multiplier: 1,
    },
    {
      id: 'evil-1e3',
      name: 'A Thousand Evil',
      description: 'Earn 1,000 Evil in total.',
      condition: { kind: 'lifetime-evil', atLeast: '1000' },
      multiplier: 1,
    },
    {
      id: 'souls-1',
      name: 'One Soul',
      description: 'Hold a soul.',
      condition: { kind: 'souls', atLeast: '1' },
      multiplier: 1,
    },
    {
      id: 'prestige-1',
      name: 'One Reset',
      description: 'Claim souls once.',
      condition: { kind: 'prestiges', atLeast: 1 },
      multiplier: 1,
    },
    {
      id: 'smite-1',
      name: 'One Smite',
      description: 'Smite once.',
      condition: { kind: 'smites', atLeast: 1 },
      multiplier: 1,
    },
  ],

  unlockFraction: 0.5,

  prestige: { k: 150, scale: '1e11', exponent: 0.5, perSoul: 0.02 },
  offlineCapMs: 4 * 60 * 60 * SECOND,
  // Round numbers, chosen so a whole Minion cycle (24s) fits inside a blow — which is
  // what makes "produced exactly twice as much" a thing a test can assert at all. The
  // ladders are deliberately of unequal length, so a test that walks one off its top
  // proves the code assumes no particular number of rungs.
  smite: {
    cooldownMs: 120_000,
    apathy: { perBlow: 1, cap: 3 },
    climbGrowth: 2,
    upgrades: [
      {
        id: 'weight',
        name: 'Fixture Weight',
        base: 2,
        unit: 'multiplier',
        rungs: [
          { evil: '1000', souls: '5', value: 3 },
          { evil: '4000', souls: '10', value: 4 },
        ],
      },
      {
        id: 'reach',
        name: 'Fixture Reach',
        base: 48_000,
        unit: 'seconds',
        rungs: [{ evil: '2000', souls: '5', value: 72_000 }],
      },
      {
        id: 'forgetting',
        name: 'Fixture Forgetting',
        base: 60_000,
        unit: 'seconds',
        rungs: [{ evil: '3000', souls: '5', value: 30_000 }],
      },
      {
        id: 'restraint',
        name: 'Fixture Restraint',
        base: 0.5,
        unit: 'amount',
        rungs: [{ evil: '5000', souls: '5', value: 0.25 }],
      },
    ],
  },
};

/** Fixture with the tiers reversed, for the order-independence test. */
export const fixtureReversed: Content = {
  ...fixture,
  tiers: [...fixture.tiers].reverse(),
};

/** Fixture that does trip milestones, for testing the multiplier itself. */
export const fixtureWithMilestones: Content = {
  ...fixture,
  milestones: [
    { at: 25, multiplier: 2 },
    { at: 50, multiplier: 2 },
    { at: 100, multiplier: 2 },
  ],
};

/**
 * Fixture whose one achievement grants a real multiplier, proving the hook is live.
 *
 * Kept out of the base fixture on purpose: production numbers that move under an
 * achievement would break the worked example silently.
 */
export const fixtureWithAchievementMultiplier: Content = {
  ...fixture,
  achievements: [
    {
      id: 'minion-10',
      name: 'Ten Minions',
      description: 'Own 10 Minions.',
      condition: { kind: 'tier-owned', tierId: 'minion', atLeast: '10' },
      multiplier: 3,
    },
  ],
};
