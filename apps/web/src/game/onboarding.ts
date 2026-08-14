import type {
  BeatGate,
  BeatReady,
  Content,
  GoadLine,
  OnboardingBeat,
  OverseerId,
  TierId,
} from '@dm/content';
import { nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { bandIndex } from './apathy.ts';

const SEEN_KEY = 'dread-majesty:onboarding-seen';

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
      return bandIndex(state.smiteApathy, content.smite.apathy.cap, bandCount) >= ready.band;
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
  }
}

/**
 * Which of her lines she is on.
 *
 * The list is total — its last threshold is negative — so the loop always returns and
 * there is no fallback to leave untested. A threshold is exclusive, so Apathy sitting
 * exactly on a boundary takes the calmer line below it.
 */
export function goadLine(lines: readonly GoadLine[], apathy: number): string {
  for (const entry of lines) {
    if (apathy > entry.aboveApathy) return entry.line;
  }
  return '';
}

/**
 * Whether onboarding has already been walked, skipped or finished.
 *
 * `localStorage` rather than the save, on purpose. This is not game state: it survives
 * abdication, it has no place in a save blob, and putting it there would mean a
 * migration and a field the engine has to carry and ignore forever.
 *
 * A blocked or absent store reports "seen". That is the safer way to be wrong: a
 * returning player whose browser refuses storage gets no tutorial rather than the same
 * tutorial on every single visit, which is the failure they would actually notice.
 */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do and nothing worth saying. It showed; it may show again.
  }
}

/** Only the tests need this. Nothing in the game forgets onboarding on purpose. */
export function forgetOnboarding(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // As above.
  }
}
