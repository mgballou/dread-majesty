import type { BeatGate } from '@dm/content';

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
 */
export function spotlightFor(gate: BeatGate): { target?: string; panel?: string } {
  switch (gate.kind) {
    case 'rouse':
      return { target: `.stage-node[data-tier="${gate.tierId}"]` };
    case 'buy':
      return { target: `.rail__row[data-tier="${gate.tierId}"]`, panel: 'muster' };
    case 'appoint':
      return {
        target: `.miscreant__post[data-overseer="${gate.overseerId}"]`,
        panel: 'miscreants',
      };
    case 'none':
      return {};
  }
}
