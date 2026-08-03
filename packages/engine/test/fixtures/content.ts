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
      id: 'slum',
      name: 'Slum',
      plural: 'Slums',
      produces: 'minion',
      yield: '100',
      cycleMs: 60 * SECOND,
      costResource: 'evil',
      baseCost: '1500',
      costRate: 1.089,
      art: 'tier/slum',
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
      art: 'tier/minion',
    },
  ],

  // None, deliberately. The worked example is about the cascade; a milestone
  // multiplier firing inside it would silently change every expected number.
  milestones: [],
  milestoneMultiplier: 2,

  prestige: { k: 150, scale: '1e11', perSoul: 0.02 },
  offlineCapMs: 4 * 60 * 60 * SECOND,
  smiteSeconds: 3,
};

/** Fixture with the tiers reversed, for the order-independence test. */
export const fixtureReversed: Content = {
  ...fixture,
  tiers: [...fixture.tiers].reverse(),
};

/** Fixture that does trip milestones, for testing the multiplier itself. */
export const fixtureWithMilestones: Content = {
  ...fixture,
  milestones: [25, 50, 100],
};
