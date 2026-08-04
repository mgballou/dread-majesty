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
 * dropping it to ×1.05 would flatten the steepest stretch of the run about fivefold.
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
 * The retune of spec `2026-08-04-economy-retune` §5. Measured, not guessed.
 *
 * Tuned against `pnpm harness`, which reports the numbers below. Change anything
 * here and re-run it; the whole point of the harness is that balance is measurable.
 *
 *   Warrens        11m 53s    first prestige   45m 03s
 *   Dark Legions   33m 53s    souls at 8h      8.2e6
 *   Fortresses     1h 08m     souls at 12h     1.6e8
 *   Thrones        2h 00m
 *
 * The whole chain inside two hours and a reset before the first, which is the evening
 * §5.2 asks for. Every figure lands within a few per cent of its target.
 *
 * When each Overseer first comes within reach, under the harness's policy — which is
 * what the costs below are priced against:
 *
 *   Taskmaster      8m 25s    Quartermaster   1h 02m    Steward       3h 08m
 *   Keeper of Whip 13m 37s    Marshal         1h 12m    Long Hour     3h 25m
 *   Reckoner       15m 59s    Herald          1h 20m    Chancellor    3h 44m
 *   Warden         28m 39s    Castellan       1h 51m
 *   Mistress       38m 17s    Scaffold        2h 05m
 *   Broodkeeper    48m 15s    Quarry          2h 22m
 *
 * Each tier's automator comes within reach a few minutes before the tier above does —
 * Taskmaster 8m against the first Warren at 11m, Warden 28m against the first Legion
 * at 33m, Quartermaster 1h02m against the first Fortress at 1h08m, Castellan 1h51m
 * against the first Throne at 2h. That gap is the trade §5.6 wants the player weighing,
 * and it falls out of pricing every automator at 0.4× the next tier's base cost. The
 * Throne has no tier above it and extrapolates the ratio. `goad` and `glut` then sit at
 * ×4 and ×16 of their tier's automator, so both land after the tier above has arrived.
 *
 * **What moved, and why.**
 *
 * *Yields.* Every tier above Minions used to hand over one unit a cycle. A Warren now
 * breeds five Minions, a Legion takes four Warrens' worth of ground, a Fortress raises
 * two Legions and a Throne two Fortresses. That is §5.1, and on its own it made the
 * game roughly four times too fast — the costs below are what took it back.
 *
 * *Cost curves.* Every `costRate` above the Minion rose steeply — 1.12→1.25, 1.18→1.5,
 * 1.22→1.8 and 1.26→2.2 — while the Minion's fell, 1.089→1.07. They go opposite ways
 * because they do opposite jobs. Above the Minion the curve is the brake on the raised
 * yields, and it had to be reset: §2 moved cost off `owned` and onto `purchased`, so a
 * curve no longer compounds against the units the cascade hands out free, and the same
 * nominal rate is a far weaker brake than it used to be. The Minion is not braking
 * anything — it is the row a player presses for the whole run, so flattening it keeps
 * the bottom of the rail worth pressing, which is the whole of §1.1.
 *
 * *Cycles, at the two tiers a player watches.* The Warren drops 90s→60s and the Legion
 * 10m→5m. The Fortress keeps 30m and the Throne 90m: at the top the cycle is a rate
 * control rather than a tap rhythm, since a player owning Thrones has the Steward, and
 * a long cycle up there is the cheapest brake on the mid-game that costs nothing in
 * feel.
 *
 * *Souls.* `scale` falls 5e14→5.7e13, which lands the first soul at 45m rather than
 * three hours. Note that `k` and `scale` are one lever, not two: souls come out as
 * `k·√(lifetime/scale)`, which is `√(lifetime / (scale/k²))`, so only the ratio has any
 * effect and `k` stays at 150. Choosing when the first soul lands therefore fixes how
 * many souls every later moment pays. The gain reaches the 40–50 §5.3 asks for at about
 * 1h 30m, which is the first reset actually worth taking; at 45m it is worth exactly
 * one soul, which nobody would take. `perSoul` stays at 0.02.
 *
 * The Minion tier keeps its **rate** — 2.5 Evil every 4s, 0.625 a second — because that
 * opening pace reads well and it is the one figure the original design docs got right.
 * Only what a Minion costs moved: 90→50 base, so the first purchase lands at 80 seconds
 * instead of 144.
 *
 * **Known rough edge, and it is worse than it was.** The steepest stretch between two
 * adjacent harness checkpoints is 4h→8h, where Evil per second multiplies by about
 * 3.0e4 (lifetime Evil by 6.8e4). §4 asks for no stretch worth more than about 100×.
 * That target is not reachable at these times and this is the flattest shape found that
 * still hits them: the game has to climb from a hundred Minions at 15m to a five-tier
 * cascade by 2h, and compressing the schedule roughly twofold squares the ratio between
 * checkpoints that are themselves a doubling apart. The pre-retune build measured about
 * 1.3e4 over the same span at half the pace. One lever is left and was left alone:
 * dropping the tail rung below to ×1.05 and re-solving the base costs takes this to
 * about 5.5e3, flatter than the build it replaces, but a rung worth 5% reads as nothing
 * on a rail row that has to name it. That is a design call, not a balance one.
 */
export const v1: Content = {
  version: '1',

  tiers: [
    {
      id: 'throne',
      name: 'Throne',
      plural: 'Thrones',
      produces: 'fortress',
      yield: '2',
      cycleMs: 90 * MINUTE,
      costResource: 'evil',
      baseCost: '5e12',
      costRate: 2.2,
      overseers: [
        {
          id: 'throne-hand',
          name: 'Steward of the High Seat',
          cost: '2e15',
          effect: { kind: 'automate' },
        },
        {
          id: 'throne-goad',
          name: 'Keeper of the Long Hour',
          cost: '8e15',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'throne-glut',
          name: 'Chancellor of Titles',
          cost: '3.2e16',
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
      yield: '2',
      cycleMs: 30 * MINUTE,
      costResource: 'evil',
      baseCost: '6e9',
      costRate: 1.8,
      overseers: [
        {
          id: 'fortress-hand',
          name: 'Castellan of the Black Keep',
          cost: '2e12',
          effect: { kind: 'automate' },
        },
        {
          id: 'fortress-goad',
          name: 'Overseer of the Scaffold',
          cost: '8e12',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'fortress-glut',
          name: 'Master of the Quarry',
          cost: '3.2e13',
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
      yield: '4',
      cycleMs: 5 * MINUTE,
      costResource: 'evil',
      baseCost: '3e7',
      costRate: 1.5,
      overseers: [
        {
          id: 'legion-hand',
          name: 'Quartermaster of the Host',
          cost: '2.4e9',
          effect: { kind: 'automate' },
        },
        {
          id: 'legion-goad',
          name: 'Marshal of the Forced March',
          cost: '9.6e9',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'legion-glut',
          name: 'Herald of the Levy',
          cost: '3.84e10',
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
      baseCost: '1000',
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
      baseCost: '50',
      costRate: 1.07,
      overseers: [
        {
          id: 'minion-hand',
          name: 'Taskmaster of the Pits',
          cost: '400',
          effect: { kind: 'automate' },
        },
        {
          id: 'minion-goad',
          name: 'Keeper of the Whip',
          cost: '1600',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'minion-glut',
          name: 'Reckoner of the Tally',
          cost: '6400',
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
