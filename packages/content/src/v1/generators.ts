import type { Content } from '../types.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * First tuned pass. Measured, not guessed — but a first pass, not a final answer.
 *
 * Tuned against `pnpm harness`, which reports the numbers below. Change anything
 * here and re-run it; the whole point of the harness is that balance is measurable.
 *
 *   Warrens        26m        first prestige   2h 46m
 *   Dark Legions   58m        souls at 8h      34
 *   Fortresses     2h 53m     souls at 12h     225
 *
 * The Minion tier keeps the original design docs' figures — 15 Evil every 24s at 90
 * base — because that opening pace reads well. Everything above it was rebuilt.
 *
 * The shape each higher tier aims for is a payback period of tens of minutes: one
 * unit yields one unit of the tier below per cycle, and the cost curve gates how far
 * you can stack it. The first version had a Warren yielding 100 Minions a minute,
 * which paid back its own cost roughly ten times over per minute and detonated the
 * whole economy inside half an hour.
 *
 * Known rough edge: the 30m→1h stretch jumps about 1,100× as the first Dark Legion
 * lands. That is the moment the cascade becomes visible and it should feel like
 * something, but it may want softening once real players have run at it.
 */
export const v1: Content = {
  version: '1',

  tiers: [
    {
      id: 'fortress',
      name: 'Fortress',
      plural: 'Fortresses',
      produces: 'legion',
      yield: '1',
      cycleMs: 30 * MINUTE,
      costResource: 'evil',
      baseCost: '5e9',
      costRate: 1.22,
      art: 'tier/fortress',
    },
    {
      id: 'legion',
      name: 'Dark Legion',
      plural: 'Dark Legions',
      produces: 'warren',
      yield: '1',
      cycleMs: 10 * MINUTE,
      costResource: 'evil',
      baseCost: '2000000',
      costRate: 1.18,
      art: 'tier/legion',
    },
    {
      id: 'warren',
      name: 'Warren',
      plural: 'Warrens',
      produces: 'minion',
      yield: '1',
      cycleMs: 90 * SECOND,
      costResource: 'evil',
      baseCost: '2500',
      costRate: 1.12,
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
      art: 'tier/minion',
    },
  ],

  milestones: [25, 50, 100, 200, 300, 400],
  milestoneMultiplier: 2,

  prestige: {
    k: 150,
    // First soul lands around three hours (lifetime = scale / k^2 = 2.2e10).
    scale: '5e14',
    perSoul: 0.02,
  },

  offlineCapMs: 4 * HOUR,
  smiteSeconds: 3,
};
