import type { DominionBeatId, MaliceBeatId, OverseerId, TierId } from './ids.ts';

/**
 * When a beat is allowed on screen.
 *
 * A discriminated union rather than a predicate function, because content is data the
 * interface reads — a function here would put behavior in the content package and make
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
  /**
   * Blows struck since this beat reached the screen.
   *
   * Not a lifetime count, and the difference is the whole reason it exists. A beat that asks
   * the player to strike is asking them to strike *now*; measuring it against blows landed
   * before it appeared credits the player with an answer to a question nobody had put. Her
   * supersession read lifetime blows and could therefore be satisfied by strikes made during
   * the opening beat, ending her turn on the frame she first rendered and telling the player
   * they listened to somebody they had never seen. See the spec §2.
   *
   * False for a beat that has not been shown: there is no arrival to count from.
   */
  | { readonly kind: 'smites-since-shown'; readonly count: number }
  /** A blow has been struck, its effect has run out, and the next one is available. */
  | { readonly kind: 'blow-ready-after-first' };

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

/**
 * What a beat draws the eye to, when that is not the control it gates.
 *
 * Separate from `BeatGate` because they are not the same claim: a gate holds every other
 * control back, and pointing only says "here". Smite appears here and deliberately not in
 * `BeatGate` — she asks for a blow and the player stays free to refuse, which is one of the
 * two ways her conversation ends. Gate it and that ending disappears.
 */
export type BeatPoints =
  | { readonly kind: 'rouse'; readonly tierId: TierId }
  | { readonly kind: 'buy'; readonly tierId: TierId }
  | { readonly kind: 'appoint'; readonly overseerId: OverseerId }
  | { readonly kind: 'smite' };

/** Who is speaking. A property of the beat, because two narrator beats sit in the Malice track. */
export type BeatVoice = 'narrator' | 'her';

/**
 * What consumes a beat, besides retiring unread.
 *
 * `superseded` carries its own condition: the beat is consumed when `when` holds on the
 * current state. A beat says what ends it rather than deferring to whether its successor
 * happens to be ready, which coupled two beats through a condition neither of them stated.
 */
export type BeatClearedBy =
  'gated-action' | 'smite' | 'dismiss' | { readonly kind: 'superseded'; readonly when: BeatReady };

export interface OnboardingBeat<Id extends string> {
  readonly id: Id;
  readonly ready: BeatReady;
  readonly gate: BeatGate;
  /** Overrides `gate` for the spotlight only. Absent means the spotlight follows the gate. */
  readonly points?: BeatPoints;
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
