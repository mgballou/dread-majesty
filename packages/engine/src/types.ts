import type Decimal from 'break_eternity.js';
import type { ProducibleId, ResourceId, TierId } from '@dm/content';

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
}

export interface GameState {
  saveVersion: number;
  resources: Record<ResourceId, Decimal>;
  gens: Record<TierId, TierState>;
  souls: Decimal;
  /** Drives the prestige formula. Never reset. */
  lifetimeEvil: Decimal;
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

export type Intent =
  | { kind: 'purchase'; tierId: TierId; quantity: number | 'max' }
  | { kind: 'smite' }
  | { kind: 'prestige' };

export type IntentResult =
  | { ok: true; intent: Intent; detail: string }
  | { ok: false; intent: Intent; reason: IntentFailure };

export type IntentFailure =
  'insufficient-resource' | 'nothing-affordable' | 'no-souls-earned' | 'unknown-tier';
