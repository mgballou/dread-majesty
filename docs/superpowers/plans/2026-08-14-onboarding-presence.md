# Onboarding Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the first-run onboarding enough visual weight to act on, and repair the Malice track so its conversation resolves.

**Architecture:** A `Spotlight` component dims the screen and cuts a click-through hole around the one control the current beat names, driven by a selector derived from the beat's gate. The Malice repair is one new `clearedBy` variant — `'next-ready'` — plus a pure `supersededBeat` evaluated beside the existing retirement check, so her line persists across strikes until the narrator's reply becomes ready.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), React 19, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-onboarding-presence-design.md`. Read §2 (the Malice repair) and §3 (presence) before starting. It extends `docs/superpowers/specs/2026-08-13-onboarding-design.md`, whose model and beats stand unchanged.

## Global Constraints

- **No file under `packages/engine` may be modified.** `SAVE_VERSION` does not move and no save migration is added.
- **No `any`, no default exports, no `as` casts, no non-null assertions.** Named exports only.
- **Discriminated unions over string flags.** A `switch` on a discriminant is exhaustive with no `default`, so a new variant fails typecheck.
- **Object parameters once a function takes three or more arguments.** Two or fewer stay positional.
- **`exactOptionalPropertyTypes` is on** — an optional prop is spread conditionally, never passed `undefined`.
- **Game logic never lives in a React component.** Components render and dispatch; decisions live in `apps/web/src/game/`.
- **No raw color values outside `apps/web/src/ui/tokens.css`.** Semantic names only.
- **The scrim never takes `--accent`.** Gold means the single lifted action; the ring is `--accent-line`, which is line work.
- **Reduced motion is designed, not stripped.** The ring stays under `prefers-reduced-motion`; only its pulse goes. Follow the existing `[data-motion='full']` attribute pattern used by `TierNode`.
- **The dimming is `pointer-events: none` throughout.** A lit control must be genuinely clickable — this is the whole trick.
- **No comments in tests.** One assertion per `expect`.
- **US English throughout, including comments.** Note the ~40 pre-existing files containing British spellings are the repo's existing convention and out of scope.
- Commit messages: imperative, one line, **no trailers and no AI attribution**.
- Branch is `first-run-tour`, already checked out. Never commit to `main`.

## Environment

`pnpm` is not on PATH. From the repo root:

- `./node_modules/.bin/vitest run <path>` — tests
- `./node_modules/.bin/eslint .` — lint
- `./node_modules/.bin/prettier --check .` / `--write` — format
- Typecheck **per package** — there is no root `tsconfig.json`, and a bare `npx tsc --noEmit` at the root silently reads zero project files and always prints "No errors found":

  ```bash
  npx tsc --noEmit -p packages/content/tsconfig.json
  npx tsc --noEmit -p packages/engine/tsconfig.json
  npx tsc --noEmit -p apps/web/tsconfig.json
  ```

`timeout` is unavailable. The `rtk` wrapper on git/grep is lossy — prefix `rtk proxy` when you need a complete listing.

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `packages/content/src/onboarding.ts` | `BeatClearedBy` gains `'next-ready'`. |
| `packages/content/src/v1/onboarding.ts` | `goad` clears on `next-ready`; `first-blow` and `apathy` stop retiring. |
| `packages/content/src/v1/copy.ts` | The `stir` line. |
| `apps/web/src/game/onboarding.ts` | `supersededBeat`; `clearsBeat` handles the new variant. |
| `apps/web/src/ui/stage/TierNode.tsx` | `data-tier`, so a rung is addressable. |
| `apps/web/src/ui/rail/Miscreants.tsx` | `data-overseer`, so a post is addressable. |
| `apps/web/src/ui/Deck.tsx` | Optional requested tab, so a beat can bring its target's panel forward. |
| `apps/web/src/ui/Spotlight.tsx` *(new)* | Measures a target and draws the dim. Presentational only. |
| `apps/web/src/ui/Spotlight.css` *(new)* | The bands, the ring, the two weights. |
| `apps/web/src/ui/tokens.css` | `--scrim-soft` for the narrative dim. |
| `apps/web/src/ui/Prompt.css` | The heavier bar. |
| `apps/web/src/App.tsx` | Maps a gate to a selector and a deck tab; renders `Spotlight`. |
| `apps/web/src/App.css` | Z-order: scrim under the bar. |

---

### Task 1: Content — `next-ready`, the Malice retune, and the opening line

Nothing consumes `'next-ready'` yet; Task 2 teaches the web app to honor it. The app still compiles and behaves as before at the end of this task, except that `first-blow` and `apathy` no longer expire and `goad` is no longer cleared by a smite — which, until Task 3, means she persists until her window closes. That intermediate state is expected.

**Files:**

- Modify: `packages/content/src/onboarding.ts`
- Modify: `packages/content/src/v1/onboarding.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Test: `packages/content/test/onboarding.test.ts`

**Interfaces:**

- Produces: `BeatClearedBy` = `'gated-action' | 'smite' | 'dismiss' | 'next-ready'`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/content/test/onboarding.test.ts`:

```ts
describe('the Malice track resolves', () => {
  const malice = v1Onboarding.malice;
  const beat = (id: string) => malice.find((candidate) => candidate.id === id);

  it('keeps her talking across strikes', () => {
    expect(beat('goad')?.clearedBy).toBe('next-ready');
  });

  it('lets the narrator answer her rather than a timer', () => {
    expect(beat('apathy')?.retireAfterMs).toBeNull();
  });

  it('never expires the opening explanation', () => {
    expect(beat('first-blow')?.retireAfterMs).toBeNull();
  });

  it('leaves her the one beat that gives up on its own', () => {
    const timed = malice.filter((candidate) => candidate.retireAfterMs !== null);
    expect(timed.map((candidate) => candidate.id)).toEqual(['goad']);
  });

  it('gives every beat that clears on the next one a successor to wait for', () => {
    for (const track of [v1Onboarding.dominion, v1Onboarding.malice]) {
      const last = track.at(-1);
      expect(last?.clearedBy).not.toBe('next-ready');
    }
  });
});
```

Add to the existing `describe('the onboarding copy', ...)`:

```ts
  it('plants her in the opening line', () => {
    expect(copy.dominion.stir).toContain('otherworldly abomination');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: FAIL — `goad.clearedBy` is `'smite'`, the retirement windows are numbers, and `stir` does not mention her.

- [ ] **Step 3: Add the variant**

In `packages/content/src/onboarding.ts`, change `BeatClearedBy` and its doc comment:

```ts
/**
 * What consumes a beat, besides retiring unread.
 *
 * `next-ready` means the beat is consumed when the next unconsumed beat in its track has
 * a `ready` that holds — one line handing over to the next rather than the player ending
 * it. It is what lets a beat keep talking across several player actions instead of being
 * spent by the first one.
 */
export type BeatClearedBy = 'gated-action' | 'smite' | 'dismiss' | 'next-ready';
```

- [ ] **Step 4: Retune the Malice track**

In `packages/content/src/v1/onboarding.ts`, replace the three Malice beats' `clearedBy` and `retireAfterMs` fields, keeping every other field and rewriting the comments to match:

```ts
    {
      // Dismiss-only. It is the longest line in the tutorial — about 38 words, some
      // twelve seconds of reading — so a window that retired it would be a coin toss on
      // whether the player finished it. It has a button; that is what ends it.
      id: 'first-blow',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
    {
      // She is not spent by one strike. Her lines are chosen from Apathy, and Apathy
      // *rises* when the player caves — so caving lands her back on "Again", which is the
      // insistence. What ends her is the narrator: when Apathy crosses band 2 on the
      // second cave, `apathy` becomes ready and takes the bar from her. If the player
      // resists instead, she walks down to her honest line and gives up at her window,
      // which is the only ending she has that is not an interruption.
      id: 'goad',
      ready: { kind: 'blow-ready-after-first' },
      gate: { kind: 'none' },
      voice: 'her',
      clearedBy: 'next-ready',
      retireAfterMs: 120 * SECOND,
    },
    {
      // Band 2, not band 1 — see the 2026-08-13 spec §5.3 for the strike-by-strike walk.
      // Dismiss-only: it is the answer to her, and the player should close it themselves.
      id: 'apathy',
      ready: { kind: 'band-at-least', band: 2 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
```

- [ ] **Step 5: Change the opening line**

In `packages/content/src/v1/copy.ts`, in the `onboarding.dominion` block, replace the `stir` entry:

```ts
      stir: 'One Minion, big dreams, and the favor of an otherworldly abomination. Set it about some wickedness.',
```

- [ ] **Step 6: Run the tests and the gate**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: PASS.

Run the three per-package typechecks, `eslint .` and `prettier --check .`.
Expected: all clean. The web app's `clearsBeat` still typechecks because its `switch` gains an unhandled case only in Task 2 — if `apps/web` fails to typecheck here with `TS2366` on `clearsBeat`, that is the exhaustiveness check working; add the `next-ready` case now returning `false`, and Task 2 will build on it.

- [ ] **Step 7: Commit**

```bash
git add packages/content/src/onboarding.ts packages/content/src/v1/onboarding.ts \
        packages/content/src/v1/copy.ts packages/content/test/onboarding.test.ts \
        apps/web/src/game/onboarding.ts
git commit -m "Let a beat hand over to the next and stop the narrator's lines expiring"
```

---

### Task 2: The pure module — `supersededBeat`

**Files:**

- Modify: `apps/web/src/game/onboarding.ts`
- Test: `apps/web/src/game/onboarding.test.ts`

**Interfaces:**

- Consumes: `BeatClearedBy` including `'next-ready'` from Task 1.
- Produces:

  ```ts
  export function supersededBeat<Id extends string>(args: {
    track: readonly OnboardingBeat<Id>[];
    consumed: readonly Id[];
    state: GameState;
    content: Content;
    bandCount: number;
  }): Id | null;
  ```

  Returns the id of the showing beat when it clears on `'next-ready'` and the next unconsumed beat after it is ready; otherwise null.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/game/onboarding.test.ts`:

```ts
describe('supersededBeat', () => {
  const bandCount = v1Copy.smite.bands.length;

  function superseded(state: GameState, consumed: readonly string[]) {
    return supersededBeat({
      track: malice,
      consumed: consumed as readonly (typeof malice)[number]['id'][],
      state,
      content,
      bandCount,
    });
  }

  function struck(apathy: number): GameState {
    const state = fresh();
    state.stats.smites = 1;
    state.smiteApathy = apathy;
    return state;
  }

  it('leaves her talking while the realm still flinches', () => {
    expect(superseded(struck(1.5), ['first-blow'])).toBeNull();
  });

  it('hands over once the realm has stopped looking', () => {
    expect(superseded(struck(2.1), ['first-blow'])).toBe('goad');
  });

  it('takes the boundary as belonging to the narrator', () => {
    expect(superseded(struck(2), ['first-blow'])).toBe('goad');
  });

  it('supersedes nothing when the showing beat waits on the player', () => {
    expect(superseded(struck(2.1), [])).toBeNull();
  });

  it('supersedes nothing once she is already consumed', () => {
    expect(superseded(struck(2.1), ['first-blow', 'goad'])).toBeNull();
  });

  it('supersedes nothing when no beat is showing', () => {
    expect(superseded(fresh(), ['first-blow', 'goad', 'apathy'])).toBeNull();
  });
});

describe('clearsBeat and the next-ready variant', () => {
  const goad = malice.find((beat) => beat.id === 'goad');

  it('is not cleared by a smite any more', () => {
    expect(goad && clearsBeat(goad, { kind: 'smite' })).toBe(false);
  });

  it('is not cleared by a dismissal', () => {
    expect(goad && clearsBeat(goad, { kind: 'dismiss' })).toBe(false);
  });

  it('is not cleared by a purchase', () => {
    expect(goad && clearsBeat(goad, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });
});
```

Add `supersededBeat` to the imports from `./onboarding.ts` at the top of the file.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts`
Expected: FAIL — `supersededBeat` is not exported.

- [ ] **Step 3: Handle the variant in `clearsBeat`**

In `apps/web/src/game/onboarding.ts`, add the case to the `switch` in `clearsBeat`:

```ts
    case 'next-ready':
      // Nothing the player does ends her. `supersededBeat` is what ends her, and it asks
      // about the state rather than about an action — which is why this returns false for
      // every action rather than trying to name one.
      return false;
```

- [ ] **Step 4: Write `supersededBeat`**

Add below `shouldRetire` in the same file:

```ts
/**
 * The beat on screen that its successor is ready to take over from.
 *
 * The third answer to "what ends a beat", beside the player acting (`clearsBeat`) and
 * nobody acting for long enough (`shouldRetire`). This one is neither: it is one line
 * handing over to the next because the state has moved far enough to earn it.
 *
 * Deliberately narrow. It only ever reports the *showing* beat — the first unconsumed one
 * — and only when that beat asks to be cleared this way, so a beat deeper in the track
 * cannot be skipped by its successor becoming ready early.
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
```

- [ ] **Step 5: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the gate**

Run the three per-package typechecks, `eslint .`, `prettier --check .`, and the full suite.
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/game/onboarding.ts apps/web/src/game/onboarding.test.ts
git commit -m "Add the rule that lets one beat hand over to the next"
```

---

### Task 3: Wire the handover, and prove both pathways end

**Files:**

- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**

- Consumes: `supersededBeat` from Task 2.

- [ ] **Step 1: Read the retirement effect first**

Find the effect in `App.tsx` that calls `shouldRetire` and `retire()`. The handover belongs in the same effect, for the reason the spec gives in §2.2: both "this beat's time is up" answers sit together, and neither is a decision made inside a component.

- [ ] **Step 2: Write the failing tests**

Add to `apps/web/src/App.test.tsx`, inside the onboarding describe that already mocks `readSave`:

```ts
describe('the Malice conversation resolves', () => {
  it('keeps her on the bar after a single strike', async () => {
    // build a state with one smite behind it and Apathy below band 2, render, and assert
    // her line is still showing after a second strike
  });

  it('hands the bar to the narrator once the realm stops looking', async () => {
    // drive Apathy to 2 or above and assert the narrator's reply is on the bar
  });

  it('lets her give up when the player resists', async () => {
    // wind past her window with no strike and assert nothing of hers is showing
  });
});
```

Replace each comment with a real assertion built from the helpers this file already has — `struckBlob`, the faked `performance`/animation frame, and `CURRENT_COPY.onboarding`. **A comment left where an assertion belongs fails the task.** Follow the arrangement of the existing clock tests: install the timers before `render`, and never fake `setTimeout`.

- [ ] **Step 3: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/App.test.tsx`
Expected: FAIL — she is never superseded, so the narrator's reply never appears.

- [ ] **Step 4: Wire the handover**

Import `supersededBeat` and add the check to the retirement effect, before the retirement branch:

```tsx
  const handedOver = running
    ? supersededBeat({ track: onboarding.malice, consumed: doneMalice, state, content, bandCount })
    : null;
```

and inside the effect, consume it the same way `retire()` does — appending the id directly to the track's consumed list, not routing through `clearsBeat`. Add a comment saying why: `clearsBeat` asks what the player did, and a handover is not something the player did.

The Dominion track carries no `'next-ready'` beat today, so only Malice is checked. If you add the Dominion check too, it is dead code — leave it out.

- [ ] **Step 5: Run the tests and the gate**

Run: `./node_modules/.bin/vitest run` plus the three typechecks, `eslint .` and `prettier --check .`.
Expected: all clean, and the three new tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "Let the narrator take the bar from her when the realm stops looking"
```

---

### Task 4: Make the live controls addressable

The spotlight must find *the Minion rung*, not *a rung*. `TierRow` already carries `data-tier`; the other two carry nothing.

**Files:**

- Modify: `apps/web/src/ui/stage/TierNode.tsx`
- Modify: `apps/web/src/ui/rail/Miscreants.tsx`
- Test: `apps/web/src/ui/stage/TierNode.test.tsx`, `apps/web/src/ui/rail/Miscreants.test.tsx`

**Interfaces:**

- Produces: `.stage-node[data-tier="<TierId>"]` and `.miscreant__post[data-overseer="<OverseerId>"]`.

- [ ] **Step 1: Write the failing tests**

In `TierNode.test.tsx`, using that file's existing render helper:

```tsx
it('names which tier it is, so the tutorial can point at it', () => {
  // render the node for the minion tier and assert the article carries data-tier="minion"
});
```

In `Miscreants.test.tsx`, using that file's existing helper:

```tsx
it('names which post it is, so the tutorial can point at it', () => {
  // render and assert the Taskmaster's button carries data-overseer="minion-hand"
});
```

Replace both comments with real assertions. A test that renders and asserts nothing fails the task.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/stage/TierNode.test.tsx apps/web/src/ui/rail/Miscreants.test.tsx`
Expected: FAIL — neither attribute exists.

- [ ] **Step 3: Add the attributes**

In `TierNode.tsx`, on the `<article>` that already carries `data-oversight`, add `data-tier={tier.id}` — read the component's props to find the right expression for the tier's id; it is whatever `data-oversight`'s sibling fields are derived from. Put it beside `data-oversight`, not folded into it.

In `Miscreants.tsx`, on the `<button className={'miscreant__post ...'}>`, add `data-overseer={post.post.id}`.

Both attributes exist so the first-run tutorial can point at a specific control. Say that in a short comment at each site, so nobody deletes them as unused — nothing else reads them.

- [ ] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/ui`
Expected: PASS, including every pre-existing test unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/stage/TierNode.tsx apps/web/src/ui/stage/TierNode.test.tsx \
        apps/web/src/ui/rail/Miscreants.tsx apps/web/src/ui/rail/Miscreants.test.tsx
git commit -m "Let a rung and a post say which one they are"
```

---

### Task 5: Let a beat bring its target's panel forward

The deck keeps every panel mounted and hides the shut ones, so a target inside a closed panel has a zero-sized rect and the spotlight would silently dim everything.

**Files:**

- Modify: `apps/web/src/ui/Deck.tsx`
- Test: `apps/web/src/ui/Deck.test.tsx`

**Interfaces:**

- Produces: `requestOpen?: string` on `DeckProps`. When it changes to a tab id the deck holds, that tab opens. Absent, the deck behaves exactly as it does today.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/ui/Deck.test.tsx`, using that file's existing render helper:

```tsx
describe('a requested tab', () => {
  it('opens the panel it names', () => {
    // render with requestOpen set to the second tab's id and assert that panel is open
  });

  it('leaves the player where they are when it names nothing', () => {
    // render with no requestOpen, assert the first tab is open
  });

  it('ignores a tab it does not hold', () => {
    // render with requestOpen set to an unknown id and assert the first tab is still open
  });

  it('does not fight the player after it has opened', () => {
    // with requestOpen set, click another tab and assert that other tab is now open
  });
});
```

Replace every comment with a real assertion. The last one matters most: a requested tab must open the panel once, not pin it — the player has to be able to look elsewhere.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Deck.test.tsx`
Expected: FAIL — `requestOpen` is not a prop.

- [ ] **Step 3: Add the prop**

In `Deck.tsx`, add to `DeckProps`:

```ts
  /**
   * A tab to bring forward, named by id.
   *
   * The first-run tutorial uses it: a beat that points at a control inside a shut panel
   * would otherwise be pointing at something with no size on screen. Opening happens when
   * this *changes*, not on every render — so the player can still move to another tab
   * afterwards and the deck will not drag them back.
   *
   * Absent means the deck chooses for itself, which is every state after the first run.
   */
  requestOpen?: string;
```

Honor it with an effect that responds to a change in `requestOpen` and sets `chosen` to that tab's index when the id is one the deck holds. An unknown id changes nothing. Do not call `move()` — that steals focus, and a tutorial opening a panel must not move the player's keyboard position.

- [ ] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Deck.test.tsx`
Expected: PASS, with every pre-existing Deck test unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/Deck.tsx apps/web/src/ui/Deck.test.tsx
git commit -m "Let the deck be asked to bring a panel forward"
```

---

### Task 6: The Spotlight

Presentational only. It is handed a selector or nothing, and draws the dim.

**Files:**

- Create: `apps/web/src/ui/Spotlight.tsx`
- Create: `apps/web/src/ui/Spotlight.css`
- Modify: `apps/web/src/ui/tokens.css`
- Test: `apps/web/src/ui/Spotlight.test.tsx`, `apps/web/src/ui/tokens.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export function Spotlight({ target }: { target?: string }): ReactNode;
  ```

  `target` given and resolving to a sized element → four bands and a ring around it, at `--scrim`. `target` given but matching nothing, or matching something with no size → the whole screen at `--scrim`. `target` absent → the whole screen at `--scrim-soft`.

- [ ] **Step 1: Add the soft scrim token and its test**

In `apps/web/src/ui/tokens.css`, add to the primitives block beside `--raw-scrim`:

```css
  /* Half the weight of the full scrim. What a narrative beat dims to: there is nothing
     to point at, so the screen recedes rather than being cut through. */
  --raw-scrim-soft: rgb(8 7 10 / 40%);
```

and to the semantic block beside `--scrim`:

```css
  --scrim-soft: var(--raw-scrim-soft);
```

In `apps/web/src/ui/tokens.test.ts`, add to the existing `describe('token contract', ...)`:

```ts
  it('keeps the narrative dim lighter than the full scrim', () => {
    expect(alpha('--scrim-soft')).toBeLessThan(alpha('--scrim'));
  });
```

The file already resolves a token name to its literal value in order to compute contrast and hue — reuse that same resolution for an `alpha(name)` helper, and read the alpha from the resulting `rgb(R G B / N%)` by matching the percentage before the closing paren. Return it as a number. Do not add a second way of reading the stylesheet; there is one already and two would be two chances to disagree.

- [ ] **Step 2: Write the failing component tests**

Create `apps/web/src/ui/Spotlight.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spotlight } from './Spotlight.tsx';

describe('Spotlight', () => {
  it('dims the whole screen when it points at nothing', () => {
    render(<Spotlight />);
    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--soft');
  });

  it('dims the whole screen when its target is not on screen', () => {
    render(<Spotlight target=".nothing-here" />);
    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--whole');
  });

  it('never intercepts a click', () => {
    render(<Spotlight />);
    expect(getComputedStyle(screen.getByTestId('spotlight')).pointerEvents).toBe('none');
  });

  it('is hidden from assistive tech', () => {
    render(<Spotlight />);
    expect(screen.getByTestId('spotlight')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

jsdom measures every element as zero, so the cutout branch cannot be exercised here — that is what the manual play-through in Task 7 is for. Say so in a comment above the describe.

- [ ] **Step 3: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Spotlight.test.tsx apps/web/src/ui/tokens.test.ts`
Expected: FAIL — `Spotlight.tsx` does not exist and `--scrim-soft` is not declared.

- [ ] **Step 4: Write the component**

Create `apps/web/src/ui/Spotlight.tsx`. It measures with `getBoundingClientRect`, re-measures on `resize` and on capture-phase `scroll` (the stage scrolls inside its own track, and that scroll never reaches the window), and scrolls the target into view when the selector changes — smoothly under full motion, instantly under reduced. Model it on the geometry the deleted `Tour.tsx` used: four plain rectangles around the hole rather than a mask or a spread shadow, because four rectangles need no compositing and cost nothing to move on a phone.

Requirements the tests and the constraints pin:

- Root element carries `data-testid="spotlight"`, `aria-hidden="true"`, and `pointer-events: none`.
- Class is `spotlight spotlight--soft` with no target, `spotlight spotlight--whole` with a target that has no size, and `spotlight spotlight--cutout` with a measured one.
- `data-motion` is `full` or `reduced` from `useReducedMotion()`, matching how `TierNode` does it.
- Geometry is inline style because it is measured at run time; colors and the ring live in the stylesheet, where the tokens are.

- [ ] **Step 5: Write the styles**

Create `apps/web/src/ui/Spotlight.css`. The root is `position: fixed; inset: 0; pointer-events: none;` with a z-index **below** the prompt bar's 5. Bands use `--scrim` under `--cutout` and `--whole`; the soft variant fills the screen with `--scrim-soft`. The ring is `--accent-line` — line work, never `--accent`, because the scrim must not take the screen's one action color. Pulse the ring only under `[data-motion='full']`; under reduced motion it is static and still present.

- [ ] **Step 6: Pin the stylesheet contract**

jsdom cannot compute an animation or a stacking order, so two of the spec's §6 requirements have to be held by reading the stylesheet as text — the technique `Prompt.test.tsx` already uses for the two voices. Add to `Spotlight.test.tsx`:

```tsx
describe('the stylesheet contract', () => {
  it('keeps the ring under reduced motion', () => {
    // the ring rule sets its border/color unconditionally, not inside a [data-motion='full'] block
  });

  it('drops only the pulse under reduced motion', () => {
    // the animation declaration IS inside a [data-motion='full'] block
  });

  it('never spends the accent on the dim', () => {
    // no rule in Spotlight.css references var(--accent) at full strength
  });

  it('sits beneath the prompt bar', () => {
    // the spotlight's z-index is lower than the .shell__prompt z-index in App.css
  });
});
```

Replace each comment with a real assertion that reads the relevant `.css` file. The last one reads both files — it is the assertion that stops someone raising the spotlight's z-index and dimming the words that explain it.

- [ ] **Step 7: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Spotlight.test.tsx apps/web/src/ui/tokens.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/ui/Spotlight.tsx apps/web/src/ui/Spotlight.css \
        apps/web/src/ui/Spotlight.test.tsx apps/web/src/ui/tokens.css apps/web/src/ui/tokens.test.ts
git commit -m "Add the spotlight that dims around one live control"
```

---

### Task 7: Wire the spotlight, and give the bar its weight

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/ui/Prompt.css`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**

- Consumes: `Spotlight` (Task 6), `requestOpen` (Task 5), the data attributes (Task 4).

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/App.test.tsx`, in the onboarding describe:

```tsx
it('dims around the control the opening beat names', async () => {
  // assert a spotlight is rendered with the cutout or whole class while `stir` shows
});

it('brings the muster forward when the beat points into it', async () => {
  // drive to the beat that gates a Minion purchase and assert the muster panel is open
});

it('dims nothing once onboarding is over', async () => {
  // returning player: assert no spotlight is rendered at all
});
```

Replace each comment with a real assertion.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/App.test.tsx`
Expected: FAIL — no spotlight is rendered.

- [ ] **Step 3: Map a gate to a target and a panel**

Import `BeatGate` as a type from `@dm/content` and `Spotlight` from `./ui/Spotlight.tsx`, then add to `App.tsx`, at module scope beside `lineFor`:

```tsx
/**
 * Which control a beat is pointing at, and which panel holds it.
 *
 * Selectors rather than refs, for the reason the deleted tour gave: the rung, the row and
 * the post are all inside laid-out containers, and wrapping any of them to hold a ref
 * would change what the layout is arranging. The cost is a class or attribute rename
 * silently losing the spotlight, which the anchor test exists to catch.
 *
 * A gate of `none` points at nothing on purpose — a narrative beat dims the whole screen
 * rather than framing a control, because there is no control to frame.
 */
function spotlightFor(gate: BeatGate): { target?: string; panel?: string } {
  switch (gate.kind) {
    case 'rouse':
      return { target: `.stage-node[data-tier="${gate.tierId}"]` };
    case 'buy':
      return { target: `.rail__row[data-tier="${gate.tierId}"]`, panel: 'muster' };
    case 'appoint':
      return { target: `.miscreant__post[data-overseer="${gate.overseerId}"]`, panel: 'miscreants' };
    case 'none':
      return {};
  }
}
```

- [ ] **Step 4: Render it**

In the component, derive the spotlight from the showing beat and render it **before** the prompt's row so its lower z-index is also lower in source order:

```tsx
const spotlight = beat ? spotlightFor(beat.gate) : null;
```

Render `{spotlight && <Spotlight {...(spotlight.target ? { target: spotlight.target } : {})} />}` and pass `{...(spotlight?.panel ? { requestOpen: spotlight.panel } : {})}` to `<Deck>`. Both spreads are conditional because `exactOptionalPropertyTypes` forbids passing `undefined` to an optional prop.

- [ ] **Step 5: Add the anchor test**

The selectors above are stringly-typed and a rename would silently lose the spotlight. Add a test that renders the real `App` on a first run and asserts every selector `spotlightFor` can produce for the shipped tracks resolves to an element on screen — the same guard the deleted tour's anchor test provided. Where a selector's element lives in a deck panel, open that panel first.

- [ ] **Step 6: Give the bar its weight**

In `apps/web/src/ui/Prompt.css`, raise `.prompt__line` from `--text-base` to `--text-lg`, and give `.prompt` a heavier ground and more room — the spec asks for a thing being said rather than a status line. Keep both voices, keep the narrator's `▸` marker and her italic, and keep every value a token.

In `apps/web/src/App.css`, confirm the three layers in a comment and in the numbers: spotlight below the prompt bar, prompt bar below the return summary. Nothing may reorder them — the dim must never fall across the words explaining it.

- [ ] **Step 7: Run everything**

Run: `./node_modules/.bin/vitest run`, the three per-package typechecks, `eslint .`, `prettier --check .`.
Expected: all clean.

- [ ] **Step 8: Report and stop**

Do **not** attempt a browser play-through — the controller does that. In your report, say plainly which of these you could not verify in jsdom: the cutout geometry, the click-through, the ring's pulse, and the deck panel actually coming forward on screen.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/ui/Prompt.css apps/web/src/App.test.tsx
git commit -m "Dim the screen around the control each beat names"
```

---

## Verification

After Task 7, the whole branch:

```bash
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p packages/engine/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
./node_modules/.bin/vitest run
```

Then the controller runs the browser pass, which is the only thing that can check the parts jsdom cannot measure:

- The hole lands on the right control at 1200×603 and 390×700.
- A click through the lit region reaches the control under it.
- The ring pulses under full motion and is static but present under reduced.
- The muster and miscreants panels come forward when their beats arrive.
- Caving twice brings the narrator's reply; resisting walks her to her fourth line and she gives up.
- The bar is never dimmed by the scrim.
