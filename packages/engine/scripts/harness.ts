/**
 * Balance harness.
 *
 * Runs the engine headless with a scripted buying policy and reports how long the
 * milestones a player cares about actually take. This is how balance stops being a
 * guess. It is a script, not a test — it must never gate CI.
 *
 *   pnpm harness
 *
 * Slices are 1s rather than the live 100ms. Every cycle duration in the content is a
 * whole number of seconds, so completions stay exact and the run goes ten times
 * faster. If a sub-second cycle is ever added, drop this back to BASE_DT_MS.
 *
 * The simulated player taps perfectly: every manual tier is roused the instant its
 * cycle frees, and an Overseer is appointed as soon as one is affordable. That is
 * deliberate (spec §5.6). The harness measures the idle economy, exactly as §5.2
 * tuned it; a harness that modelled imperfect tapping would be measuring a guess
 * about players rather than the economy. What it reports instead is *when* each
 * Overseer first comes within reach, and the manual layer is then priced by feel
 * against those times.
 */
import Decimal from 'break_eternity.js';
import {
  CURRENT,
  type Content,
  type OverseerDef,
  type OverseerId,
  type TierDef,
  type TierId,
} from '@dm/content';
import { apply } from '../src/intents.ts';
import { effectiveCycleMs, effectiveYield, hasPost } from '../src/roster.ts';
import { createState } from '../src/state.ts';
import { step, tierMultiplier } from '../src/step.ts';
import { costOfNth, maxAffordable } from '../src/cost.ts';
import {
  canAppoint,
  globalMultiplier,
  isRousable,
  overseenProductionPerSecond,
  prestigeGain,
  productionPerSecond,
} from '../src/selectors.ts';
import type { GameState } from '../src/types.ts';

const DT_MS = 1000;
const SIMULATED_DAYS = 7;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long `delivered(N) >= purchasable(N)` (spec §5.8.1) must hold without
 * interruption before the crossing counts as the obsolescence point, rather than a
 * flicker while counts are still churning near the boundary. Chosen in the spec, not
 * derived — it only has to be long enough that a single second of noise cannot pass
 * for a trend.
 */
const OBSOLESCENCE_HOLD_MS = 60 * 1000;

/**
 * The first row is 5m because 15m used to be the floor, and a floor hides whatever
 * happens under it. Normalised for interval length, the opening is by some way the
 * steepest stretch of the whole run, and nothing measured it. It is not even, either:
 * this row split the opening quarter hour into 9.3 decades an hour for the first five
 * minutes and 28.2 for the next ten, which is where the Taskmaster, the first Warren
 * and three Minion milestone rungs all land. See §4 of the retune spec.
 *
 * This adds a sample. It changes no measurement: every other row of the table, and
 * every figure above it, reads identically with and without it. The 10m row is there
 * for the same reason and on the same terms — the opening question is asked in
 * minutes, and 5m to 15m is too wide a gap to answer it in.
 */
const CHECKPOINTS = [
  ['5m', 5 * MINUTE],
  ['10m', 10 * MINUTE],
  ['15m', 15 * MINUTE],
  ['30m', 30 * MINUTE],
  ['1h', HOUR],
  ['2h', 2 * HOUR],
  ['4h', 4 * HOUR],
  ['8h', 8 * HOUR],
  ['12h', 12 * HOUR],
  ['1d', DAY],
  ['3d', 3 * DAY],
  ['7d', 7 * DAY],
] as const;

/**
 * Each second: buy, then appoint, then rouse.
 *
 * **Buying comes first, always.** The buying policy is the instrument's calibration
 * (spec §5.7) — every number in §5.2 is the output of it — so an Overseer may only
 * ever be paid for out of what the buying pass left behind. Reversing the order
 * would let appointments starve the generator stack and quietly re-tune the whole
 * economy. Overseers are then taken cheapest first, so the early ones land as soon
 * as they are within reach rather than waiting behind a Castellan.
 *
 * The buying pass itself is one of every tier that is affordable, richest first. Not
 * optimal play, but far closer to it than only ever buying the top tier — a real
 * player keeps stacking the cheap tiers while saving for the expensive ones.
 *
 * Rousing comes last because a tier bought or freed this second is then already
 * turning when the next slice runs. That is the perfect tapping the header explains.
 *
 * **All fifteen posts are in play, cheapest across the whole chain first** — not
 * cheapest within a tier, not tier order. An early automator lands as soon as it is
 * within reach rather than waiting behind a Castellan's quicken or swell. Buying
 * still comes first (see above): a post is only ever paid for out of the change the
 * generator stack left behind.
 */
function decide(state: GameState, content: Content): void {
  for (const tier of content.tiers) {
    if (maxAffordable(state, content, tier.id) >= 1) {
      apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 });
    }
  }

  const posts = content.tiers
    .flatMap((tier) => tier.overseers)
    .sort((one, other) => {
      const a = new Decimal(one.cost);
      const b = new Decimal(other.cost);
      if (a.gt(b)) return 1;
      if (a.lt(b)) return -1;
      return 0;
    });

  for (const post of posts) {
    if (canAppoint(state, content, post.id)) {
      apply(state, content, { kind: 'appoint', overseerId: post.id });
    }
  }

  for (const tier of content.tiers) {
    if (isRousable(state, content, tier.id)) {
      apply(state, content, { kind: 'rouse', tierId: tier.id });
    }
  }

  // The simulated player records progress at the same cadence the real one does.
  // Every shipping achievement grants a multiplier of 1, so this changes no number
  // in the table today — but the moment one of them grants more, a harness that
  // never recorded them would quietly report a slower game than the one shipped.
  apply(state, content, { kind: 'record-achievements' });
  apply(state, content, { kind: 'record-unlocks' });
}

/**
 * The moment tier `N` stopped being worth buying by hand, per spec §5.8.1 — snapshot
 * of the crossing the instant it first held, not the instant the 60-second hold
 * confirmed it (see `OBSOLESCENCE_HOLD_MS`).
 *
 * **Why this is measured off the simulation and not off `railPlan`.** "The moment the
 * rail stops lifting tier N" is the more obvious question, and `railPlan` already
 * scores every spend, so reaching for it here is the first thing anyone tidying this
 * file will try. Two reasons not to, both from spec §5.8.1. `railPlan` lives in
 * `apps/web`, and the harness importing it would run the dependency backwards —
 * `web → engine → content-types` is one-way, and this is the only place that would
 * break it without a lint rule or a test catching the break. And `railPlan` scores
 * against a 600-second horizon, so importing it would fold that horizon into the
 * balance, where nobody would ever find it. The definition below depends on nothing
 * but the simulation and the two selectors §5.8.1 names.
 */
interface ObsolescencePoint {
  ms: number;
  /** `owned(N+1)` at the crossing — the count of the tier above that retired this one. */
  owned: Decimal;
  /** `delivered(N)` at the crossing — the rate that did it. */
  delivered: Decimal;
}

function run(content: Content): void {
  const state = createState(content);
  // Lowest tier first, matching every other table in this report; the three posts
  // within a tier stay in content order (automate, then quicken, then swell).
  const posts = [...content.tiers]
    .reverse()
    .flatMap((tier) => tier.overseers.map((post) => ({ tier, post })));

  // Every tier paired with the one tier above it that produces it — built once, not
  // per slice, since neither side of the pairing changes during the run. The top
  // tier (nothing produces it) drops out here, which is why a five-tier chain yields
  // four pairs rather than five (spec §5.8.1). Lowest tier first, matching `posts`.
  //
  // `boostPosts` is the producer's `quicken`/`swell` posts only — never `automate`.
  // The simulated player taps a manual tier the instant its cycle frees (this file's
  // header), so appointing an automator changes that tier's output by nothing at
  // all; it only removes the tap. `quicken` and `swell` are the only posts that
  // change what the tier above actually delivers, which is what the 2026-08-04
  // sharpening of §5.8 asks "was this tier boosted" to mean.
  const obsolescencePairs: Array<{
    tier: TierDef;
    producer: TierDef;
    boostPosts: readonly OverseerDef[];
  }> = [];
  for (const tier of [...content.tiers].reverse()) {
    const producer = content.tiers.find((candidate) => candidate.produces === tier.id);
    if (!producer) continue;
    const boostPosts = producer.overseers.filter(
      (post) => post.effect.kind === 'quicken' || post.effect.kind === 'swell',
    );
    obsolescencePairs.push({ tier, producer, boostPosts });
  }

  // The lowest milestone threshold, the other half of "boosted" alongside a
  // quicken/swell post. `content.milestones[0]` is `undefined` only for content
  // with no milestones at all, which no shipping tier list has; treated as "this
  // producer can never be boosted by count", never as a crash.
  const firstMilestoneAt = content.milestones[0]?.at ?? null;

  const firstOwned = new Map<string, number>();
  // First moment the player *bought* one of a tier, as opposed to owning one. They
  // differ only for the tier the run starts holding one of, which is the whole point:
  // "time to first purchase" is the opening's own measurement and nothing else
  // reports it.
  const firstPurchaseAt = new Map<string, number>();
  const overseerAffordableAt = new Map<OverseerId, number>();
  const overseerAppointedAt = new Map<OverseerId, number>();
  // In-progress crossing per tier: the moment `delivered >= purchasable` first held,
  // held onto in case the next second breaks it and the candidate must be discarded.
  const obsolescenceCandidate = new Map<TierId, ObsolescencePoint>();
  const obsolescenceAt = new Map<TierId, ObsolescencePoint>();
  // First moment each producer tier was boosted — keyed by the producer, not the
  // tier it retires, since a boost is a fact about the producer alone.
  const firstBoostAt = new Map<TierId, number>();
  // Lifetime Evil at each checkpoint, keyed by the same label as `rows` — read by
  // `growthExponent` below so it need not re-run the simulation to get the 2h/4h/8h
  // samples the soul curve was fitted against.
  const checkpointLifetimeEvil = new Map<string, Decimal>();
  const rows: string[] = [];
  let firstPrestigeMs: number | null = null;

  const totalMs = SIMULATED_DAYS * DAY;
  let elapsed = 0;
  let nextCheckpoint = 0;

  while (elapsed < totalMs) {
    step(state, content, DT_MS);
    elapsed += DT_MS;

    // Read before the buying pass spends anything, so this answers "could the player
    // have appointed at this moment", not "was there change left afterwards".
    for (const { post } of posts) {
      if (!overseerAffordableAt.has(post.id) && canAppoint(state, content, post.id)) {
        overseerAffordableAt.set(post.id, elapsed);
      }
    }

    decide(state, content);

    for (const tier of content.tiers) {
      if (!firstOwned.has(tier.id) && state.gens[tier.id].owned.gte(1)) {
        firstOwned.set(tier.id, elapsed);
      }
      if (!firstPurchaseAt.has(tier.id) && state.gens[tier.id].purchased.gte(1)) {
        firstPurchaseAt.set(tier.id, elapsed);
      }
    }

    // The obsolescence point (spec §5.8.1). `overseenProductionPerSecond` is the same
    // for every tier this second — it does not depend on which tier N is being
    // checked — so it is computed once here rather than once per pair.
    //
    // Degenerate cases, both handled by the single `purchasable.gt(0)` guard below:
    //
    //   - No Evil income is automated yet (`income` is 0, so `purchasable` is 0 for
    //     every tier). Without the guard, any tier already owning its producer would
    //     read as "obsolete" the instant the simulation starts, since 0 >= 0 and
    //     anything positive >= 0. A tier the player cannot yet buy at all is not
    //     obsolete — there is no purchase to compare the delivery rate against — so
    //     this is treated as "not yet met" rather than a crossing.
    //   - The producer tier does not exist yet (`owned(producer)` is 0, so
    //     `delivered` is 0). This needs no special case: with `purchasable` guarded
    //     to be strictly positive by the point above, `delivered` at 0 can only ever
    //     read as "not met", which is the right answer — a tier cannot be retired by
    //     a producer that has not arrived.
    //
    // `nextCost` (here inlined as `costOfNth`, since the pairing already holds the
    // `TierDef` and skips a second lookup) is never zero, so `purchasable` is never
    // divided by zero.
    const income = overseenProductionPerSecond(state, content, 'evil');
    for (const { tier, producer, boostPosts } of obsolescencePairs) {
      const ownedProducer = state.gens[producer.id].owned;

      // Boost detection runs every second regardless of whether this tier has
      // already been retired: the column reports *when* the producer was first
      // boosted, which can land before or after retirement equally, and "after" or
      // "never" is exactly the finding the 2026-08-04 rule exists to catch.
      if (!firstBoostAt.has(producer.id)) {
        const reachedMilestone = firstMilestoneAt !== null && ownedProducer.gte(firstMilestoneAt);
        const postFilled = boostPosts.some((post) => hasPost(state, producer.id, post.id));
        if (reachedMilestone || postFilled) firstBoostAt.set(producer.id, elapsed);
      }

      if (obsolescenceAt.has(tier.id)) continue;

      const delivered = ownedProducer
        .mul(effectiveYield(state, producer))
        .mul(tierMultiplier(state, content, ownedProducer))
        .div(effectiveCycleMs(state, producer) / 1000);
      const cost = costOfNth(tier, state.gens[tier.id].purchased);
      const purchasable = income.div(cost);

      const met = purchasable.gt(0) && delivered.gte(purchasable);
      const candidate = obsolescenceCandidate.get(tier.id);

      if (!met) {
        if (candidate) obsolescenceCandidate.delete(tier.id);
        continue;
      }

      if (!candidate) {
        obsolescenceCandidate.set(tier.id, { ms: elapsed, owned: ownedProducer, delivered });
      } else if (elapsed - candidate.ms >= OBSOLESCENCE_HOLD_MS) {
        obsolescenceAt.set(tier.id, candidate);
      }
    }

    for (const { tier, post } of posts) {
      if (!overseerAppointedAt.has(post.id) && hasPost(state, tier.id, post.id)) {
        overseerAppointedAt.set(post.id, elapsed);
      }
    }
    if (firstPrestigeMs === null && prestigeGain(state, content).gte(1)) {
      firstPrestigeMs = elapsed;
    }

    const checkpoint = CHECKPOINTS[nextCheckpoint];
    if (checkpoint && elapsed >= checkpoint[1]) {
      rows.push(snapshot(state, content, checkpoint[0]));
      checkpointLifetimeEvil.set(checkpoint[0], state.lifetimeEvil);
      nextCheckpoint += 1;
    }
  }

  console.log(`\ncontent version: ${content.version}   simulated: ${SIMULATED_DAYS} days\n`);

  console.log('  first of each tier');
  for (const tier of [...content.tiers].reverse()) {
    const at = firstOwned.get(tier.id);
    const bought = firstPurchaseAt.get(tier.id);
    console.log(
      `    ${tier.plural.padEnd(14)} ${(at === undefined ? 'never' : duration(at)).padEnd(14)}` +
        `first bought ${bought === undefined ? 'never' : duration(bought)}`,
    );
  }
  console.log(
    `    ${'first prestige'.padEnd(14)} ${firstPrestigeMs === null ? 'never' : duration(firstPrestigeMs)}`,
  );

  console.log('\n  overseers');
  for (const { post } of posts) {
    const affordable = overseerAffordableAt.get(post.id);
    const hired = overseerAppointedAt.get(post.id);
    console.log(
      `    ${post.name.padEnd(29)}` +
        `within reach ${(affordable === undefined ? 'never' : duration(affordable)).padEnd(14)}` +
        `appointed ${hired === undefined ? 'never' : duration(hired)}`,
    );
  }

  console.log(
    '\n  obsolescence (spec §5.8.1: when the tier above delivers faster than income buys)',
  );
  for (const { tier, producer } of obsolescencePairs) {
    const point = obsolescenceAt.get(tier.id);
    const boostAt = firstBoostAt.get(producer.id);
    const boosted = boostAt === undefined ? 'never' : duration(boostAt);

    if (!point) {
      console.log(`    ${tier.plural.padEnd(14)}when never${' '.repeat(4)}boosted ${boosted}`);
      continue;
    }

    // The 2026-08-04 rule: a tier may not be retired until the tier above it has
    // been boosted. `never` counts as broken along with any boost that landed after
    // the retirement it should have earned — both compare here as "not before".
    const rule = boostAt !== undefined && boostAt <= point.ms ? 'before' : 'after';

    console.log(
      `    ${tier.plural.padEnd(14)}` +
        `when ${duration(point.ms).padEnd(14)}` +
        `how many ${`${short(point.owned)} ${producer.plural}`.padEnd(18)}` +
        `how fast ${(shortRate(point.delivered) + '/s').padEnd(11)}` +
        `boosted ${boosted.padEnd(14)}` +
        `rule ${rule}`,
    );
  }

  console.log(`\n  ${'at'.padEnd(5)}${header(content)}`);
  for (const row of rows) console.log(`  ${row}`);

  const evil2h = checkpointLifetimeEvil.get('2h');
  const evil4h = checkpointLifetimeEvil.get('4h');
  const evil8h = checkpointLifetimeEvil.get('8h');
  if (evil2h && evil4h && evil8h) {
    const warnAbove = 1 / content.prestige.exponent;
    console.log(
      `\n  growth exponent (lifetime Evil vs. time; warn above a = ${warnAbove.toFixed(2)})`,
    );
    console.log(`    2h -> 4h   a = ${growthExponent(evil2h, evil4h, 2).toFixed(3)}`);
    console.log(`    4h -> 8h   a = ${growthExponent(evil4h, evil8h, 2).toFixed(3)}`);
  }

  console.log(
    `\n  achievements earned: ${state.earnedAchievements.length} of ${content.achievements.length}`,
  );
  console.log();

  prestigeLoop(content);
}

/**
 * How steeply lifetime Evil grows with time, over the two windows the soul curve was
 * fitted against. The stability condition is `a · q · p < 1`, where `q` is the
 * exponent on lifetime Evil in the soul curve (`content.prestige.exponent`) and `p` is
 * the exponent on souls in the favour formula (1 — favour is linear in souls). The
 * warning line is therefore `a < 1 / q`, which `run` computes from `content.prestige`
 * rather than repeating as a literal, so a retuned `q` cannot leave the printed
 * threshold wrong. An earlier draft of this comment wrongly folded `k · perSoul` (a
 * coefficient, not an exponent) into that product and warned at `a = 1.66` — the same
 * conflation `packages/content/test/generators.test.ts` already catches elsewhere.
 *
 * The shipping numbers sit on that line, not comfortably under it: `a = 16.97` over
 * 2h→4h gives `a · q = 0.933`; `a = 18.38` over 4h→8h gives `a · q = 1.011`. Spec
 * §2.1 says as much — the product "sits between 0.94 and 1.01, on the line" — and
 * the loop still converges (see `prestigeLoop` below) because `a` itself falls as a
 * run lengthens, pulling the product back under 1 rather than past it.
 */
function growthExponent(early: Decimal, late: Decimal, timesLonger: number): number {
  return late.div(early).ln().toNumber() / Math.log(timesLonger);
}

/**
 * Eight successive runs, claiming souls between each.
 *
 * The 2026-08-08 soul curve spec's §1 fault — favour compounding without limit — cannot
 * be seen in any single run, and every table above this one is a single run.
 *
 * **Exact settling never happens, by construction.** `lifetimeEvil` survives every
 * prestige reset, souls are a strictly increasing function of it, and favour is
 * linear in souls (see `growthExponent` above) — so favour creeps upward forever,
 * however slowly. A check for "the last two runs report the same favour" cannot pass
 * on any correct build; it would only ever pass by widening its own tolerance until
 * noise and a real problem look alike. What is measured instead is deceleration: on
 * a converging build, each successive step ratio is smaller than the one before it.
 * The old, divergent curve fails this hard rather than marginally — its step ratios
 * on this same cadence went 14.7 then 3.1e7, increasing — so this is a sharper
 * discriminator than any band on the favour value itself.
 *
 * Two checks, both printed on their own line so a failing run shows which one broke:
 *   1. Every step ratio is smaller than the one before it (monotone deceleration).
 *   2. The final step ratio is under 1.10 — a backstop for ratios that decrease but
 *      too slowly to call the loop converged within eight runs.
 */
function prestigeLoop(content: Content): void {
  const RUNS = 8;
  const RUN_MS = 3 * HOUR;
  const FINAL_RATIO_LIMIT = 1.1;
  const state = createState(content);

  console.log('\nPRESTIGE LOOP — eight three-hour runs');
  console.log('run  favour going in   souls held after');

  const favours: number[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const favour = globalMultiplier(state, content).toNumber();
    favours.push(favour);

    for (let t = 0; t < RUN_MS; t += DT_MS) {
      decide(state, content);
      step(state, content, DT_MS);
    }

    if (prestigeGain(state, content).gt(0)) {
      apply(state, content, { kind: 'prestige' });
    }

    console.log(
      `${String(run).padStart(3)}  ${favour.toFixed(2).padStart(15)}   ${state.souls.toExponential(3).padStart(16)}`,
    );
  }

  // ratios[i] is favours[i + 1] / favours[i] — one fewer entry than favours itself.
  const ratios: number[] = [];
  for (let i = 1; i < favours.length; i += 1) {
    const previous = favours[i - 1] ?? 0;
    const current = favours[i] ?? 0;
    ratios.push(previous > 0 ? current / previous : Number.POSITIVE_INFINITY);
  }
  console.log(`\nstep ratios: ${ratios.map((ratio) => ratio.toFixed(3)).join(', ')}`);

  let decelerating = true;
  for (let i = 1; i < ratios.length; i += 1) {
    const previous = ratios[i - 1] ?? 0;
    const current = ratios[i] ?? 0;
    if (current >= previous) {
      decelerating = false;
      break;
    }
  }
  console.log(`deceleration: ${decelerating ? 'yes' : 'NO — a later step ratio rose'}`);

  const finalRatio = ratios[ratios.length - 1] ?? Number.POSITIVE_INFINITY;
  const underBackstop = finalRatio < FINAL_RATIO_LIMIT;
  console.log(
    `final ratio:  ${finalRatio.toFixed(3)} — ${underBackstop ? `under ${FINAL_RATIO_LIMIT}` : `NOT under ${FINAL_RATIO_LIMIT}`}`,
  );

  const settled = decelerating && underBackstop;
  console.log(`\nsettled: ${settled ? 'yes' : 'NO — the loop is still climbing'}`);
}

function header(content: Content): string {
  const tiers = [...content.tiers]
    .reverse()
    .map((tier) => tier.plural.slice(0, 9).padStart(10))
    .join('');
  return `${'evil/s'.padStart(12)}${tiers}${'lifetime'.padStart(11)}${'souls'.padStart(9)}`;
}

function snapshot(state: GameState, content: Content, label: string): string {
  const counts = [...content.tiers]
    .reverse()
    .map((tier) => short(state.gens[tier.id].owned).padStart(10))
    .join('');
  return (
    label.padEnd(5) +
    short(productionPerSecond(state, content, 'evil')).padStart(12) +
    counts +
    short(state.lifetimeEvil).padStart(11) +
    short(prestigeGain(state, content)).padStart(9)
  );
}

function short(value: Decimal): string {
  return value.lt(1e6) ? value.floor().toString() : value.toExponential(1).replace('e+', 'e');
}

/**
 * A delivery rate needs more resolution below 1 than `short()` gives — `short()`
 * floors anything under 1e6 to a whole number, and every obsolescence crossing
 * (spec §5.8.1) happens at a small rate by construction: it is the instant a
 * trickle from the tier above first overtakes a purse that can only buy a few
 * units a second. Flooring that would print `0/s` for every single reading and
 * make a genuinely-zero rate (no producer yet) indistinguishable from a real but
 * small one. `short()` itself stays untouched — every other table in this report
 * depends on its behaviour at scale, and this column defers to it at 1e6 and
 * above so the two stay consistent once the numbers get large.
 */
function shortRate(value: Decimal): string {
  if (value.eq(0)) return '0';
  if (value.gte(1e6)) return short(value);

  const n = value.toNumber();
  return n < 1 ? n.toPrecision(3) : n.toFixed(2);
}

function duration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return d > 0
    ? `${d}d ${h}h ${m}m`
    : `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

run(CURRENT);
