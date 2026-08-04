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
 * the growth *exponent*, not a constant. Measured against the four-tier economy this
 * ladder was first fitted to: at ×2 a rung — that is, simply extending the old ladder —
 * it ran 2.2× faster and first prestige fell from 2h46m to 1h17m. At ×1.25 it was
 * 2h14m, at ×1.1 2h28m, and the opening hour was untouched either way.
 *
 * Those three figures are history, not the game. The retune below rebuilt every tier
 * and added a fifth, so re-read them as the reason ×1.1 was picked rather than as
 * anything true of the current run. What the rung is worth now is in the note on `v1`:
 * with five tiers compounding it is the single largest lever on the mid-game, and
 * dropping it to ×1.05 would flatten the steepest stretch of the run by a good deal.
 * No figure is quoted here on purpose: the last one measured was against a build that
 * has since been refitted around the obsolescence rule, and a stale number in two places
 * is worse than none in one.
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
 * The retune of spec `2026-08-04-economy-retune` §5, refitted around the obsolescence
 * rule of the design spec §5.8. Measured, not guessed.
 *
 * Tuned against `pnpm harness`, which reports the numbers below. Change anything
 * here and re-run it; the whole point of the harness is that balance is measurable.
 *
 *   Warrens        10m 53s    first prestige   41m 11s
 *   Dark Legions   39m 35s    souls at 8h      7.4e6
 *   Fortresses     1h 14m     souls at 12h     9.2e7
 *   Thrones        2h 03m
 *
 * The whole chain inside two hours and a reset before the first, which is the evening
 * §5.2 asks for. Every figure lands within a fifth of its target.
 *
 * **The obsolescence points, which the rest of this file is now fitted to** (§5.8.1:
 * the first moment the tier above delivers faster than the whole purse could buy):
 *
 *   Minions       retired 19m 05s at 42 Warrens        boosted 13m 33s    margin  5m 32s
 *   Warrens       retired 1h 24m at 33 Dark Legions    boosted 1h 15m     margin  9m 40s
 *   Dark Legions  retired 2h 24m at 39 Fortresses      boosted 1h 52m     margin 32m 36s
 *   Fortresses    retired 4h 31m at 44 Thrones         boosted 3h 06m     margin 84m 38s
 *
 * Every tier is boosted before it retires the tier below, and the margin widens with
 * depth — the depth factor §5.8 asks for, read off the instrument rather than assumed.
 *
 * When each Overseer first comes within reach, under the harness's policy — which is
 * what the costs below are priced against:
 *
 *   Taskmaster      9m 57s    Quartermaster   1h 01m    Steward       3h 14m
 *   Keeper of Whip 11m 05s    Marshal         1h 20m    Long Hour     3h 33m
 *   Reckoner       11m 51s    Herald          1h 31m    Chancellor    3h 58m
 *   Warden         17m 55s    Castellan       1h 56m
 *   Mistress       47m 17s    Scaffold        2h 07m
 *   Broodkeeper    1h 07m     Quarry          2h 21m
 *
 * Each tier's automator still comes within reach before the tier above does, which is
 * the trade §5.6 wants the player weighing, and it falls out of pricing every automator
 * at 0.4× the next tier's base cost. `goad` and `glut` then sit at ×4 and ×16 of their
 * tier's automator. The gap is wider than it was at the Warren — the Warden lands 17m
 * against a first Legion at 39m — because the Legion's flattened curve buys its opening
 * unit dear and the rest cheap; see below for why that curve had to flatten.
 *
 * **What the obsolescence rule costs, and why it reshaped the file.**
 *
 * A tier is retired when `owned(N+1) × yield × multiplier ÷ cycle` overtakes
 * `income ÷ cost(N)`. Both sides are units of tier N a second, so the crossing lands at
 * a *count* of the tier above, and that count is the only number that matters. The
 * first boost any tier can get is the 25-count milestone, which doubles what it
 * delivers. So unless the crossing lands past fifty units' worth of the tier above, the
 * rung meant to boost a tier is the very thing that kills the tier below it — which is
 * exactly how the pre-rule build read, with Minions retired by two Warrens and Dark
 * Legions retired 28 seconds after the Scaffold was appointed.
 *
 * Two levers reach that count and both were needed.
 *
 * *The retiring tier's own curve, flattened, so the purse keeps up.* The Minion falls
 * 1.07→1.012 with its base raised 50→80. They go opposite ways on purpose: the base is
 * what gates the opening — the first Minion is still bought by hand at about two
 * minutes — while the rate is what decides how long the row stays worth pressing. At
 * 1.07 a Minion doubled in price every ten purchases and the ×2 rungs could not keep
 * pace, so the purse collapsed and two Warrens outran it. At 1.012 the Minion is still
 * a live purchase at forty-two Warrens.
 *
 * *What one unit of the producer hands over, cut, so the count at the crossing rises.*
 * A Dark Legion takes one Warren's worth of ground every ten minutes rather than four
 * every five; a Fortress raises one Legion a half hour and a Throne one Fortress an
 * hour and a half. Fewer per unit means more units before the crossing, and the 25-rung
 * arrives while there is still headroom. Measured on the Warren row: at yield 4 the
 * crossing came at 9 Dark Legions, at yield 2 at 15, at yield 1 on a ten-minute cycle
 * at 37.
 *
 * **The Warren keeps its yield of 5** — it is the only tier above the Minion that
 * still hands over more than one unit a cycle, and on purpose: it sits directly over
 * the tier whose curve is already the brake at this end of the chain (see the Minion
 * paragraph above), so cutting what a Warren breeds would only have widened the
 * Minion's own dead spot at forty-two Warrens rather than pushed the crossing back.
 * Its cycle moved anyway, 90s→60s, for a reason that has nothing to do with the
 * obsolescence rule: it is the lowest tier still worth a tap rather than a rate a
 * player merely owns, and 60s reads as a livelier row without moving a single number
 * anywhere else in this file.
 *
 * What holds the throughput back up differs by tier, and the Dark Legion is the odd one
 * out. The Fortress and the Throne got it back from their base costs, 6e9→3e8 and
 * 5e12→8e11. The Dark Legion's base did not move at all — its curve did, 1.5→1.1, which
 * is what buys the units the cut yield gave away. And the chain did slow a little either
 * way: the first Dark Legion 33m 53s→39m 35s, the first Fortress 1h 08m→1h 14m. Both
 * still land inside their bands, which is the whole of what §5.2 asks.
 *
 * *Cost curves above the Warren, flattened for the same reason from the other side.*
 * Dark Legion 1.5→1.1, Fortress 1.8→1.3, Throne 2.2→1.3. A tier whose price rockets
 * never reaches twenty-five units in time for its own rung, so it can only ever be
 * boosted by a post — and a post priced off the next tier up lands long after the tier
 * below it has died. Flattening the curve is what puts the rung within reach at all.
 *
 * *Base costs, refitted to hold the five times.* Warren 1000→1500, Fortress 6e9→3e8,
 * Throne 5e12→8e11; the Dark Legion keeps 3e7. Twelve of the fifteen Overseer prices
 * moved with them. The Warren's three did not, and could not: they are priced off the
 * Dark Legion's base, which is the one base that stayed put. All fifteen follow the same
 * rule as before — 0.4×, 1.6× and 6.4× the next tier's base cost, the Throne's three
 * extrapolating that ratio, having no tier above to price against.
 *
 * *Souls.* `scale` stays at 5.7e13 and `k` at 150. The two are one lever, not two:
 * souls come out as `k·√(lifetime/scale)`, which is `√(lifetime / (scale/k²))`, so only
 * the ratio has any effect. The first soul lands at 41m and the 40–50 §5.3 asks for at
 * about 1h 47m, which is the first reset actually worth taking. `perSoul` stays 0.02.
 *
 * The Minion tier keeps its **rate** — 2.5 Evil every 4s, 0.625 a second — because that
 * opening pace reads well and it is the one figure the original design docs got right.
 * Only what a Minion costs moved.
 *
 * **Known rough edge.** §4 of the retune spec now measures the cliff in decades an hour
 * rather than in raw jumps between checkpoints, because the checkpoints run from fifteen
 * minutes to four days apart and a raw jump mostly reports the spacing. On Evil per
 * second this build clears it: the steepest stretch after the opening quarter hour is
 * 15m→30m at 4.04 decades an hour against a target of 5, and the 4h→8h stretch that
 * reads as 6.3e4 raw is the fifth calmest hour of the run at 1.20. On lifetime Evil it
 * does not: the same stretch measures 7.59. The rule costs some of that directly — flat
 * cost curves mean counts climb where prices used to, and counts are what the milestone
 * ladder pays on. The lever left is still the tail rung above, and it is still a design
 * call rather than a balance one: a rung worth 5% reads as nothing on a rail row that
 * has to name it.
 */
export const v1: Content = {
  version: '1',

  tiers: [
    {
      id: 'throne',
      name: 'Throne',
      plural: 'Thrones',
      produces: 'fortress',
      yield: '1',
      cycleMs: 90 * MINUTE,
      costResource: 'evil',
      baseCost: '8e11',
      costRate: 1.3,
      overseers: [
        {
          id: 'throne-hand',
          name: 'Steward of the High Seat',
          cost: '8e14',
          effect: { kind: 'automate' },
        },
        {
          id: 'throne-goad',
          name: 'Keeper of the Long Hour',
          cost: '3.2e15',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'throne-glut',
          name: 'Chancellor of Titles',
          cost: '1.28e16',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
      art: 'tier/throne',
    },
    {
      id: 'fortress',
      name: 'Fortress',
      plural: 'Fortresses',
      produces: 'legion',
      yield: '1',
      cycleMs: 30 * MINUTE,
      costResource: 'evil',
      baseCost: '3e8',
      costRate: 1.3,
      overseers: [
        {
          id: 'fortress-hand',
          name: 'Castellan of the Black Keep',
          cost: '3.2e11',
          effect: { kind: 'automate' },
        },
        {
          id: 'fortress-goad',
          name: 'Overseer of the Scaffold',
          cost: '1.28e12',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'fortress-glut',
          name: 'Master of the Quarry',
          cost: '5.12e12',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
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
      baseCost: '3e7',
      costRate: 1.1,
      overseers: [
        {
          id: 'legion-hand',
          name: 'Quartermaster of the Host',
          cost: '1.2e8',
          effect: { kind: 'automate' },
        },
        {
          id: 'legion-goad',
          name: 'Marshal of the Forced March',
          cost: '4.8e8',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'legion-glut',
          name: 'Herald of the Levy',
          cost: '1.92e9',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
      art: 'tier/legion',
    },
    {
      id: 'warren',
      name: 'Warren',
      plural: 'Warrens',
      produces: 'minion',
      yield: '5',
      cycleMs: 60 * SECOND,
      costResource: 'evil',
      baseCost: '1500',
      costRate: 1.25,
      overseers: [
        {
          id: 'warren-hand',
          name: 'Warden of the Warrens',
          cost: '1.2e7',
          effect: { kind: 'automate' },
        },
        {
          id: 'warren-goad',
          name: 'Mistress of the Quickening',
          cost: '4.8e7',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'warren-glut',
          name: 'Broodkeeper',
          cost: '1.92e8',
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
      yield: '2.5',
      cycleMs: 4 * SECOND,
      costResource: 'evil',
      baseCost: '80',
      costRate: 1.012,
      overseers: [
        {
          id: 'minion-hand',
          name: 'Taskmaster of the Pits',
          cost: '600',
          effect: { kind: 'automate' },
        },
        {
          id: 'minion-goad',
          name: 'Keeper of the Whip',
          cost: '2400',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'minion-glut',
          name: 'Reckoner of the Tally',
          cost: '9600',
          effect: { kind: 'swell', factor: 2 },
        },
      ],
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
    // First soul lands at 45m (lifetime = scale / k^2 = 2.53e9).
    scale: '5.7e13',
    perSoul: 0.02,
  },

  offlineCapMs: 4 * HOUR,
  /**
   * A blow lands a little Evil at once and then doubles everything for fifteen
   * seconds, once a minute.
   *
   * Fifteen seconds is longer than a Minion cycle (4s) and well short of a Warren's
   * (60s), which is the window that makes a blow feel like it covered something
   * without letting one press carry a whole tier. At ×2 for 15s in every 60s a player
   * who never misses a cooldown runs about 25% ahead of the idle economy — enough
   * that pressing it is always right, not enough to make §5.2's table a fiction.
   *
   * The harness does not smite, deliberately: it measures the idle economy, and this
   * is the reward for being at the keyboard (spec §5.7).
   */
  smite: {
    seconds: 3,
    durationMs: 15 * SECOND,
    cooldownMs: 60 * SECOND,
    multiplier: 2,
  },
};
