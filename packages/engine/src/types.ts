import type Decimal from 'break_eternity.js';
import type { AchievementId, OverseerId, ProducibleId, ResourceId, TierId } from '@dm/content';

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
  | 'nothing-affordable'
  | 'no-souls-earned'
  | 'unknown-tier'
  | 'tier-not-owned'
  | 'already-running'
  | 'already-appointed'
  | 'unknown-overseer'
  | 'tier-not-met';
