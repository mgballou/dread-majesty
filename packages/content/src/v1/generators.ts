import type { Content } from '../types.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * SEEDED VALUES — NOT BALANCED.
 *
 * Minion and Slum figures come from the original design docs. Legion and Fortress
 * figures are invented: no reference doc ever set them. Every number here is a
 * placeholder until `pnpm harness` says otherwise. See spec §5.2.
 */
export const v1: Content = {
  version: '1',

  tiers: [
    {
      id: 'fortress',
      name: 'Fortress',
      plural: 'Fortresses',
      produces: 'legion',
      yield: '5',
      cycleMs: 360 * SECOND,
      costResource: 'evil',
      baseCost: '400000',
      costRate: 1.125,
      art: 'tier/fortress',
    },
    {
      id: 'legion',
      name: 'Dark Legion',
      plural: 'Dark Legions',
      produces: 'slum',
      yield: '10',
      cycleMs: 150 * SECOND,
      costResource: 'evil',
      baseCost: '25000',
      costRate: 1.112,
      art: 'tier/legion',
    },
    {
      id: 'slum',
      name: 'Slum',
      plural: 'Slums',
      produces: 'minion',
      yield: '100',
      cycleMs: 60 * SECOND,
      costResource: 'evil',
      baseCost: '1500',
      costRate: 1.1,
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

  milestones: [25, 50, 100, 200, 300, 400],
  milestoneMultiplier: 2,

  prestige: {
    k: 150,
    scale: '1e11',
    perSoul: 0.02,
  },

  offlineCapMs: 4 * HOUR,
  smiteSeconds: 3,
};
