import type Decimal from 'break_eternity.js';
import type { AchievementId, ProducibleId, ResourceId, TierId } from '@dm/content';

export interface TierState {
  owned: Decimal;
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
   * Which tiers have an Overseer appointed.
   *
   * An appointed tier runs for ever and never needs rousing again. Survives prestige,
   * exactly as achievements and unlock flags do: the tapping phase is an opening, not
   * a tax to pay again every few hours. Written only by the `appoint` intent.
   */
  overseers: Record<TierId, boolean>;
  stats: {
    playTimeMs: number;
    smites: number;
    prestiges: number;
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
  | { kind: 'appoint'; tierId: TierId }
  | { kind: 'prestige' }
  | { kind: 'record-achievements' }
  | { kind: 'record-unlocks' };

export type IntentResult =
  | { ok: true; intent: Intent; detail: string }
  | { ok: false; intent: Intent; reason: IntentFailure };

export type IntentFailure =
  | 'insufficient-resource'
  | 'nothing-affordable'
  | 'no-souls-earned'
  | 'unknown-tier'
  | 'tier-not-owned'
  | 'already-running'
  | 'already-appointed';
