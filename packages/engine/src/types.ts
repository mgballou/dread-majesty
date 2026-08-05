import type Decimal from 'break_eternity.js';
import type {
  AchievementId,
  OverseerId,
  ProducibleId,
  ResourceId,
  SmiteUpgradeId,
  TierId,
} from '@dm/content';

export interface TierState {
  owned: Decimal;
  /**
   * Units the player has bought with their own Evil.
   *
   * The cost curve keys on this and never on `owned`. A tier that produces another
   * tier would otherwise price its own product out of the game: cost is
   * `base * rate^n`, and at 500 Minions produced the next Minion runs to about
   * 9e18 Evil. `owned` still drives production, milestones, achievements and the
   * chain display — everything the player is being rewarded for. See spec §2.
   *
   * The one free Minion `createState` grants does not count. A gift should not
   * raise your prices.
   */
  purchased: Decimal;
  /**
   * Milliseconds accumulated toward the next cycle completion.
   *
   * Integer milliseconds, never a fraction of a cycle. Accumulating `dt/cycleMs`
   * as a float means 240 additions of 100/24000 land on 0.9999999999999999 and the
   * cycle silently never fires. Integers make completion exact.
   */
  progressMs: number;
  lifetimeProduced: Decimal;
  /**
   * Whether a manual cycle is turning.
   *
   * Every tier begins manual and accrues no progress at all until somebody rouses it.
   * The `rouse` intent sets this true; the cycle it completes sets it back to false
   * and drops the progress to zero, so a manual tier banks nothing. A tier with an
   * Overseer appointed ignores this flag — see `GameState.overseers`.
   */
  running: boolean;
}

export interface GameState {
  saveVersion: number;
  resources: Record<ResourceId, Decimal>;
  gens: Record<TierId, TierState>;
  souls: Decimal;
  /**
   * Souls spent on permanence, kept for ever.
   *
   * `prestigeGain` is `soulsEarned(lifetimeEvil) − souls`, so without this a spent soul
   * would come straight back on the next reset and permanence would be free. Subtracting
   * it is what makes a Keep cost something. `globalMultiplier` reads `souls` alone and
   * not this, so spending also costs the 2%-per-soul production it was granting — which
   * is the whole price of locking a rung in.
   */
  soulsSpent: Decimal;
  /** Drives the prestige formula. Never reset. */
  lifetimeEvil: Decimal;
  /**
   * Achievements the player has been awarded, in content order.
   *
   * An array rather than a Set so it serialises as-is, and content-ordered so two
   * states that earned the same set compare equal. Survives prestige. Written only
   * by the `record-achievements` intent — never by `step`.
   */
  earnedAchievements: AchievementId[];
  /**
   * Which tiers the player has ever been close enough to afford to see.
   *
   * A latch: once true it never goes false again, so the rail cannot lose a row the
   * player has already met, not even across a prestige reset. Written only by the
   * `record-unlocks` intent — never by `step`. See `isUnlockReached`.
   */
  unlocked: Record<TierId, boolean>;
  /**
   * Milliseconds left on the smite buff, and until another blow may be struck.
   *
   * Counters rather than timestamps, because the engine reads no clock (CLAUDE.md,
   * engine rule 1). `step` spends them down at exactly the rate it spends `dtMs`, so a
   * buff behaves the same online, offline and in the harness, with nothing to
   * reconcile between them.
   */
  smiteActiveMs: number;
  smiteCooldownMs: number;
  /**
   * How tired the realm is of being smitten. 0 to `content.smite.apathy.cap`, real.
   *
   * Every blow adds to it and it bleeds off on its own, which is what turns Smite from
   * a metronome into a decision — see spec §2. A real number rather than an integer
   * deliberately: an integer sheds in visible jumps, and a jump is a knife-edge where
   * hitting the shed by a second is worth a great deal and missing it by a second is
   * worth nothing.
   *
   * A plain number, not a `Decimal`. It is a bounded gauge, not a resource or a
   * generator count, and it sits beside the countdowns above for the same reason.
   */
  smiteApathy: number;
  /**
   * The multiplier the running blow carries. 1 when none runs.
   *
   * Necessary because the multiplier now varies per blow: `globalMultiplier` has to
   * know what **this** blow was worth, not what a fresh one would be. Without it,
   * buying Weight mid-blow would retroactively upgrade the blow already running.
   */
  smiteBlow: number;
  /**
   * Where each ladder stands this run. A reset drops each to its `smiteKept` floor.
   *
   * Rung 0 is the ladder's base value and costs nothing. The invariant `smiteKept[id]
   * <= smiteRungs[id]` holds always, which is why the effective value reads
   * `smiteRungs` alone and there is no `max()` anywhere in the engine.
   */
  smiteRungs: Record<SmiteUpgradeId, number>;
  /** The permanent floor, bought with souls. Never cleared by a reset. */
  smiteKept: Record<SmiteUpgradeId, number>;
  /**
   * The posts filled over each tier, in content order.
   *
   * Ids rather than flags, because a tier now has three posts and each does a
   * different thing. A tier is automated when its `automate` post is in this list —
   * `hasAutomator` is the only thing that should ever ask.
   *
   * **A reset clears every one of them.** Unlike achievements and unlock flags, an
   * appointment is power rather than a record of having seen something, so losing it
   * is what makes a run a run (spec §3.4). Written only by the `appoint` intent.
   */
  overseers: Record<TierId, readonly OverseerId[]>;
  stats: {
    playTimeMs: number;
    smites: number;
    prestiges: number;
    /**
     * Play time since the last reset.
     *
     * Beside `playTimeMs` rather than derived from it, because a run's length is what
     * the prestige panel has to report and nothing else in the state records when the
     * run began. Advanced at the boundary alongside `playTimeMs`; zeroed by `prestige`.
     */
    runMs: number;
  };
}

/** What a single slice produced. Totals only — never a per-event list. */
export interface StepReport {
  produced: Partial<Record<ProducibleId, Decimal>>;
  completions: Partial<Record<TierId, number>>;
}

export interface OfflineReport {
  /** After clamping to the cap and to zero. */
  elapsedMs: number;
  /** True when the raw elapsed time was longer than the cap allows. */
  capped: boolean;
  /** True when the slice was coarsened for a long absence. */
  coarsened: boolean;
  produced: Partial<Record<ProducibleId, Decimal>>;
}

/**
 * The two bookkeeping intents are not player actions.
 *
 * Achievement conditions and unlock thresholds are checked at the boundary, after a
 * batch of slices, never inside `step` — `step` runs 36,000 times to catch up an hour
 * and must not scan the whole content list each time. They are intents rather than
 * standalone functions because `step` and `apply` are the only functions permitted to
 * mutate `GameState`, and that rule is worth more than the convenience of a third
 * mutator (CLAUDE.md, engine rule 2).
 */
export type Intent =
  | { kind: 'purchase'; tierId: TierId; quantity: number | 'max' }
  | { kind: 'smite' }
  | { kind: 'climb'; upgradeId: SmiteUpgradeId }
  | { kind: 'keep'; upgradeId: SmiteUpgradeId }
  | { kind: 'rouse'; tierId: TierId }
  | { kind: 'appoint'; overseerId: OverseerId }
  | { kind: 'prestige' }
  | { kind: 'record-achievements' }
  | { kind: 'record-unlocks' };

export type IntentResult =
  | { ok: true; intent: Intent; detail: string }
  | { ok: false; intent: Intent; reason: IntentFailure };

export type IntentFailure =
  | 'smite-cooling'
  | 'insufficient-resource'
  | 'insufficient-souls'
  | 'nothing-affordable'
  | 'no-souls-earned'
  | 'unknown-tier'
  | 'unknown-upgrade'
  | 'rung-maxed'
  | 'nothing-to-keep'
  | 'tier-not-owned'
  | 'already-running'
  | 'already-appointed'
  | 'unknown-overseer'
  | 'tier-not-met';
