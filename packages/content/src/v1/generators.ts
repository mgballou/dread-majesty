import type { Content, MilestoneDef } from '../types.ts';
import { v1Achievements } from './achievements.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * The tuned opening. **Do not move these.** The first hour was balanced against
 * exactly these six thresholds at exactly ×2, and the harness table below is what
 * they produce.
 */
const TUNED_MILESTONES: readonly MilestoneDef[] = [25, 50, 100, 200, 300, 400].map((at) => ({
  at,
  multiplier: 2,
}));

/**
 * The tail, so a rail row always has a next goal to name.
 *
 * Thresholds double and each rung is worth a tenth more. Both halves matter.
 * Doubling keeps rungs arriving at a steady rate however large the count grows; the
 * small multiplier keeps a ladder that never ends from setting the pace of the whole
 * game.
 *
 * That second half is the whole reason `MilestoneDef` carries a multiplier at all.
 * A rung worth ×m makes output scale as `count^(1 + log2 m)`, so the rung value sets
 * the growth *exponent*, not a constant. Measured, at ×2 a rung — that is, simply
 * extending the old ladder — the economy ran 2.2× faster and first prestige fell from
 * 2h46m to 1h17m. At ×1.25 it was 2h14m. At ×1.1 it is 2h28m, and the opening hour is
 * untouched either way.
 *
 * It runs to 1e21 because generator counts do. Sixty-odd entries is a cheap list, and
 * the engine stops walking at the first threshold a count has not reached.
 */
const TAIL_MILESTONES: readonly MilestoneDef[] = (() => {
  const rungs: MilestoneDef[] = [];
  for (let at = 800; at <= 1e21; at *= 2) rungs.push({ at, multiplier: 1.1 });
  return rungs;
})();

/**
 * First tuned pass. Measured, not guessed — but a first pass, not a final answer.
 *
 * Tuned against `pnpm harness`, which reports the numbers below. Change anything
 * here and re-run it; the whole point of the harness is that balance is measurable.
 *
 *   Warrens        28m        first prestige   2h 29m
 *   Dark Legions   1h 01m     souls at 8h      243
 *   Fortresses     2h 37m     souls at 12h     2,338
 *
 * Recorded against the milestone ladder below. The opening — first Warren, first Dark
 * Legion — is within a couple of minutes of the six-rung ladder these tiers were
 * tuned against. The first Fortress and the first prestige come about 12% early, and
 * the long game runs richer: souls at 8h are 243 rather than 34.
 *
 * That richness is inherent, not a mistake. A ladder that never stops issuing raises
 * the growth exponent, and issuing for ever is the point (spec §5.3). It lands where
 * the design wanted anyway: 243 souls is ×5.9, and §5.4 aims for a first reset in the
 * 6–12h band at ×1.7 to ×5.5.
 *
 * Every figure above moved by a minute or two when the harness took on §5.6, and no
 * number in this file moved to do it. The harness now buys Overseers out of the same
 * Evil the generators come from, and rouses a manual tier the slice after its cycle
 * frees. It costs the run a little, which is the honest answer.
 *
 * When each Overseer first comes within reach, under that same policy — which is what
 * the costs below are priced by feel against:
 *
 *   Minions        20m        Dark Legions     2h 23m
 *   Warrens        57m        Fortresses       5h 43m
 *
 * The Minion tier keeps the original design docs' **rate** — 0.625 Evil a second at 90
 * base — because that opening pace reads well. Everything above it was rebuilt.
 *
 * That rate now arrives as 2.5 Evil every 4s rather than 15 every 24s. It is the same
 * figure to the last digit, so not one number in the table above moved. The cycle was
 * shortened for the manual layer of §5.6: a tier you tap once and then watch for 24
 * seconds is dead air, and AdVenture Capitalist runs its opening business on a 0.6s
 * cycle for exactly that reason.
 *
 * Overseer costs sit at roughly 0.4× the next tier's base cost, so appointing one
 * competes directly with reaching the tier above — which is the trade the player
 * should be weighing. The Fortress has no tier above it and extrapolates the ratio.
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
      overseerCost: '5e12',
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
      overseerCost: '2e9',
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
      overseerCost: '800000',
      art: 'tier/warren',
    },
    {
      id: 'minion',
      name: 'Minion',
      plural: 'Minions',
      produces: 'evil',
      yield: '2.5',
      cycleMs: 4 * SECOND,
      costResource: 'evil',
      baseCost: '90',
      costRate: 1.089,
      overseerCost: '1000',
      art: 'tier/minion',
    },
  ],

  /**
   * The tuned opening, then a tail that never stops issuing. See both constants
   * above — that is where the reasoning and the measurements are.
   */
  milestones: [...TUNED_MILESTONES, ...TAIL_MILESTONES],

  achievements: v1Achievements,

  // Half the next unit's cost. See the note on Content.unlockFraction.
  unlockFraction: 0.5,

  prestige: {
    k: 150,
    // First soul lands around three hours (lifetime = scale / k^2 = 2.2e10).
    scale: '5e14',
    perSoul: 0.02,
  },

  offlineCapMs: 4 * HOUR,
  smiteSeconds: 3,
};
