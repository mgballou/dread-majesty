import { DOMINION_BEAT_IDS, MALICE_BEAT_IDS } from '@dm/content';
import type {
  BeatGate,
  BeatReady,
  Content,
  DominionBeatId,
  MaliceBeatId,
  OnboardingBeat,
  OverseerId,
  TierId,
  WaitingLine,
} from '@dm/content';
import { canAppoint, nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';

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
}: {
  ready: BeatReady;
  state: GameState;
  content: Content;
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

    // `canAppoint` rather than a price comparison, because `ready` means *the named action
    // can be performed* and a filled post cannot be filled again. The price alone said yes
    // to a post already held, so the beat came back the moment Evil recovered — gating every
    // other control behind a button disabled for good, with no dismissal and no window. The
    // selector is the engine's, so the same question is asked here and by the rail.
    case 'can-afford-overseer':
      return canAppoint(state, content, ready.overseerId);

    case 'smites-at-least':
      return state.stats.smites >= ready.count;

    case 'blow-ready-after-first':
      return state.stats.smites >= 1 && state.smiteActiveMs <= 0 && state.smiteCooldownMs <= 0;
  }
}

/**
 * Whether this beat stays put once it has been shown.
 *
 * Withdrawal — a beat leaving when its `ready` stops holding — is what stops a gated beat
 * stranding the player on a purchase they can no longer afford. It protects nothing on a beat
 * that gates no control and is ended by a button, and on one of those it is a defect: the
 * shipped verdict beat was on screen for five seconds against a fourteen-word line. See the
 * spec §1.1.
 *
 * Derived rather than declared, so it cannot be set on a gated beat by mistake.
 */
export function latches(beat: OnboardingBeat<string>): boolean {
  return beat.gate.kind === 'none' && beat.clearedBy === 'dismiss';
}

/**
 * The one beat of a track that is on screen, or null.
 *
 * The three rules of the spec §2 are the three clauses below, in order: not consumed,
 * every earlier beat consumed, and ready now. The second is what makes "one at a time,
 * in order" structural — `find` walks the track in order and the first unconsumed beat
 * is the only candidate, so a later beat can never jump the queue however ready it is.
 *
 * A latching beat is the exception to "ready now": once shown, it stays until consumed,
 * whatever its `ready` does afterward. See `latches`.
 */
export function showingBeat<Id extends string>({
  track,
  consumed,
  state,
  content,
  shownId,
}: {
  track: readonly OnboardingBeat<Id>[];
  consumed: readonly Id[];
  state: GameState;
  content: Content;
  /** The beat that was on screen last frame, or null. */
  shownId: Id | null;
}): OnboardingBeat<Id> | null {
  const next = track.find((beat) => !consumed.includes(beat.id));
  if (!next) return null;
  if (next.id === shownId && latches(next)) return next;
  return isBeatReady({ ready: next.ready, state, content }) ? next : null;
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
  // A supersession is the state moving on, never something the player did. `supersededBeat`
  // is what answers for it.
  if (typeof beat.clearedBy !== 'string') return false;

  switch (beat.clearedBy) {
    case 'smite':
      return action.kind === 'smite';
    case 'dismiss':
      return action.kind === 'dismiss';
    case 'gated-action':
      return action.kind !== 'smite' && action.kind !== 'dismiss' && !isGatedOut(beat.gate, action);
  }
}

/**
 * Whether the beat on screen has stood unanswered long enough to give up on.
 *
 * Retirement is deliberately **not** expressed through `clearsBeat`. That function asks
 * what the player did; this is the case where they did nothing, and the two must not be
 * confused. `goad` clears when her own supersession condition comes true, so a retirement
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
 * The beat on screen whose own supersession condition has come true.
 *
 * The third answer to "what ends a beat", beside the player acting (`clearsBeat`) and
 * nobody acting for long enough (`shouldRetire`). This one is neither: the state has moved
 * far enough that the beat has said its piece.
 *
 * The condition rides on the beat rather than on whether its successor is ready. That
 * earlier shape coupled two beats through a condition neither of them stated, and it
 * forced a subtle rule about not requiring the beat being cleared to be ready — she is
 * only ready when the cooldown is clear, and the cave that supersedes her restarts it, so
 * asking for her readiness here deadlocked. Nothing asks now.
 *
 * Still deliberately narrow: only the first *unconsumed* beat is ever reported, so a beat
 * deeper in the track cannot be skipped.
 */
export function supersededBeat<Id extends string>({
  track,
  consumed,
  state,
  content,
}: {
  track: readonly OnboardingBeat<Id>[];
  consumed: readonly Id[];
  state: GameState;
  content: Content;
}): Id | null {
  const showing = track.find((beat) => !consumed.includes(beat.id));
  if (!showing) return null;

  const clearedBy = showing.clearedBy;
  if (typeof clearedBy === 'string') return null;

  return isBeatReady({ ready: clearedBy.when, state, content }) ? showing.id : null;
}

/**
 * Which of her lines she is on in the cooldown after a blow.
 *
 * Indexed by lifetime blows and clamped at both ends, so it only ever moves forward. The
 * shipped single list was keyed to Apathy, which rises when the player caves, and so walked
 * her backwards through lines she had already said.
 */
export function urgingLine(lines: readonly string[], smites: number): string {
  const index = Math.min(Math.max(smites, 1), lines.length) - 1;
  return lines[index] ?? '';
}

/**
 * Which of her lines she is on while she is being ignored.
 *
 * The list is total — its last threshold is negative — so the loop always returns for any
 * shipped copy and the empty string below it is unreachable and untested. It is there because
 * the type cannot say the list is total, and the content test that pins the last threshold
 * below zero is what actually holds it. A threshold is exclusive, so Apathy sitting exactly on
 * a boundary takes the calmer line below it.
 */
export function waitingLine(lines: readonly WaitingLine[], apathy: number): string {
  for (const entry of lines) {
    if (apathy > entry.aboveApathy) return entry.line;
  }
  return '';
}

/**
 * What she is saying right now.
 *
 * The cooldown is the whole switch: while it runs she is answering the blow that started it,
 * and once it clears she is asking for the next one. Two lists rather than one, because those
 * are two different kinds of line and one descending threshold cannot pick between them.
 */
export function herLine({
  urging,
  waiting,
  state,
}: {
  urging: readonly string[];
  waiting: readonly WaitingLine[];
  state: GameState;
}): string {
  return state.smiteCooldownMs > 0
    ? urgingLine(urging, state.stats.smites)
    : waitingLine(waiting, state.smiteApathy);
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
  /** Whether she got what she asked for. Decides which line the verdict carries. */
  readonly caved: boolean;
}

/** Nothing left to show, and nothing left to remember about how it ended. */
const FINISHED: OnboardingProgress = { dominion: [], malice: [], done: true, caved: false };

/** The opening state of a first run: both tracks whole, nothing walked. */
const UNTOUCHED: OnboardingProgress = { dominion: [], malice: [], done: false, caved: false };

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
    caved: 'caved' in parsed && parsed.caved === true,
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
