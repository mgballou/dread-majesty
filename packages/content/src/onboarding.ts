import type { DominionBeatId, MaliceBeatId, OverseerId, TierId } from './ids.ts';

/**
 * When a beat is allowed on screen.
 *
 * A discriminated union rather than a predicate function, because content is data the
 * interface reads — a function here would put behaviour in the content package and make
 * the tracks impossible to check without running them.
 *
 * For every beat that gates a purchase this is *can afford the named action*, which is
 * the same predicate that decides whether to show it. That is not a coincidence and it is
 * the whole of why a gate can never strand a player on something they cannot buy. See
 * the spec §2.
 */
export type BeatReady =
  | { readonly kind: 'always' }
  /** Owned, stopped, and has paid out at least once — so it has been roused before. */
  | { readonly kind: 'idle-after-cycle'; readonly tierId: TierId }
  | { readonly kind: 'can-afford-tier'; readonly tierId: TierId }
  | { readonly kind: 'can-afford-overseer'; readonly overseerId: OverseerId }
  | { readonly kind: 'owned-and-idle'; readonly tierId: TierId }
  /** Has completed at least one cycle, ever. */
  | { readonly kind: 'cycled'; readonly tierId: TierId }
  | { readonly kind: 'smites-at-least'; readonly count: number }
  /** A blow has been struck, its effect has run out, and the next one is available. */
  | { readonly kind: 'blow-ready-after-first' }
  /** Apathy has reached the given band. Bands are the floor of Apathy; see the spec §5.3. */
  | { readonly kind: 'band-at-least'; readonly band: number };

/**
 * The one control left live while a beat is showing.
 *
 * `none` gates nothing, which is what the whole Malice track uses and what the last
 * Dominion beat uses. Smite is never nameable here: it is the one control that stays
 * live throughout, which is what lets the Malice track trigger at all.
 */
export type BeatGate =
  | { readonly kind: 'rouse'; readonly tierId: TierId }
  | { readonly kind: 'buy'; readonly tierId: TierId }
  | { readonly kind: 'appoint'; readonly overseerId: OverseerId }
  | { readonly kind: 'none' };

/** Who is speaking. A property of the beat, because two narrator beats sit in the Malice track. */
export type BeatVoice = 'narrator' | 'her';

/** What consumes a beat, besides retiring unread. */
export type BeatClearedBy = 'gated-action' | 'smite' | 'dismiss';

export interface OnboardingBeat<Id extends string> {
  readonly id: Id;
  readonly ready: BeatReady;
  readonly gate: BeatGate;
  readonly voice: BeatVoice;
  readonly clearedBy: BeatClearedBy;
  /**
   * Play-time milliseconds after showing at which the beat retires unconsumed. Null
   * never retires.
   *
   * Play time rather than wall clock, so a backgrounded tab cannot quietly retire a
   * prompt nobody was there to read. The clock starts when the beat is shown, not when
   * it becomes ready, so a beat waiting behind another does not expire in the queue.
   */
  readonly retireAfterMs: number | null;
}

export interface Onboarding {
  readonly dominion: readonly OnboardingBeat<DominionBeatId>[];
  readonly malice: readonly OnboardingBeat<MaliceBeatId>[];
}
