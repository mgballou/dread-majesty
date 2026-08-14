import { DOMINION_BEAT_IDS, MALICE_BEAT_IDS } from '@dm/content';
import type {
  BeatGate,
  BeatReady,
  Content,
  DominionBeatId,
  GoadLine,
  MaliceBeatId,
  OnboardingBeat,
  OverseerId,
  TierId,
} from '@dm/content';
import { nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { bandIndex } from './apathy.ts';

const PROGRESS_KEY = 'dread-majesty:onboarding-seen';

/** An action the interface can offer and a beat can gate. Smite is deliberately absent. */
export type GatedControl =
  | { readonly kind: 'rouse'; readonly tierId: TierId }
  | { readonly kind: 'buy'; readonly tierId: TierId }
  | { readonly kind: 'appoint'; readonly overseerId: OverseerId };

/** Anything that can consume a beat. */
export type ClearingAction =
  GatedControl | { readonly kind: 'smite' } | { readonly kind: 'dismiss' };

/** Whether a beat's condition holds on this state, right now. */
export function isBeatReady({
  ready,
  state,
  content,
  bandCount,
}: {
  ready: BeatReady;
  state: GameState;
  content: Content;
  bandCount: number;
}): boolean {
  switch (ready.kind) {
    case 'always':
      return true;

    case 'idle-after-cycle': {
      const gen = state.gens[ready.tierId];
      return !gen.running && gen.lifetimeProduced.gt(0);
    }

    case 'owned-and-idle': {
      const gen = state.gens[ready.tierId];
      return gen.owned.gt(0) && !gen.running;
    }

    case 'cycled':
      return state.gens[ready.tierId].lifetimeProduced.gt(0);

    case 'can-afford-tier': {
      const tier = content.tiers.find((candidate) => candidate.id === ready.tierId);
      const cost = nextCost(state, content, ready.tierId);
      if (!tier || !cost) return false;
      return state.resources[tier.costResource].gte(cost);
    }

    case 'can-afford-overseer': {
      for (const tier of content.tiers) {
        const post = tier.overseers.find((candidate) => candidate.id === ready.overseerId);
        if (post) return state.resources[tier.costResource].gte(post.cost);
      }
      return false;
    }

    case 'smites-at-least':
      return state.stats.smites >= ready.count;

    case 'blow-ready-after-first':
      return state.stats.smites >= 1 && state.smiteActiveMs <= 0 && state.smiteCooldownMs <= 0;

    case 'band-at-least':
      return (
        bandIndex({ apathy: state.smiteApathy, cap: content.smite.apathy.cap, bandCount }) >=
        ready.band
      );
  }
}

/**
 * The one beat of a track that is on screen, or null.
 *
 * The three rules of the spec §2 are the three clauses below, in order: not consumed,
 * every earlier beat consumed, and ready now. The second is what makes "one at a time,
 * in order" structural — `find` walks the track in order and the first unconsumed beat
 * is the only candidate, so a later beat can never jump the queue however ready it is.
 */
export function showingBeat<Id extends string>({
  track,
  consumed,
  state,
  content,
  bandCount,
}: {
  track: readonly OnboardingBeat<Id>[];
  consumed: readonly Id[];
  state: GameState;
  content: Content;
  bandCount: number;
}): OnboardingBeat<Id> | null {
  const next = track.find((beat) => !consumed.includes(beat.id));
  if (!next) return null;
  return isBeatReady({ ready: next.ready, state, content, bandCount }) ? next : null;
}

/**
 * Whether a control is held back by the beat on screen.
 *
 * The gate is a whitelist of exactly one, so everything that is not the named control is
 * out. `none` gates nothing, which is what the whole Malice track and the last Dominion
 * beat use.
 */
export function isGatedOut(gate: BeatGate, control: GatedControl): boolean {
  switch (gate.kind) {
    case 'none':
      return false;
    case 'rouse':
      return !(control.kind === 'rouse' && control.tierId === gate.tierId);
    case 'buy':
      return !(control.kind === 'buy' && control.tierId === gate.tierId);
    case 'appoint':
      return !(control.kind === 'appoint' && control.overseerId === gate.overseerId);
  }
}

/** Whether this action consumes the beat. */
export function clearsBeat(beat: OnboardingBeat<string>, action: ClearingAction): boolean {
  switch (beat.clearedBy) {
    case 'smite':
      return action.kind === 'smite';
    case 'dismiss':
      return action.kind === 'dismiss';
    case 'gated-action':
      return action.kind !== 'smite' && action.kind !== 'dismiss' && !isGatedOut(beat.gate, action);
    case 'next-ready':
      return false;
  }
}

/**
 * Whether the beat on screen has stood unanswered long enough to give up on.
 *
 * Retirement is deliberately **not** expressed through `clearsBeat`. That function asks
 * what the player did; this is the case where they did nothing, and the two must not be
 * confused. `goad` clears when the next beat in her track is ready, so a retirement
 * dressed up as that would match nothing until the player produced it — leaving her line
 * on screen for the rest of the session and blocking the beat queued behind her. A
 * retiring beat is consumed whatever would otherwise have cleared it.
 *
 * `shownAtMs` is when the beat reached the screen, not when it became ready — a beat
 * waiting behind another must not burn its window in the queue. Both figures are play
 * time, so a backgrounded tab retires nothing.
 */
export function shouldRetire({
  beat,
  shownAtMs,
  playTimeMs,
}: {
  beat: OnboardingBeat<string>;
  shownAtMs: number;
  playTimeMs: number;
}): boolean {
  if (beat.retireAfterMs === null) return false;
  return playTimeMs - shownAtMs >= beat.retireAfterMs;
}

/**
 * The beat on screen that its successor is ready to take over from.
 *
 * The third answer to "what ends a beat", beside the player acting (`clearsBeat`) and
 * nobody acting for long enough (`shouldRetire`). This one is neither: it is one line
 * handing over to the next because the state has moved far enough to earn it.
 *
 * Deliberately narrow: it only ever reports the first *unconsumed* beat, and only when
 * that beat asks to be cleared this way, so a beat deeper in the track cannot be skipped
 * by its successor becoming ready early.
 *
 * **It must not require that beat to be ready, and this is load-bearing.** `goad`'s own
 * readiness needs the smite cooldown clear, and a cave restarts that cooldown — so the
 * very strike that pushes Apathy over the line for her successor is the strike that hides
 * her. Ask for her to be ready here and the handover can never fire: she is only ready
 * when the state that would supersede her has decayed away. Requiring readiness reads as
 * the tidier rule and is a deadlock.
 */
export function supersededBeat<Id extends string>({
  track,
  consumed,
  state,
  content,
  bandCount,
}: {
  track: readonly OnboardingBeat<Id>[];
  consumed: readonly Id[];
  state: GameState;
  content: Content;
  bandCount: number;
}): Id | null {
  const index = track.findIndex((beat) => !consumed.includes(beat.id));
  if (index < 0) return null;

  const showing = track[index];
  if (!showing || showing.clearedBy !== 'next-ready') return null;

  const next = track[index + 1];
  if (!next) return null;

  return isBeatReady({ ready: next.ready, state, content, bandCount }) ? showing.id : null;
}

/**
 * Which of her lines she is on.
 *
 * The list is total — its last threshold is negative — so the loop always returns for any
 * shipped copy and the empty string below it is unreachable and untested. It is there
 * because the type cannot say the list is total, and the content test that pins the last
 * threshold below zero is what actually holds it. A threshold is exclusive, so Apathy
 * sitting exactly on a boundary takes the calmer line below it.
 */
export function goadLine(lines: readonly GoadLine[], apathy: number): string {
  for (const entry of lines) {
    if (apathy > entry.aboveApathy) return entry.line;
  }
  return '';
}

/**
 * How far through the two tracks the player got, as it is written down.
 *
 * `localStorage` rather than the save, on purpose. This is not game state: it survives
 * abdication, it has no place in a save blob, and putting it there would mean a
 * migration and a field the engine has to carry and ignore forever.
 */
export interface OnboardingProgress {
  readonly dominion: readonly DominionBeatId[];
  readonly malice: readonly MaliceBeatId[];
  /** Walked to the end of Dominion, skipped, or never owed at all. */
  readonly done: boolean;
}

/** Nothing left to show, and nothing left to remember about how it ended. */
const FINISHED: OnboardingProgress = { dominion: [], malice: [], done: true };

/** The opening state of a first run: both tracks whole, nothing walked. */
const UNTOUCHED: OnboardingProgress = { dominion: [], malice: [], done: false };

/**
 * What this boot should do about onboarding.
 *
 * Pure, so every branch is a plain assertion. Only two facts go in: what is written
 * down, and whether this visit found a save.
 */
export type OnboardingDecision =
  | { readonly kind: 'run'; readonly progress: OnboardingProgress }
  /** Never owed it — an existing player from before onboarding. Write it off. */
  | { readonly kind: 'retire' }
  | { readonly kind: 'nothing' };

/**
 * Start, resume, or leave the player alone.
 *
 * Starting takes both facts: nothing written down **and** no save on disk. Either alone
 * is wrong — the key alone would hand the tutorial to somebody who has played for weeks
 * on a browser that lost its storage, and `fresh` alone would restart it for anybody who
 * skipped and closed the tab before the first autosave ten seconds later.
 *
 * Resuming takes only the first. A player who is eleven minutes into an eleven-minute
 * tutorial has a save on disk by definition, so `fresh` must not be consulted again once
 * there is progress to resume from — that is the whole reason this is written down per
 * beat rather than once at the end.
 */
export function onboardingDecision({
  stored,
  fresh,
}: {
  stored: OnboardingProgress | null;
  fresh: boolean;
}): OnboardingDecision {
  if (stored === null) return fresh ? { kind: 'run', progress: UNTOUCHED } : { kind: 'retire' };
  if (stored.done) return { kind: 'nothing' };
  return { kind: 'run', progress: stored };
}

/**
 * Reads the progress back, or null when there is none.
 *
 * A blocked store, unreadable data and the legacy `'1'` all read as finished. That is the
 * safer way to be wrong: a player whose browser refuses storage gets no tutorial rather
 * than the same tutorial on every single visit, which is the failure they would actually
 * notice — and `'1'` is exactly what a player who already dismissed it is holding.
 */
export function readOnboarding(): OnboardingProgress | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROGRESS_KEY);
  } catch {
    return FINISHED;
  }

  if (raw === null) return null;
  if (raw === '1') return FINISHED;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return FINISHED;
  }

  if (typeof parsed !== 'object' || parsed === null) return FINISHED;

  return {
    dominion: consumedIds(DOMINION_BEAT_IDS, 'dominion' in parsed ? parsed.dominion : null),
    malice: consumedIds(MALICE_BEAT_IDS, 'malice' in parsed ? parsed.malice : null),
    done: 'done' in parsed && parsed.done === true,
  };
}

/** Writes both tracks off: skipped, walked to the end, or never owed in the first place. */
export function finishOnboarding(): void {
  writeOnboarding(FINISHED);
}

export function writeOnboarding(progress: OnboardingProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Nothing to do and nothing worth saying. It showed; it may show again.
  }
}

/** Only the tests need this. Nothing in the game forgets onboarding on purpose. */
export function forgetOnboarding(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // As above.
  }
}

/**
 * The ids of a track that the stored list says are consumed.
 *
 * Filtered from the track's own id list rather than read out of the store, so anything
 * the store holds that is not an id of this track — a renamed beat, a hand-edited value —
 * simply does not appear, and the result is typed without a cast. Order does not matter:
 * every reader asks `includes`.
 */
function consumedIds<Id extends string>(known: readonly Id[], stored: unknown): readonly Id[] {
  if (!Array.isArray(stored)) return [];
  const entries: readonly unknown[] = stored;
  return known.filter((id) => entries.includes(id));
}
