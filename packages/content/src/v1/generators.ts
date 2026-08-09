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
 *   Warrens        10m 57s    first prestige   41m 51s
 *   Dark Legions   40m 35s    souls at 8h      3.6e6
 *   Fortresses     1h 22m     souls at 12h     6.4e7
 *   Thrones        2h 29m
 *
 * Thrones now land past two hours, with a reset well before the first — still the
 * evening §5.2 asks for, but no longer the two-hour chain this section once measured.
 * The top two tiers moved because of this task's repricing, and no generator number
 * caused it: the harness's player pays for Overseer posts out of whatever cash the
 * generator stack leaves behind, and the dearer `goad` and `glut` posts below hold
 * back more of that cash, so Fortresses and Thrones both arrive later.
 *
 * **The obsolescence points, which the rest of this file is now fitted to** (§5.8.1:
 * the first moment the tier above delivers faster than the whole purse could buy):
 *
 *   Minions       retired 19m 18s at 41 Warrens        boosted 14m 19s    margin   4m 59s
 *   Warrens       retired 1h 28m at 29 Dark Legions    boosted 1h 23m     margin   5m 02s
 *   Dark Legions  retired 3h 22m at 47 Fortresses      boosted 2h 16m     margin  65m 58s
 *   Fortresses    retired 5h 28m at 49 Thrones         boosted 3h 47m     margin 100m 46s
 *
 * These four crossings moved from the numbers this section once carried — Minions and
 * Warrens retire a few minutes later, Dark Legions and Fortresses close to an hour
 * later — for the same reason the top table did: dearer `goad` and `glut` posts hold
 * back cash the tier above needs to arrive. Every tier is still boosted before it
 * retires the tier below, and the margin still widens with depth — the depth factor
 * §5.8 asks for, read off the instrument rather than assumed.
 *
 * When each Overseer first comes within reach, under the harness's policy — which is
 * what the costs below are priced against:
 *
 *   Taskmaster     10m 01s    Quartermaster   1h 04m    Steward       3h 55m
 *   Keeper of Whip 12m 37s    Marshal         1h 49m    Long Hour     4h 40m
 *   Reckoner       13m 49s    Herald          2h 04m    Chancellor    5h 21m
 *   Warden         19m 07s    Castellan       2h 21m
 *   Mistress       1h 19m     Scaffold        2h 51m
 *   Broodkeeper    1h 49m     Quarry          3h 22m
 *
 * Each tier's automator still comes within reach before the tier above does, which is
 * the trade §5.6 wants the player weighing, and it falls out of pricing every automator
 * at 0.4× the next tier's base cost. `goad` and `glut` then sit at ×20 and ×200 of their
 * tier's automator, not the old ×4 and ×16 — and the old ratios were not too cheap
 * because they arrived early: seven of the ten landed past the first hour. They were
 * too cheap because a flat ratio buys a shrinking share of a growing income. Income
 * compounds; a fixed multiple of the automator does not, so the later a post came
 * within reach, the smaller the slice of that hour's income it actually cost — and by
 * the first hour the whole tree ran about thirty seconds of it. The gap is wider than
 * it was at the Warren — the Warden lands 19m against a first Legion at 40m — because
 * the Legion's flattened curve buys its opening unit dear and the rest cheap; see below
 * for why that curve had to flatten.
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
 * 1.07→1.012 with its base raised 50→160. They go opposite ways on purpose: the base is
 * what gates the opening — the first Minion is still bought by hand at about two
 * minutes — while the rate is what decides how long the row stays worth pressing. At
 * 1.07 a Minion doubled in price every ten purchases and the ×2 rungs could not keep
 * pace, so the purse collapsed and two Warrens outran it. At 1.012 the Minion is still
 * a live purchase at forty-one Warrens.
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
 * still hands over more than one unit a cycle. It needs no cut: the Minion's own cost
 * curve is already flat enough, at a rate of 1.012, that nothing retires it too early
 * (see the Minion paragraph above), so the crossing is bought on the Minion's side
 * rather than by cutting what a Warren breeds. Its cycle moved anyway, 90s→60s, for a
 * reason that has nothing to do with the obsolescence rule: 60s reads as a livelier
 * row without moving a single number anywhere else in this file.
 *
 * What holds the throughput back up differs by tier, and the Dark Legion is the odd one
 * out. The Fortress and the Throne got it back from their base costs, cut from 6e9 to
 * 6e8 and from 5e12 to 1.6e12. The Dark Legion's base was never cut — it only doubled,
 * 3e7→6e7, with every other price in the file when the Evil scale did. What buys back
 * the units its cut yield gave away is its curve, 1.5→1.1. And the chain did slow a
 * little either way: the first Dark Legion now lands at 40m 35s and the first Fortress
 * at 1h 22m 53s. Both still land inside their bands, which is the whole of what §5.2
 * asks.
 *
 * *Cost curves above the Warren, flattened for the same reason from the other side.*
 * Dark Legion 1.5→1.1, Fortress 1.8→1.3, Throne 2.2→1.3. A tier whose price rockets
 * never reaches twenty-five units in time for its own rung, so it can only ever be
 * boosted by a post — and a post priced off the next tier up lands long after the tier
 * below it has died. Flattening the curve is what puts the rung within reach at all.
 *
 * *Base costs, refitted to hold the five times.* Warren 1000→3000, Fortress 6e9→6e8,
 * Throne 5e12→1.6e12, Dark Legion 3e7→6e7. All fifteen Overseer prices moved with them,
 * because all fifteen follow one rule, in two equal forms: the automator sits at 0.4×
 * the next tier's base cost, and `goad` and `glut` sit at 8× and 80× of it — the same
 * 0.4× run through the ×20/×200-of-automator rule above, since 20 × 0.4 = 8 and
 * 200 × 0.4 = 80. The Throne's three extrapolate that ratio, having no tier above to
 * price against.
 *
 * *Souls.* `scale` is 5.07e9, `k` 600, `exponent` 0.055 and `perSoul` 0.001. Souls come
 * out as `k·(lifetime/scale)^exponent`. The first soul still lands at 41m 51s, which is
 * what `scale` names; the curve past it is far flatter than the square root it replaced,
 * because the square root let each reset raise the soul count to about the ninth power.
 * A run pays roughly 600 souls at 41m, 1,230 at three hours and 4,340 at twelve. `k` and
 * `perSoul` multiply to 0.6 and only that product matters to the balance.
 *
 * The Minion tier keeps its **opening pace** — 5 Evil every 4s, 1.25 a second. The yield
 * doubled with the rest of the Evil scale, so what a Minion is worth against everything
 * else has not moved, and that pace is the one figure the original design docs got
 * right. Only what a Minion costs was tuned.
 *
 * **Known rough edge.** §4 of the retune spec now measures the cliff in decades an hour
 * rather than in raw jumps between checkpoints, because the checkpoints run from fifteen
 * minutes to four days apart and a raw jump mostly reports the spacing. On Evil per
 * second this build clears it: the steepest stretch after the opening quarter hour is
 * 15m→30m at 4.7 decades an hour against a target of 5, and the 4h→8h stretch that
 * reads as 1.6e5 raw is among the calmest of the run at 1.3. On lifetime Evil it does
 * not: the same 15m→30m stretch measures 8.8. The rule costs some of that directly — flat
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
      baseCost: '1.6e12',
      costRate: 1.3,
      overseers: [
        {
          id: 'throne-hand',
          name: 'Steward of the High Seat',
          cost: '1.6e15',
          effect: { kind: 'automate' },
        },
        {
          id: 'throne-goad',
          name: 'Keeper of the Long Hour',
          cost: '3.2e16',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'throne-glut',
          name: 'Chancellor of Titles',
          cost: '3.2e17',
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
      baseCost: '6e8',
      costRate: 1.3,
      overseers: [
        {
          id: 'fortress-hand',
          name: 'Castellan of the Black Keep',
          cost: '6.4e11',
          effect: { kind: 'automate' },
        },
        {
          id: 'fortress-goad',
          name: 'Overseer of the Scaffold',
          cost: '1.28e13',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'fortress-glut',
          name: 'Master of the Quarry',
          cost: '1.28e14',
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
      baseCost: '6e7',
      costRate: 1.1,
      overseers: [
        {
          id: 'legion-hand',
          name: 'Quartermaster of the Host',
          cost: '2.4e8',
          effect: { kind: 'automate' },
        },
        {
          id: 'legion-goad',
          name: 'Marshal of the Forced March',
          cost: '4.8e9',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'legion-glut',
          name: 'Herald of the Levy',
          cost: '4.8e10',
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
      baseCost: '3000',
      costRate: 1.25,
      overseers: [
        {
          id: 'warren-hand',
          name: 'Warden of the Warrens',
          cost: '2.4e7',
          effect: { kind: 'automate' },
        },
        {
          id: 'warren-goad',
          name: 'Mistress of the Quickening',
          cost: '4.8e8',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'warren-glut',
          name: 'Broodkeeper',
          cost: '4.8e9',
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
      yield: '5',
      cycleMs: 4 * SECOND,
      costResource: 'evil',
      baseCost: '160',
      costRate: 1.012,
      overseers: [
        {
          id: 'minion-hand',
          name: 'Taskmaster of the Pits',
          cost: '1200',
          effect: { kind: 'automate' },
        },
        {
          id: 'minion-goad',
          name: 'Keeper of the Whip',
          cost: '24000',
          effect: { kind: 'quicken', factor: 2 },
        },
        {
          id: 'minion-glut',
          name: 'Reckoner of the Tally',
          cost: '240000',
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
    // `k` and `perSoul` are one lever: favour is `1 + perSoul * k * (L/scale)^exponent`,
    // so their product, 0.6, is the whole of the balance and `k` alone decides what the
    // player reads. Six hundred is a display choice — souls in the hundreds and
    // thousands at a tenth of a percent each, because a prestige currency reading `2`
    // reads as broken whatever the arithmetic underneath. Any pair holding the product
    // at 0.6 plays identically; changing one without the other moves the plateau.
    k: 600,
    // Lifetime Evil at 41m 51s, where the first soul has always landed.
    scale: '5.07e9',
    // Not a free choice. The old 0.5 made each reset raise the soul count to about the
    // ninth power, so favour ran ×12, then ×634, then past anything the simulation could
    // carry. See §1 and §2.1 of the 2026-08-08 soul curve spec for the measurement and
    // for when this has to be re-derived — it is tied to how fast the generator economy
    // grows, not to prestige.
    exponent: 0.055,
    perSoul: 0.001,
  },

  offlineCapMs: 4 * HOUR,
  smite: {
    // Flat, and on no ladder. See SmiteDef's note on why escalating it cannot work.
    cooldownMs: 20 * SECOND,
    apathy: { perBlow: 1, cap: 3 },
    // A seed, like every balance number here. Each reset roughly doubles production via
    // souls and shortens the run, so tripling the climb keeps a rung a real decision on
    // the third run rather than a rounding error. The harness settles it.
    climbGrowth: 3,
    // Reach first: it is the cheapest, and uptime is the effect a player feels before
    // they have worked out what Apathy is doing.
    //
    // Rung prices climb ×200, not the ×12 they shipped at. Lifetime Evil spans ×3.9
    // million between fifteen minutes and two hours, and four rungs at ×12 span ×1,728
    // — so the ladder covered a five-hundredth of the run it lives in, and the whole
    // tree cost thirty-two seconds of income. The slope is what fixes that; raising
    // every price by a constant only moves which slice it covers. See the 2026-08-06
    // post-smite-tuning spec §4.1 for the measured curve.
    upgrades: [
      {
        id: 'reach',
        name: 'Reach',
        base: 15 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '3e6', souls: '8', value: 17 * SECOND },
          { evil: '6e8', souls: '20', value: 19 * SECOND },
          { evil: '1.2e11', souls: '50', value: 21 * SECOND },
          { evil: '2.4e13', souls: '120', value: 23 * SECOND },
        ],
      },
      {
        id: 'weight',
        name: 'Weight',
        base: 2,
        unit: 'multiplier',
        rungs: [
          { evil: '6e6', souls: '8', value: 2.25 },
          { evil: '1.2e9', souls: '20', value: 2.5 },
          { evil: '2.4e11', souls: '50', value: 2.75 },
          { evil: '4.8e13', souls: '120', value: 3 },
        ],
      },
      {
        id: 'forgetting',
        name: 'Forgetting',
        base: 45 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '1.2e7', souls: '8', value: 40 * SECOND },
          { evil: '2.4e9', souls: '20', value: 36 * SECOND },
          { evil: '4.8e11', souls: '50', value: 32 * SECOND },
          { evil: '9.6e13', souls: '120', value: 30 * SECOND },
        ],
      },
      {
        id: 'restraint',
        name: 'Restraint',
        base: 0.25,
        unit: 'amount',
        rungs: [
          { evil: '1.8e7', souls: '8', value: 0.225 },
          { evil: '3.6e9', souls: '20', value: 0.2 },
          { evil: '7.2e11', souls: '50', value: 0.175 },
          { evil: '1.44e14', souls: '120', value: 0.15 },
        ],
      },
    ],
  },
};
