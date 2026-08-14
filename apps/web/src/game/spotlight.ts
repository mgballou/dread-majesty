import type { BeatGate, BeatPoints, OnboardingBeat } from '@dm/content';

/**
 * Which control a beat is pointing at, and which panel holds it.
 *
 * A pure mapping over the gate, so it lives here with the rest of the onboarding logic
 * rather than in the component that renders the result. `App` holds state and renders;
 * deciding what a beat names is not a rendering job.
 *
 * Selectors rather than refs, for the reason the deleted tour gave: the rung, the row and
 * the post are all inside laid-out containers, and wrapping any of them to hold a ref
 * would change what the layout is arranging. The cost is a class or attribute rename
 * silently losing the spotlight, which the anchor test in `App.test.tsx` exists to catch —
 * it walks the shipped tracks and asks the screen for whatever this names.
 *
 * The panel ids are the deck tab ids `App` builds. A beat pointing into a shut panel is
 * pointing at something with no box, so the caller opens it; see `Deck`'s `requestOpen`.
 *
 * A gate of `none` points at nothing on purpose — a narrative beat dims the whole screen
 * rather than framing a control, because there is no control to frame.
 *
 * A beat may `points` at a control it does not gate, and that is how she frames the strike:
 * pointing draws the eye, gating holds everything else back, and she must not gate — the
 * player refusing her is one of the two ways her conversation ends. Absent, the spotlight
 * follows the gate, which is every other beat.
 */
export function spotlightFor(beat: Pick<OnboardingBeat<string>, 'gate' | 'points'>): {
  target?: string;
  panel?: string;
} {
  const named: BeatPoints | BeatGate = beat.points ?? beat.gate;

  switch (named.kind) {
    case 'rouse':
      return { target: `.stage-node[data-tier="${named.tierId}"]` };
    case 'buy':
      return { target: `.rail__row[data-tier="${named.tierId}"]`, panel: 'muster' };
    case 'appoint':
      return {
        target: `.miscreant__post[data-overseer="${named.overseerId}"]`,
        panel: 'miscreants',
      };
    case 'smite':
      return { target: '.evil-node' };
    case 'none':
      return {};
  }
}
