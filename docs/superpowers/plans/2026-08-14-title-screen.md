# Title Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a title screen in front of a genuinely fresh run, move the premise onto it so the
first tutorial card teaches one thing, and make the crown's rate read as a whole number.

**Architecture:** Additive on the `first-run-tour` branch. Five tasks: the content package, the
hammer drawing, the screen, the wiring, and the rate. No `packages/engine` file is touched and
`SAVE_VERSION` does not move.

**Tech Stack:** pnpm monorepo, TypeScript strict, React 19 + Vite, Vitest, `break_eternity.js`.

**Spec:** `docs/superpowers/specs/2026-08-14-title-screen-design.md`. Read it before Task 1.

## Global Constraints

- **`pnpm` is not on PATH.** Use the local binaries:
  - tests: `./node_modules/.bin/vitest run <path>` — full suite with no path
  - lint: `./node_modules/.bin/eslint .`
  - format: `./node_modules/.bin/prettier --check .` (`--write` to fix)
- **There is no root `tsconfig.json`.** `npx tsc --noEmit` at the repo root reads **zero** project
  files and always prints "No errors found". It proves nothing. Typecheck per package:
  - `npx tsc --noEmit -p packages/content/tsconfig.json`
  - `npx tsc --noEmit -p packages/engine/tsconfig.json`
  - `npx tsc --noEmit -p apps/web/tsconfig.json`
- **Run prettier and eslint before every commit.** Prettier's formatting wins over this plan's
  line wrapping — the code blocks below show content, not exact wrapping.
- **US English**: "behavior", "color", "labeled", "judgment", "favor". Never the British forms.
  Roughly forty pre-existing files use British spellings; that is existing convention and **out of
  scope** — do not churn files you are not otherwise editing.
- **Commit messages**: imperative, one line, no trailers, **no AI attribution of any kind**.
- **If commit signing fails** (`1Password: agent returned an error`), commit with `--no-gpg-sign`
  and note the SHA. **Never** change `commit.gpgsign` in git config.
- **No `any`, no default exports, no `as` casts**, no stringly-typed ids. `as const` for every
  content literal. Discriminated unions over string flags.
- **Exhaustive `switch` with no `default` clause** — the compiler is the check.
- **`exactOptionalPropertyTypes` is on.** Optional props go by conditional spread, never
  `x={undefined}`.
- **`noUncheckedIndexedAccess` is on.** Every `arr[i]` is `T | undefined`.
- **No raw color values outside `tokens.css`.** Semantic token names only.
- **Game logic never lives in a React component.** Components render state and dispatch intents.
- **No comments in tests** unless the test is genuinely unusual. One assertion per `expect`.
- **Every test must be able to fail.** Ask what change to the source would break it; if the answer
  is "nothing", the test is inert — fix or delete it. This branch has produced inert tests four
  separate times.

---

## File Structure

**`packages/content/src/`**
- `art.ts` — `'hammer'` joins the shape union; new `mark/dread-majesty` slot
- `copy.ts` — new `StartCopy`; `Copy` gains `start`
- `v1/copy.ts` — the `start` block, and the `stir` rewrite

**`packages/content/test/`** — `art.test.ts` and `onboarding.test.ts` as they exist

**`apps/web/src/ui/art/TierArt.tsx`** — the hammer silhouette

**`apps/web/src/screens/TitleScreen.tsx` / `.css` / `.test.tsx`** — new, beside `OfflineSummary`

**`apps/web/src/App.tsx`** — the gate, the latch, the widened inert flag

**`apps/web/src/ui/format.ts`**, **`apps/web/src/ui/crown/Crown.tsx`** — the whole-number rate

---

## Task 1: Content — the slot, the copy, the opening line

**Files:**
- Modify: `packages/content/src/art.ts`
- Modify: `packages/content/src/copy.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Test: `packages/content/test/` — extend whatever art and copy tests exist there

**Interfaces:**
- Produces, for Tasks 2-4:
  - `ArtSlot['fallback']['shape']` gains `'hammer'`
  - `ART['mark/dread-majesty']` exists
  - `StartCopy { readonly lede: string; readonly premise: string; readonly begin: string }`
  - `Copy` gains `readonly start: StartCopy`

- [x] **Step 1: Read the spec**

Read `docs/superpowers/specs/2026-08-14-title-screen-design.md`. Sections 1, 2 and 2.3 are what
this task implements.

- [x] **Step 2: Add the hammer to the shape union and the manifest**

In `packages/content/src/art.ts`, add `'hammer'` to the `shape` union, then add the slot. Put it
after `resource/evil`:

```ts
  /**
   * The game's own mark, and the only slot that is not a tier or a resource.
   *
   * Drawn in the resource tone rather than any tier's: the hammer stands for the game, and
   * borrowing a rung's color would say it stood for that rung.
   */
  'mark/dread-majesty': {
    src: null,
    fallback: { shape: 'hammer', tone: 'resource' },
    alt: 'A black war hammer',
  },
```

- [x] **Step 3: Add the copy type**

In `packages/content/src/copy.ts`, above the `Copy` interface:

```ts
/**
 * The screen before the first frame of play.
 *
 * No heading of its own — the game's name is `Copy['title']`, and two places holding it is two
 * places to disagree. This is what the title screen says *besides* its name.
 */
export interface StartCopy {
  /** Who the player is, in one line. */
  readonly lede: string;
  /** What they are starting with. Carried here so the first tutorial beat need not. */
  readonly premise: string;
  /** The one action, and the way out. */
  readonly begin: string;
}
```

Add to `Copy`, beside the other screen blocks:

```ts
  readonly start: StartCopy;
```

Export `StartCopy` from `packages/content/src/index.ts`, in whatever form that file already uses.

- [x] **Step 4: Write the copy and fix the opening line**

In `packages/content/src/v1/copy.ts`, add the `start` block. Place it near the other screen copy,
matching the file's existing ordering:

```ts
  start: {
    lede: 'You are a Dark Lord',
    premise: 'One Minion, big dreams, and the favor of an otherworldly abomination.',
    begin: 'Start Game',
  },
```

Then change `stir` in the `onboarding.dominion` block. It currently reads:

```
'One Minion, big dreams, and the favor of an otherworldly abomination. Set it about some wickedness.'
```

It becomes:

```ts
      stir: 'A trusted lackey who will do your bidding. Set it about some wickedness.',
```

The premise now lives on the title screen. `it` points at the lackey in the sentence before,
which is the whole reason for the change — see spec §1.

- [x] **Step 5: Update the content tests**

There is an existing test in `packages/content/test/onboarding.test.ts`:

```ts
  it('plants her in the opening line', () => {
    expect(copy.dominion.stir).toContain('otherworldly abomination');
  });
```

That claim moves to the title screen. Replace it with two:

```ts
  it('plants her in the premise the title screen carries', () => {
    expect(v1Copy.start.premise).toContain('otherworldly abomination');
  });

  it('leaves the opening beat a plain instruction', () => {
    expect(copy.dominion.stir).not.toContain('abomination');
  });
```

Import `v1Copy` if that file does not already — it does, at the top.

**There is no art test file** — `packages/content/test/` holds only `copy.test.ts`,
`generators.test.ts` and `onboarding.test.ts`. Create `packages/content/test/art.test.ts`, and
since it is new, give it the manifest invariants that were never pinned rather than only the one
new slot:

```ts
import { describe, expect, it } from 'vitest';
import { ART } from '../src/index.ts';

describe('the art manifest', () => {
  it('gives the game its own mark', () => {
    expect(ART['mark/dread-majesty']?.fallback.shape).toBe('hammer');
  });

  it('draws the mark in the resource tone rather than a tier’s', () => {
    expect(ART['mark/dread-majesty']?.fallback.tone).toBe('resource');
  });

  it('gives every slot an accessible name', () => {
    for (const slot of Object.values(ART)) expect(slot.alt.length).toBeGreaterThan(0);
  });

  it('ships no slot pointing at a file, so the build needs no art', () => {
    for (const slot of Object.values(ART)) expect(slot.src).toBeNull();
  });
});
```

Use a straight apostrophe in the test name if the file's lint config objects to the typographic
one; match whatever the neighboring test files do.

- [x] **Step 6: Run the content tests and typecheck**

```
./node_modules/.bin/vitest run packages/content
npx tsc --noEmit -p packages/content/tsconfig.json
```

`apps/web` will not typecheck until Task 4 adds `copy.start` consumers — that is expected. Do not
run the web typecheck.

- [x] **Step 7: Lint, format, commit**

```bash
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
git add packages/content
git commit -m "Give the game a mark and move the premise off the opening beat"
```

---

## Task 2: The hammer silhouette

**Files:**
- Modify: `apps/web/src/ui/art/TierArt.tsx`
- Test: `apps/web/src/ui/art/` — extend the existing TierArt test if there is one, else add
  `TierArt.test.tsx`

**Interfaces:**
- Consumes from Task 1: the `'hammer'` shape kind and the `mark/dread-majesty` slot.
- Produces: nothing new — `TierArt` renders the new kind.

- [x] **Step 1: Write the failing test**

Render `<TierArt slot="mark/dread-majesty" />` and assert the accessible name is the slot's `alt`
(`'A black war hammer'`). Add a second case asserting the decorative form exposes no accessible
name, if the existing test file already has that pattern for another slot — follow it rather than
inventing one.

Run: `./node_modules/.bin/vitest run apps/web/src/ui/art`
Expected: FAIL — the switch has no `hammer` arm, so the component throws or renders nothing.

- [x] **Step 2: Draw it**

Add a `case 'hammer':` arm to `shape()` in `TierArt.tsx`. The drawing conventions are set by the
arms already there and are not optional: a 48×48 viewBox, `fill="currentColor"`, weight carried by
`opacity` rather than by a second color, and cut-outs via `className="art__void"`.

```tsx
    case 'hammer':
      return (
        <g fill="currentColor">
          <rect x="9" y="7" width="30" height="13" />
          <rect x="5" y="10" width="4" height="7" opacity="0.5" />
          <rect x="39" y="10" width="4" height="7" opacity="0.5" />
          <rect x="21" y="20" width="6" height="22" opacity="0.74" />
          <rect x="18" y="42" width="12" height="4" />
          <rect x="22" y="10" width="4" height="7" className="art__void" />
        </g>
      );
```

Keep the arms in the same order as the union declares them, if the existing switch does that.

- [x] **Step 3: Look at it**

The silhouette must read as a hammer at 48px, not as a block on a stick. Render it and check.
**If it reads wrong, adjust the head-to-haft proportion and say what you changed and why in your
report** — the numbers above are a starting point, not a measurement, and this is the one part of
this plan I could not verify without seeing it.

- [x] **Step 4: Run, lint, commit**

```
./node_modules/.bin/vitest run apps/web/src/ui/art
npx tsc --noEmit -p apps/web/tsconfig.json
```

The web typecheck will still fail on `copy.start` until Task 4. Confirm the only errors are that,
and nothing in `TierArt.tsx`.

```bash
git add apps/web/src/ui/art
git commit -m "Draw the hammer"
```

---

## Task 3: The title screen

**Files:**
- Create: `apps/web/src/screens/TitleScreen.tsx`
- Create: `apps/web/src/screens/TitleScreen.css`
- Test: `apps/web/src/screens/TitleScreen.test.tsx`

**Interfaces:**
- Consumes: `StartCopy`, `Copy['title']`, `TierArt`, the `mark/dread-majesty` slot.
- Produces, for Task 4:
  ```ts
  export function TitleScreen(props: {
    title: string;
    copy: StartCopy;
    onStart: () => void;
  }): ReactNode
  ```

- [x] **Step 1: Read the precedent**

Read `apps/web/src/screens/OfflineSummary.tsx` and `OfflineSummary.css` first. This screen is the
same shape deliberately — spec §2.2 — and copying its structure is the requirement, not a
shortcut. Match how it declares its dialog role, how it names itself, and how its one primary
action is marked.

- [x] **Step 2: Write the failing tests**

In `TitleScreen.test.tsx`, following the render helpers the neighboring screen tests use:

1. It renders the game's name, the lede, and the premise.
2. Pressing the button calls `onStart` exactly once.
3. The button holds focus on mount (`document.activeElement`).
4. It exposes a modal dialog role and is named by its heading.

Run: `./node_modules/.bin/vitest run apps/web/src/screens/TitleScreen.test.tsx`
Expected: FAIL — the module does not exist.

- [x] **Step 3: Write the component**

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import type { StartCopy } from '@dm/content';
import { TierArt } from '../ui/art/TierArt.tsx';
import './TitleScreen.css';

interface TitleScreenProps {
  /** The game's name, from `Copy['title']` — never restated here. */
  title: string;
  copy: StartCopy;
  onStart: () => void;
}

/**
 * The screen before the first frame of play.
 *
 * The same shape as `OfflineSummary`, which is the game's other full-screen take-over: a modal
 * dialog, a sheet, and exactly one action which is the way out. Two screens that take the whole
 * screen should not disagree about how.
 *
 * It carries the premise so the first tutorial beat does not have to. That beat used to open on
 * three nouns and then say "it", and the nearest antecedent was the wrong one.
 *
 * Focus moves to the one action on mount. This is the entry point to the game and has a single
 * control, which is the case where taking focus helps rather than steals.
 *
 * **It decides nothing about when it is shown.** `App` owns that; see the spec §2.1.
 */
export function TitleScreen({ title, copy, onStart }: TitleScreenProps): ReactNode {
  const start = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    start.current?.focus();
  }, []);

  return (
    <div className="title" role="dialog" aria-modal="true" aria-labelledby="title-name">
      <div className="title__sheet">
        <span className="title__mark">
          <TierArt slot="mark/dread-majesty" size={72} decorative />
        </span>

        <h1 className="title__name" id="title-name">
          {title}
        </h1>

        <p className="title__lede">{copy.lede}</p>
        <p className="title__premise">{copy.premise}</p>

        <button
          type="button"
          ref={start}
          className="button button--primary title__start"
          onClick={onStart}
        >
          {copy.begin}
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Write the stylesheet**

Model `TitleScreen.css` on `OfflineSummary.css` — read it and reuse its scrim, sheet and centering
approach rather than inventing a second one. Requirements it must meet:

- Semantic tokens only. No hex values, no bare pixel colors.
- **It sits on the return summary's layer: `z-index: 10`.** That is what `.return` declares in
  `OfflineSummary.css:6`, against the prompt bar's 5 (`App.css:128`) and the spotlight's 4
  (`Spotlight.css:15`). Do not invent a number.
- The sheet is centered, readable at 390px wide, and never scrolls the body sideways.
- Respect `prefers-reduced-motion` if you add any entrance animation. If you add none, that is
  fine and is one less thing to strip.

Then extend the stacking contract. `apps/web/src/ui/Spotlight.test.tsx` holds a
`describe('the stylesheet contract')` with `rule()` and `zIndex()` helpers that read stylesheets
as text — that is where the three-layer order is pinned. Add a case asserting the title screen
sits at or above the return summary and above the prompt bar, using those helpers. The dim must
never fall across a screen that has taken the screen, and a stacking rule nobody pins is a
stacking rule that drifts.

- [x] **Step 5: Run and commit**

```
./node_modules/.bin/vitest run apps/web/src/screens
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
```

```bash
git add apps/web/src/screens
git commit -m "Add the title screen"
```

---

## Task 4: Wire it in

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes everything Tasks 1-3 produce.
- Produces: a green `apps/web` typecheck.

- [x] **Step 1: Write the failing tests**

In `App.test.tsx`, following its existing render helpers and its existing way of setting up a
fresh run versus a loaded save (read the file first — it already distinguishes these for the
onboarding decision):

1. **Shows on a fresh session with no save**: the lede is on screen.
2. **Does not show when a save was loaded.**
3. **Does not show after Start Game is pressed**, and stays gone.
4. **Never coexists with the return summary**: with an offline report present, the summary is on
   screen and the title screen is not.
5. **The shell is inert behind it** — assert the `inert` attribute on `.shell__frame`.
6. **The spotlight is withheld** while it is up, even though onboarding is running.
7. **`stir` does not carry the premise**: with the title screen dismissed and the opening beat on
   the bar, the prompt line does not contain "abomination".

Note the harness constraint this file lives under: faking `setTimeout` makes Testing Library hang
under vitest, so fake only `performance` and the animation frame, and install fakes before
`render`.

Run: `./node_modules/.bin/vitest run apps/web/src/App.test.tsx`
Expected: FAIL.

- [x] **Step 2: Hold the latch**

Add beside the other onboarding state in `App`:

```ts
  /**
   * Whether the player has pressed Start Game this session.
   *
   * Latched rather than derived, because `session.fresh` stays true for the whole session — a
   * reset later must not put the title screen back in front of a player who is mid-run.
   */
  const [started, setStarted] = useState(false);
```

- [x] **Step 3: Decide when it shows**

Place this beside `behindTheSummary`, and widen that flag rather than adding a sibling:

```ts
  // The return summary and the title screen are the two things that take the whole screen, and
  // they are mutually exclusive: a session fresh enough for the title screen cannot have an
  // offline report. The summary is checked first anyway, so the rule is enforced rather than
  // trusted — two stacked scrims are darker than either was drawn to be.
  const showTitle = session.fresh && !started && session.offline === null;

  // While either screen is up it *is* the screen. Everything behind it goes inert, so nobody
  // moving through the interface by keyboard lands on a rail they cannot see, and the one
  // primary action is the one on the sheet.
  const screenTaken = session.offline !== null || showTitle;
```

Replace every use of `behindTheSummary` with `screenTaken`. There are three: the `inert` prop on
`.shell__frame`, the spotlight's render guard, and the comment above the spotlight — read that
comment and update it, since it names the summary specifically and now covers two screens.

- [x] **Step 4: Render it**

Beside the `OfflineSummary` block at the end of the shell, after it:

```tsx
      {showTitle && (
        <TitleScreen title={copy.title} copy={copy.start} onStart={() => setStarted(true)} />
      )}
```

Import `TitleScreen` from `./screens/TitleScreen.tsx`.

- [x] **Step 5: Run the web suite**

```
./node_modules/.bin/vitest run apps/web
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p packages/engine/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

All three typechecks must exit 0 — this is the task that makes the web package compile again.

Existing tests may break: any that asserted the old `stir` string, and any first-run test that now
meets a title screen before the tutorial. Fix them to the new shapes rather than deleting them,
and re-read each one you touch — if the reshape left it asserting nothing, give it a real
assertion or delete it.

- [x] **Step 6: Lint, format, commit**

```bash
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
git add apps/web
git commit -m "Show the title screen before a run with no save"
```

---

## Task 5: The rate reads whole

**Files:**
- Modify: `apps/web/src/ui/format.ts`
- Modify: `apps/web/src/ui/crown/Crown.tsx`
- Test: `apps/web/src/ui/crown/Crown.test.tsx`

**Interfaces:**
- Independent of Tasks 1-4. Safe in any order.

Read spec §3 first.

- [x] **Step 1: Write the failing tests**

In `Crown.test.tsx`, following its existing render helper and its existing way of driving state:

1. A rate with a fractional part renders with no decimal point in the figure.
2. The surge case, at a value that used to render two places: assert the rendered figure has no
   `.` in it.

Run: `./node_modules/.bin/vitest run apps/web/src/ui/crown`
Expected: FAIL.

- [x] **Step 2: Change the call**

In `Crown.tsx`, the rate line uses `formatNumber(rate)`. Change it to `formatWhole(rate)` and
update the import. **Only the rate.** The souls multiplier keeps `formatNumber` — it is not a rate
and a surge does not make it noisy.

- [x] **Step 3: Correct the comment that now contradicts itself**

`formatWhole`'s doc comment in `apps/web/src/ui/format.ts` currently ends:

```
 * Rates are not this. "1.25 Evil per second" is a true thing to say and the decimal is
 * the information, so the crown's rate line stays on `formatNumber`.
```

That is now false, and a comment contradicting its own function is worse than no comment. Replace
that paragraph with:

```
 * The crown's rate is here too, and that is a reversal. The decimal is true, but a blow
 * multiplies the rate by `smiteBlow`, which is not a round number — so a surge turned a readable
 * 12.5 into 23.38, and the headline changed shape exactly when the player was looking at it. The
 * cost is that one automated Minion reads as 1 rather than 1.25; the rail still states the exact
 * yield per tier, which is where a player checks the arithmetic.
```

- [x] **Step 4: Run and commit**

```
./node_modules/.bin/vitest run apps/web
npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
```

```bash
git add apps/web
git commit -m "Read the rate as a whole number"
```

---

## Final gate

```bash
./node_modules/.bin/vitest run
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p packages/engine/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
```

All six clean. Then confirm no `packages/engine` file is in the diff, `SAVE_VERSION` is unchanged,
and no commit message carries AI attribution.
