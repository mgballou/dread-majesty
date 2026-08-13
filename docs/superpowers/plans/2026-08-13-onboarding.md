# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five-card modal first-run tour with two in-flow prompt tracks — Dominion, which gates one action at a time up to the first Warren, and Malice, a second voice that teaches Smite by tempting the player into misusing it.

**Architecture:** Track definitions and copy live in `packages/content` and are exported as `CURRENT_ONBOARDING`, a sibling of `CURRENT_COPY` that is deliberately not part of `Content` — the engine never learns onboarding exists. All beat selection is pure functions in `apps/web/src/game/onboarding.ts` over a read-only `GameState`; React holds only the consumed sets and renders. A single `Prompt` bar at the foot of the frame shows at most one beat.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), React 19, Vite, Vitest, `break_eternity.js`.

**Spec:** `docs/superpowers/specs/2026-08-13-onboarding-design.md`. Read §2 (the model), §4 (Dominion), §5 (Malice) before starting.

## Global Constraints

- **The engine is untouched.** No file under `packages/engine` is modified by any task. `SAVE_VERSION` does not move and no migration is added.
- **`packages/content` exports onboarding as `CURRENT_ONBOARDING`, never as a field on `Content`.** Tutorial data must not enter the engine's argument type.
- **Every resource and generator count is a `Decimal`** (`break_eternity.js`). Apathy, cooldowns and `playTimeMs` are plain numbers in `GameState` and stay that way.
- **No `any`, no default exports, no `as` casts** except where a type guard genuinely cannot express it, with a comment saying why.
- **`as const` for every content literal and id set.** Ids are unions of literals, never `string`.
- **Object parameters once a function takes three or more arguments.** Two or fewer stay positional.
- **No raw color values outside `apps/web/src/ui/tokens.css`.** Semantic token names only.
- **No comments in tests** unless the test is genuinely unusual. One assertion per `expect`.
- **Engine tests never import shipping content.** Nothing in this plan adds such an import.
- **US English throughout.** Prose follows Orwell's rules: no long word where a short one will do, no passive where the active works, cut every word that can be cut.
- Run `pnpm check` before every commit. If `pnpm` is not on PATH, run the three parts by hand: `./node_modules/.bin/eslint .`, `./node_modules/.bin/vitest run`, and the typecheck **once per package** —

  ```bash
  npx tsc --noEmit -p packages/content/tsconfig.json
  npx tsc --noEmit -p packages/engine/tsconfig.json
  npx tsc --noEmit -p apps/web/tsconfig.json
  ```

  There is no root `tsconfig.json` — only `tsconfig.base.json`, which nothing extends from the root. A bare `npx tsc --noEmit` at the repo root therefore reads **zero** project files and prints "No errors found" whatever the state of the code. Confirmed with `--listFiles`: 0 project files at the root against 260, 285 and 474 for the three packages. Never trust the bare form.
- Commit messages: imperative, one line, **no trailers and no AI attribution**.
- Branch is `first-run-tour`, already checked out. Never commit to `main`.

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `packages/content/src/ids.ts` | Adds `DOMINION_BEAT_IDS`, `MALICE_BEAT_IDS` and their types. `TOUR_STEP_IDS` stays until Task 6. |
| `packages/content/src/onboarding.ts` *(new)* | The vocabulary: `BeatReady`, `BeatGate`, `OnboardingBeat`, `Onboarding`. Types only. |
| `packages/content/src/v1/onboarding.ts` *(new)* | `v1Onboarding` — the two tracks and every threshold they name. |
| `packages/content/src/copy.ts` | Adds `OnboardingCopy`, `GoadLine`, and `onboarding` on `Copy`. |
| `packages/content/src/v1/copy.ts` | The lines. |
| `packages/content/src/index.ts` | Exports the new types and `CURRENT_ONBOARDING`. |
| `apps/web/src/game/onboarding.ts` *(new)* | Pure beat selection and gating, plus the seen-flag. Replaces `game/tour.ts`. |
| `apps/web/src/ui/tokens.css` | `--raw-verdigris-400` and `--tone-malice`. |
| `apps/web/src/ui/Prompt.tsx` *(new)* | The bar. Presentational only — it is handed a line, a voice and callbacks. |
| `apps/web/src/ui/Prompt.css` *(new)* | Its styles, both voices. |
| `apps/web/src/ui/stage/ChainStage.tsx` | Honours `isGated`. |
| `apps/web/src/ui/rail/BuyRail.tsx` | Honours `isGated`. |
| `apps/web/src/ui/rail/Miscreants.tsx` | Honours `isGated`. |
| `apps/web/src/App.tsx` | Holds the consumed sets, threads `isGated`, renders `Prompt`. Deletes the tour wiring. |
| `apps/web/src/App.css` | The prompt's reserved row. |
| `README.md` | Rewrites the tour paragraph. |

**Deleted in Task 6:** `apps/web/src/ui/Tour.tsx`, `Tour.css`, `Tour.test.tsx`, `apps/web/src/game/tour.ts`, `tour.test.ts`, and `TOUR_STEP_IDS` / `TourStepId` / `TourCopy` / `TourStepCopy` / `Copy.tour` with their `v1` entries.

---

### Task 1: Content vocabulary and the two tracks

Adds the onboarding types, ids and track data. Nothing consumes them yet, and the tour is left untouched, so the web app still compiles at the end of this task.

**Files:**

- Create: `packages/content/src/onboarding.ts`
- Create: `packages/content/src/v1/onboarding.ts`
- Modify: `packages/content/src/ids.ts`
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/test/onboarding.test.ts`

**Interfaces:**

- Consumes: `TierId`, `OverseerId` from `./ids.ts`.
- Produces: `DOMINION_BEAT_IDS`, `MALICE_BEAT_IDS`, `DominionBeatId`, `MaliceBeatId`, `BeatReady`, `BeatGate`, `BeatVoice`, `OnboardingBeat<Id>`, `Onboarding`, `v1Onboarding`, `CURRENT_ONBOARDING`.

- [ ] **Step 1: Add the beat id sets**

In `packages/content/src/ids.ts`, append after the existing `TOUR_STEP_IDS` block (leave that block alone — Task 7 removes it):

```ts
/**
 * The first run, in the order it is walked.
 *
 * Nothing persists these — the interface records only that onboarding was seen — so
 * unlike every other id set in this file they may be renamed freely.
 *
 * The order is the argument the track makes: set the Minion working, learn that it
 * stops, learn that Evil buys more of them, hand the job to somebody else, take ground
 * of your own, start it, and then watch five Minions arrive without being asked.
 */
export const DOMINION_BEAT_IDS = [
  'stir',
  'orders',
  'muster',
  'appoint',
  'warren',
  'rouse-warren',
  'cascade',
] as const;
export type DominionBeatId = (typeof DOMINION_BEAT_IDS)[number];

/**
 * Smite, taught by being tempted into misusing it.
 *
 * Two of these three are the narrator and the middle one is not, which is why the voice
 * is a property of the beat rather than of the track. `apathy` follows `goad` so that
 * "her" always has an antecedent by the time the narrator uses it.
 */
export const MALICE_BEAT_IDS = ['first-blow', 'goad', 'apathy'] as const;
export type MaliceBeatId = (typeof MALICE_BEAT_IDS)[number];
```

- [ ] **Step 2: Write the failing test**

Create `packages/content/test/onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DOMINION_BEAT_IDS, MALICE_BEAT_IDS, v1, v1Onboarding } from '../src/index.ts';
import type { BeatGate, BeatReady } from '../src/index.ts';

const tierIds = v1.tiers.map((tier) => tier.id);
const overseerIds = v1.tiers.flatMap((tier) => tier.overseers.map((post) => post.id));

function readyIds(ready: BeatReady): readonly string[] {
  if ('tierId' in ready) return [ready.tierId];
  if ('overseerId' in ready) return [ready.overseerId];
  return [];
}

function gateIds(gate: BeatGate): readonly string[] {
  if ('tierId' in gate) return [gate.tierId];
  if ('overseerId' in gate) return [gate.overseerId];
  return [];
}

describe('the Dominion track', () => {
  it('holds one beat per id, in id order', () => {
    expect(v1Onboarding.dominion.map((beat) => beat.id)).toEqual([...DOMINION_BEAT_IDS]);
  });

  it('gates every beat but the last', () => {
    const gated = v1Onboarding.dominion.filter((beat) => beat.gate.kind !== 'none');
    expect(gated).toHaveLength(DOMINION_BEAT_IDS.length - 1);
  });

  it('leaves the last beat ungated', () => {
    expect(v1Onboarding.dominion.at(-1)?.gate.kind).toBe('none');
  });

  it('is spoken entirely by the narrator', () => {
    for (const beat of v1Onboarding.dominion) expect(beat.voice).toBe('narrator');
  });
});

describe('the Malice track', () => {
  it('holds one beat per id, in id order', () => {
    expect(v1Onboarding.malice.map((beat) => beat.id)).toEqual([...MALICE_BEAT_IDS]);
  });

  it('never gates', () => {
    for (const beat of v1Onboarding.malice) expect(beat.gate.kind).toBe('none');
  });

  it('gives the middle beat to her', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'goad')?.voice).toBe('her');
  });

  it('answers her in the narrator’s voice', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'apathy')?.voice).toBe('narrator');
  });

  it('clears goad on the next blow', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'goad')?.clearedBy).toBe('smite');
  });
});

describe('every beat names something that exists', () => {
  const beats = [...v1Onboarding.dominion, ...v1Onboarding.malice];

  it('names only real ids in its ready condition', () => {
    for (const beat of beats) {
      for (const id of readyIds(beat.ready)) {
        expect([...tierIds, ...overseerIds]).toContain(id);
      }
    }
  });

  it('names only real ids in its gate', () => {
    for (const beat of beats) {
      for (const id of gateIds(beat.gate)) {
        expect([...tierIds, ...overseerIds]).toContain(id);
      }
    }
  });

  it('clears a gated beat by its own gated action', () => {
    for (const beat of beats.filter((candidate) => candidate.gate.kind !== 'none')) {
      expect(beat.clearedBy).toBe('gated-action');
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: FAIL — `v1Onboarding` is not exported from `../src/index.ts`.

- [ ] **Step 4: Write the vocabulary**

Create `packages/content/src/onboarding.ts`:

```ts
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
```

- [ ] **Step 5: Write the tracks**

Create `packages/content/src/v1/onboarding.ts`:

```ts
import type { Onboarding } from '../onboarding.ts';

const SECOND = 1000;

/**
 * The first run, and the voice that interrupts it.
 *
 * Every threshold these beats name is read off the existing economy rather than added
 * to it — `can-afford-tier` and `can-afford-overseer` ask the live cost, so a balance
 * change moves the track with it and nothing here goes stale. Nothing in this file is a
 * balance number in its own right except the two retirement windows.
 *
 * The Dominion track ends at the first Warren's first cycle, which the harness puts at
 * about eleven minutes. See the spec §3.
 */
export const v1Onboarding: Onboarding = {
  dominion: [
    {
      id: 'stir',
      ready: { kind: 'always' },
      gate: { kind: 'rouse', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'orders',
      ready: { kind: 'idle-after-cycle', tierId: 'minion' },
      gate: { kind: 'rouse', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'muster',
      ready: { kind: 'can-afford-tier', tierId: 'minion' },
      gate: { kind: 'buy', tierId: 'minion' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'appoint',
      ready: { kind: 'can-afford-overseer', overseerId: 'minion-hand' },
      gate: { kind: 'appoint', overseerId: 'minion-hand' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'warren',
      ready: { kind: 'can-afford-tier', tierId: 'warren' },
      gate: { kind: 'buy', tierId: 'warren' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      id: 'rouse-warren',
      ready: { kind: 'owned-and-idle', tierId: 'warren' },
      gate: { kind: 'rouse', tierId: 'warren' },
      voice: 'narrator',
      clearedBy: 'gated-action',
      retireAfterMs: null,
    },
    {
      // The finale, and the only Dominion beat that gates nothing. It is a caption on
      // five Minions that arrived without being asked, which is why it cannot be written
      // any earlier: until the Warren has cycled there is nothing to caption.
      id: 'cascade',
      ready: { kind: 'cycled', tierId: 'warren' },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
  ],
  malice: [
    {
      id: 'first-blow',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: 12 * SECOND,
    },
    {
      // She arrives when the first blow has worn off and the button has relit — twenty
      // seconds after the strike on the shipped numbers. Two minutes of play time, then
      // she gives up, so a player who strikes once and never again is not left with a
      // permanent bar.
      id: 'goad',
      ready: { kind: 'blow-ready-after-first' },
      gate: { kind: 'none' },
      voice: 'her',
      clearedBy: 'smite',
      retireAfterMs: 120 * SECOND,
    },
    {
      // Band 2, not band 1. Bands are the floor of Apathy against a cap of 3, so band 1
      // arrives on the *second* rapid blow — scolding a player for taking her advice
      // exactly once. Band 2 lands on the third. See the spec §5.3 for the walk.
      id: 'apathy',
      ready: { kind: 'band-at-least', band: 2 },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: 12 * SECOND,
    },
  ],
};
```

- [ ] **Step 6: Export from the package surface**

In `packages/content/src/index.ts`, add `DOMINION_BEAT_IDS` and `MALICE_BEAT_IDS` to the value export from `./ids.ts`, and `DominionBeatId` / `MaliceBeatId` to the type export from `./ids.ts`. Then add:

```ts
export type {
  BeatReady,
  BeatGate,
  BeatVoice,
  BeatClearedBy,
  OnboardingBeat,
  Onboarding,
} from './onboarding.ts';

export { v1Onboarding } from './v1/onboarding.ts';
```

and, beside the existing `CURRENT` / `CURRENT_COPY` definitions:

```ts
import { v1Onboarding } from './v1/onboarding.ts';
import type { Onboarding } from './onboarding.ts';

/**
 * The onboarding the shipping game runs on.
 *
 * A sibling of `CURRENT_COPY`, deliberately **not** a field on `Content`. The engine
 * takes `Content` as an argument and must never learn that a tutorial exists.
 */
export const CURRENT_ONBOARDING: Onboarding = v1Onboarding;
```

- [ ] **Step 7: Run the test and the gate**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: PASS, 12 tests.

Run: `npx tsc --noEmit -p packages/content/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && ./node_modules/.bin/eslint .`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add packages/content/src/onboarding.ts packages/content/src/v1/onboarding.ts \
        packages/content/src/ids.ts packages/content/src/index.ts \
        packages/content/test/onboarding.test.ts
git commit -m "Add the onboarding vocabulary and its two tracks to content"
```

---

### Task 2: The onboarding copy

The lines, and the ordered `goad` list. Still nothing consumes them; the tour's copy stays in place until Task 6.

**Files:**

- Modify: `packages/content/src/copy.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/test/onboarding.test.ts`

**Interfaces:**

- Consumes: `DominionBeatId`, `MaliceBeatId` from Task 1.
- Produces: `GoadLine` (`{ aboveApathy: number; line: string }`), `OnboardingCopy`, and `Copy.onboarding`.

- [ ] **Step 1: Write the failing test**

Append to `packages/content/test/onboarding.test.ts`:

```ts
describe('the onboarding copy', () => {
  const copy = v1Copy.onboarding;

  it('gives every Dominion beat a line', () => {
    for (const id of DOMINION_BEAT_IDS) expect(copy.dominion[id].length).toBeGreaterThan(0);
  });

  it('orders the goad lines by descending threshold', () => {
    const thresholds = copy.goad.map((entry) => entry.aboveApathy);
    expect(thresholds).toEqual([...thresholds].sort((one, other) => other - one));
  });

  it('ends the goad list on a threshold that always matches', () => {
    expect(copy.goad.at(-1)?.aboveApathy).toBeLessThan(0);
  });

  it('gives every goad entry a line', () => {
    for (const entry of copy.goad) expect(entry.line.length).toBeGreaterThan(0);
  });

  it('offers both bail actions on the opening beat', () => {
    expect([copy.skip, copy.loadSave].every((label) => label.length > 0)).toBe(true);
  });
});
```

Add `v1Copy` to the existing import from `../src/index.ts` at the top of the file.

- [ ] **Step 2: Run it and watch it fail**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: FAIL — `v1Copy.onboarding` is undefined.

- [ ] **Step 3: Add the copy types**

In `packages/content/src/copy.ts`, add `DominionBeatId` to the existing type import from `./ids.ts` — and only that one. `OnboardingCopy.malice` names its two keys explicitly rather than keying off `MaliceBeatId`, so importing that type as well trips `noUnusedLocals`. Then add before `export interface Copy`:

```ts
/**
 * One of her lines, and the Apathy above which she says it.
 *
 * The threshold sits beside the sentence rather than in `v1/onboarding.ts` because it
 * paces prose, not the economy, and splitting a threshold from the line it chooses is
 * the easiest way to let the two drift.
 *
 * The list is **total**: entries run in descending order, selection takes the first
 * whose threshold Apathy exceeds, and the last threshold is negative so it always
 * matches. There is no fallback branch, and so none to leave untested.
 */
export interface GoadLine {
  readonly aboveApathy: number;
  readonly line: string;
}

/**
 * The first run, and the voice that interrupts it.
 *
 * Body text only — no titles. A standing order, not a card. The one place the shipped
 * tour's five titled cards survive is in what this replaced.
 */
export interface OnboardingCopy {
  /** Leaves both tracks for good. Offered on the opening beat and nowhere else. */
  readonly skip: string;
  /** Opens the Musings screen, which already holds Import. */
  readonly loadSave: string;
  /** Closes a beat that gates nothing. */
  readonly dismiss: string;
  /** Names the bar to a screen reader when the narrator holds it. */
  readonly narratorLabel: string;
  /** And when she does. */
  readonly herLabel: string;
  readonly dominion: Readonly<Record<DominionBeatId, string>>;
  readonly malice: {
    readonly 'first-blow': string;
    readonly apathy: string;
  };
  readonly goad: readonly GoadLine[];
}
```

Add to `export interface Copy`, beside the existing `readonly tour: TourCopy;`:

```ts
  readonly onboarding: OnboardingCopy;
```

- [ ] **Step 4: Write the lines**

In `packages/content/src/v1/copy.ts`, add beside the existing `tour` block:

```ts
  onboarding: {
    skip: 'Skip tutorial',
    loadSave: 'Load save',
    dismiss: 'Understood',
    narratorLabel: 'A word of advice',
    herLabel: 'She has something to say',
    dominion: {
      stir: 'One Minion, and a grievance. Set it about some wickedness.',
      orders:
        'Once they finish a task, they await further orders. Initiative seems a rare quality.',
      muster: 'One is not a host. Evil buys more of them, and more of them is more Evil.',
      appoint: 'Perhaps with enough Evil you can set someone about managing this for you.',
      warren: 'Take ground of your own. A Warren breeds Minions without being asked.',
      'rouse-warren': 'It will not start itself. They never do.',
      cascade:
        'Five Minions you did not raise, already at work. Everything above feeds what is below it, all at once. The rest is yours.',
    },
    malice: {
      'first-blow':
        'I knew it would not take long for you to take matters into your own hands. When you strike, the dark force in you runs through the ranks and everything works harder for a while. Try not to overdo it.',
      apathy: 'You listened to her. Everyone does, once. Let them rest and the fear returns.',
    },
    // Descending, and the last entry always matches. She flatters, then reads the
    // resistance and renames it weakness, then stops pushing and gets intimate — and
    // then she is simply correct, which is the only honest thing she says and the most
    // persuasive. See the spec §5.2.
    goad: [
      {
        aboveApathy: 0.45,
        line: 'Oh, that was good. Again — while they are still trembling. Don’t let them settle.',
      },
      {
        aboveApathy: 0.2,
        line: 'You are being careful. I do like that in you. But careful is not the same as strong.',
      },
      {
        aboveApathy: 0,
        line: 'No? Then I’ll wait with you. I have nothing else. Neither, in the end, do you.',
      },
      {
        aboveApathy: -1,
        line: 'There. They have forgotten you entirely. That is the moment — take it, and take all of it.',
      },
    ],
  },
```

- [ ] **Step 5: Export the types**

In `packages/content/src/index.ts`, add `OnboardingCopy` and `GoadLine` to the type export from `./copy.ts`.

- [ ] **Step 6: Run the test and the gate**

Run: `./node_modules/.bin/vitest run packages/content/test/onboarding.test.ts`
Expected: PASS, 17 tests.

Run: `npx tsc --noEmit -p packages/content/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && ./node_modules/.bin/eslint . && ./node_modules/.bin/prettier --check .`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add packages/content/src/copy.ts packages/content/src/v1/copy.ts \
        packages/content/src/index.ts packages/content/test/onboarding.test.ts
git commit -m "Write the onboarding copy and her four lines"
```

---

### Task 3: The pure beat engine

Beat selection, gating and the seen-flag, as pure functions over a read-only `GameState`. No React. This is where every rule in spec §2 lives, and it is the task that must be right.

**Files:**

- Create: `apps/web/src/game/onboarding.ts`
- Test: `apps/web/src/game/onboarding.test.ts`

**Interfaces:**

- Consumes: `Onboarding`, `OnboardingBeat`, `BeatReady`, `BeatGate`, `GoadLine` from `@dm/content`; `nextCost` from `@dm/engine`; `GameState` type from `@dm/engine`.
- Produces:
  - `type GatedControl = { kind: 'rouse'; tierId: TierId } | { kind: 'buy'; tierId: TierId } | { kind: 'appoint'; overseerId: OverseerId }`
  - `type ClearingAction = GatedControl | { kind: 'smite' } | { kind: 'dismiss' }`
  - `isBeatReady(ready: BeatReady, state: GameState, content: Content): boolean`
  - `showingBeat<Id extends string>(args: { track: readonly OnboardingBeat<Id>[]; consumed: readonly Id[]; state: GameState; content: Content }): OnboardingBeat<Id> | null`
  - `isGatedOut(gate: BeatGate, control: GatedControl): boolean`
  - `clearsBeat(beat: OnboardingBeat<string>, action: ClearingAction): boolean`
  - `goadLine(lines: readonly GoadLine[], apathy: number): string`
  - `hasSeenOnboarding(): boolean`, `markOnboardingSeen(): void`, `forgetOnboarding(): void`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/game/onboarding.test.ts`:

```ts
import Decimal from 'break_eternity.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT, CURRENT_ONBOARDING, v1Copy } from '@dm/content';
import type { DominionBeatId, OnboardingBeat, TierId } from '@dm/content';
import { createState, nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import {
  clearsBeat,
  forgetOnboarding,
  goadLine,
  hasSeenOnboarding,
  isGatedOut,
  markOnboardingSeen,
  showingBeat,
} from './onboarding.ts';

const content = CURRENT;
const dominion = CURRENT_ONBOARDING.dominion;
const malice = CURRENT_ONBOARDING.malice;

function fresh(): GameState {
  return createState(content);
}

function showing(
  state: GameState,
  consumed: readonly DominionBeatId[],
): OnboardingBeat<DominionBeatId> | null {
  return showingBeat({ track: dominion, consumed, state, content });
}

function affordable(state: GameState, tierId: TierId): boolean {
  const cost = nextCost(state, content, tierId);
  return cost !== null && state.resources.evil.gte(cost);
}

describe('showingBeat', () => {
  it('opens on stir', () => {
    expect(showing(fresh(), [])?.id).toBe('stir');
  });

  it('shows nothing while the roused cycle is still running', () => {
    const state = fresh();
    state.gens.minion.running = true;
    expect(showing(state, ['stir'])).toBeNull();
  });

  it('shows orders once the cycle has paid out', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(5);
    expect(showing(state, ['stir'])?.id).toBe('orders');
  });

  it('withholds muster until a Minion is affordable', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(5);
    state.resources.evil = new Decimal(10);
    expect(showing(state, ['stir', 'orders'])).toBeNull();
  });

  it('shows muster once a Minion is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(160);
    expect(showing(state, ['stir', 'orders'])?.id).toBe('muster');
  });

  it('never shows a beat out of order', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1e9);
    expect(showing(state, [])?.id).toBe('stir');
  });
});

describe('the gate never strands the player', () => {
  it('shows nothing after appointing when the Warren is still out of reach', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1800);
    state.overseers.minion = ['minion-hand'];
    const beat = showing(state, ['stir', 'orders', 'muster', 'appoint']);
    expect(beat).toBeNull();
  });

  it('shows the Warren beat once it is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(3000);
    state.overseers.minion = ['minion-hand'];
    const beat = showing(state, ['stir', 'orders', 'muster', 'appoint']);
    expect(beat?.id).toBe('warren');
  });

  it('never names a purchase the player cannot make', () => {
    const prefixes: readonly (readonly DominionBeatId[])[] = [
      ['stir', 'orders'],
      ['stir', 'orders', 'muster'],
      ['stir', 'orders', 'muster', 'appoint'],
    ];

    for (const consumed of prefixes) {
      for (const evil of [0, 1, 159, 160, 1199, 1200, 2999, 3000, 1e6]) {
        const state = fresh();
        state.resources.evil = new Decimal(evil);
        const beat = showing(state, consumed);
        if (beat?.gate.kind !== 'buy') continue;
        expect(affordable(state, beat.gate.tierId)).toBe(true);
      }
    }
  });
});

describe('isGatedOut', () => {
  it('holds back a tier the gate does not name', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'buy', tierId: 'warren' })).toBe(
      true,
    );
  });

  it('lets the named purchase through', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'buy', tierId: 'minion' })).toBe(
      false,
    );
  });

  it('holds back a rouse while a purchase is named', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'rouse', tierId: 'minion' })).toBe(
      true,
    );
  });

  it('gates nothing when the beat names nothing', () => {
    expect(isGatedOut({ kind: 'none' }, { kind: 'buy', tierId: 'warren' })).toBe(false);
  });
});

describe('clearsBeat', () => {
  const stir = dominion.find((beat) => beat.id === 'stir');
  const goad = malice.find((beat) => beat.id === 'goad');

  it('clears a gated beat on its own action', () => {
    expect(stir && clearsBeat(stir, { kind: 'rouse', tierId: 'minion' })).toBe(true);
  });

  it('leaves a gated beat alone on a different action', () => {
    expect(stir && clearsBeat(stir, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });

  it('clears goad on a blow', () => {
    expect(goad && clearsBeat(goad, { kind: 'smite' })).toBe(true);
  });

  it('leaves goad alone on a purchase', () => {
    expect(goad && clearsBeat(goad, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });
});

describe('goadLine', () => {
  const lines = v1Copy.onboarding.goad;

  it('flatters while the realm is still sore', () => {
    expect(goadLine(lines, 0.56)).toBe(lines[0]?.line);
  });

  it('reasons as the sting fades', () => {
    expect(goadLine(lines, 0.3)).toBe(lines[1]?.line);
  });

  it('feigns patience near the end', () => {
    expect(goadLine(lines, 0.1)).toBe(lines[2]?.line);
  });

  it('is finally correct at zero', () => {
    expect(goadLine(lines, 0)).toBe(lines[3]?.line);
  });

  it('takes the boundary as belonging to the line below it', () => {
    expect(goadLine(lines, 0.45)).toBe(lines[1]?.line);
  });
});

describe('the seen flag', () => {
  beforeEach(() => forgetOnboarding());

  it('starts unseen', () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it('remembers once marked', () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts`
Expected: FAIL — `./onboarding.ts` does not exist.

- [ ] **Step 3: Write the module**

Create `apps/web/src/game/onboarding.ts`:

```ts
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

const SEEN_KEY = 'dread-majesty:onboarding-seen';

/** An action the interface can offer and a beat can gate. Smite is deliberately absent. */
export type GatedControl =
  | { readonly kind: 'rouse'; readonly tierId: TierId }
  | { readonly kind: 'buy'; readonly tierId: TierId }
  | { readonly kind: 'appoint'; readonly overseerId: OverseerId };

/** Anything that can consume a beat. */
export type ClearingAction = GatedControl | { readonly kind: 'smite' } | { readonly kind: 'dismiss' };

/**
 * How tired the realm reads as, on the three-band scale the stage already draws.
 *
 * The floor of Apathy, because the cap is 3 and there are three bands. Kept as one
 * function so the beat condition and the stage can never disagree about where a band
 * starts.
 */
function band(state: GameState, content: Content): number {
  const share = state.smiteApathy / content.smite.apathy.cap;
  return Math.min(2, Math.floor(share * 3));
}

/** Whether a beat's condition holds on this state, right now. */
export function isBeatReady(ready: BeatReady, state: GameState, content: Content): boolean {
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
      return band(state, content) >= ready.band;
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
}: {
  track: readonly OnboardingBeat<Id>[];
  consumed: readonly Id[];
  state: GameState;
  content: Content;
}): OnboardingBeat<Id> | null {
  const next = track.find((beat) => !consumed.includes(beat.id));
  if (!next) return null;
  return isBeatReady(next.ready, state, content) ? next : null;
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
 * migration and a field the engine has to carry and ignore for ever.
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
```

- [ ] **Step 4: Run the test**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Run the gate**

Run: `npx tsc --noEmit -p packages/content/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && ./node_modules/.bin/eslint . && ./node_modules/.bin/vitest run`
Expected: all clean, no existing test broken.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/game/onboarding.ts apps/web/src/game/onboarding.test.ts
git commit -m "Add the pure beat selection and gating rules"
```

---

### Task 4: The verdigris token

One primitive, one semantic name, and the two contract tests that pin them. Small and separately rejectable: a reviewer can turn down the hue without touching the component that uses it.

**Files:**

- Modify: `apps/web/src/ui/tokens.css`
- Test: `apps/web/src/ui/tokens.test.ts`

**Interfaces:**

- Produces: the CSS custom property `--tone-malice`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/ui/tokens.test.ts`, add `'--tone-malice'` to the array in the existing test `holds every enumerated tone at AA against --surface`, so it reads:

```ts
    for (const name of [
      '--tone-positive',
      '--tone-danger',
      '--tone-resource',
      '--tone-apathy',
      '--tone-malice',
    ]) {
```

Then add to the `describe('nothing crowds the accent', …)` block:

```ts
  it('keeps her voice clear of gold', () => {
    expect(hueDistance('--tone-malice', '--accent')).toBeGreaterThanOrEqual(45);
  });

  it('keeps her voice clear of apathy', () => {
    expect(hueDistance('--tone-malice', '--tone-apathy')).toBeGreaterThanOrEqual(45);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/tokens.test.ts`
Expected: FAIL — `--tone-malice` is not declared.

- [ ] **Step 3: Declare the token**

In `apps/web/src/ui/tokens.css`, add to the primitives block, after `--raw-ash-400`:

```css
  /* Verdigris. Corroded bronze, and the only voice in the game that is spoken rather
     than written. Not gold, because gold means act and she never offers one; not ember,
     because ember is Evil; not ash, because ash is the gauge she is arguing against.
     Measured 7.3:1 against --surface and 110° of hue from gold. */
  --raw-verdigris-400: #3fa87e;
```

and to the semantic block, after `--tone-apathy-well`:

```css
  /* What she is drawn in. Tone rides with the data — this is the second voice of the
     onboarding prompt and nothing else may borrow it. */
  --tone-malice: var(--raw-verdigris-400);
```

- [ ] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/tokens.test.ts`
Expected: PASS. If the contrast or hue assertion fails, **do not relax the threshold** — adjust the hex until it passes, and correct the two figures in the comment and in spec §6 to whatever the test actually computes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/tokens.css apps/web/src/ui/tokens.test.ts
git commit -m "Add a verdigris tone for the second onboarding voice"
```

---

### Task 5: The prompt bar

Presentational only. It is handed a line, a voice and callbacks; it decides nothing.

**Files:**

- Create: `apps/web/src/ui/Prompt.tsx`
- Create: `apps/web/src/ui/Prompt.css`
- Test: `apps/web/src/ui/Prompt.test.tsx`

**Interfaces:**

- Consumes: `BeatVoice` from `@dm/content`, `--tone-malice` from Task 4.
- Produces:

  ```ts
  interface PromptProps {
    line: string;
    voice: BeatVoice;
    label: string;
    /** Shown only on the opening beat. */
    bail?: { skip: string; loadSave: string; onSkip: () => void; onLoadSave: () => void };
    /** Shown when the beat gates nothing and must be closed by hand. */
    dismiss?: { label: string; onDismiss: () => void };
  }
  export function Prompt(props: PromptProps): ReactNode
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/ui/Prompt.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Prompt } from './Prompt.tsx';

describe('Prompt', () => {
  it('shows the line it is given', () => {
    render(<Prompt line="Set it about some wickedness." voice="narrator" label="Advice" />);
    expect(screen.getByText('Set it about some wickedness.')).toBeInTheDocument();
  });

  it('names itself to a screen reader', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.getByRole('status', { name: 'Advice' })).toBeInTheDocument();
  });

  it('marks her voice on the element', () => {
    render(<Prompt line="Do it again." voice="her" label="She speaks" />);
    expect(screen.getByRole('status')).toHaveClass('prompt--her');
  });

  it('offers no bail actions by default', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onSkip when the player skips', async () => {
    const onSkip = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip, onLoadSave: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onLoadSave when the player has one to load', async () => {
    const onLoadSave = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip: vi.fn(), onLoadSave }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Load save' }));
    expect(onLoadSave).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when closed by hand', async () => {
    const onDismiss = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        dismiss={{ label: 'Understood', onDismiss }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Understood' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Prompt.test.tsx`
Expected: FAIL — `./Prompt.tsx` does not exist.

- [ ] **Step 3: Write the component**

Create `apps/web/src/ui/Prompt.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { BeatVoice } from '@dm/content';
import './Prompt.css';

interface PromptProps {
  line: string;
  voice: BeatVoice;
  /** Names the bar to a screen reader. Changes with the voice. */
  label: string;
  /** The opening beat's two ways out, and nowhere else. See the spec §4.2. */
  bail?: {
    skip: string;
    loadSave: string;
    onSkip: () => void;
    onLoadSave: () => void;
  };
  /** For a beat that gates nothing and so has no action to be cleared by. */
  dismiss?: {
    label: string;
    onDismiss: () => void;
  };
}

/**
 * One line at the foot of the frame, and at most one at a time.
 *
 * A `status` region rather than a dialog: it never takes focus, never traps it, and the
 * game behind it stays fully operable. The gating is done by the controls themselves,
 * which is what lets this be so much less machinery than the modal tour it replaced.
 *
 * `aria-live` is on the region so a beat arriving mid-play is announced without the
 * player being moved. The text is swapped in place rather than remounted, so a screen
 * reader reads the change rather than the whole bar again.
 *
 * **It decides nothing.** Which beat, which line and when are all worked out in
 * `game/onboarding.ts`; this is handed the result.
 */
export function Prompt({ line, voice, label, bail, dismiss }: PromptProps): ReactNode {
  return (
    <div className={`prompt prompt--${voice}`} role="status" aria-live="polite" aria-label={label}>
      <p className="prompt__line">{line}</p>

      {(bail || dismiss) && (
        <div className="prompt__actions">
          {bail && (
            <>
              <button type="button" className="button button--quiet" onClick={bail.onSkip}>
                {bail.skip}
              </button>
              <button type="button" className="button button--quiet" onClick={bail.onLoadSave}>
                {bail.loadSave}
              </button>
            </>
          )}
          {dismiss && (
            <button type="button" className="button button--quiet" onClick={dismiss.onDismiss}>
              {dismiss.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the styles**

Create `apps/web/src/ui/Prompt.css`:

```css
/*
 * The prompt sits in a row App.css holds from the first paint, so nothing on the page
 * moves when a beat arrives. See `.shell__prompt`.
 *
 * Two voices. The narrator is the reading ink, upright, led by a marker. She is
 * verdigris and italic and has no marker at all, because color alone must not carry
 * who is speaking — the distinction has to survive both a screen reader and a monitor
 * that renders the hue badly.
 */
.prompt {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--space-2);
  background: var(--surface-raised);
}

.prompt__line {
  flex: 1 1 20rem;
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.5;
}

.prompt--narrator .prompt__line {
  color: var(--ink-muted);
}

.prompt--narrator .prompt__line::before {
  content: '▸ ';
  color: var(--accent-line);
}

/* Hers. No marker, and the italic is the second signal after the tone. */
.prompt--her {
  border-color: var(--tone-malice);
}

.prompt--her .prompt__line {
  color: var(--tone-malice);
  font-style: italic;
}

.prompt__actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
}

@media (width <= 52rem) {
  .prompt {
    padding: var(--space-2) var(--space-3);
  }

  .prompt__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

- [ ] **Step 5: Run the test**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/Prompt.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/ui/Prompt.tsx apps/web/src/ui/Prompt.css apps/web/src/ui/Prompt.test.tsx
git commit -m "Add the onboarding prompt bar with its two voices"
```

---

### Task 6: Gating in the three controls

Each of the stage, the muster and the miscreants learns to hold a control back. The prop defaults to never-gating, so the app behaves identically until Task 7 passes one.

**Files:**

- Modify: `apps/web/src/ui/stage/ChainStage.tsx`
- Modify: `apps/web/src/ui/rail/BuyRail.tsx`
- Modify: `apps/web/src/ui/rail/Miscreants.tsx`
- Test: `apps/web/src/ui/stage/ChainStage.test.tsx`, `apps/web/src/ui/rail/BuyRail.test.tsx`, `apps/web/src/ui/rail/Miscreants.test.tsx`

**Interfaces:**

- Consumes: `GatedControl` from `apps/web/src/game/onboarding.ts` (Task 3).
- Produces: an `isGated?: (control: GatedControl) => boolean` prop on all three components. Omitted means nothing is gated.

- [ ] **Step 1: Read the three components first**

Read `ChainStage.tsx`, `BuyRail.tsx` and `Miscreants.tsx` in full before editing. Each already takes predicates of exactly this shape (`isUnlocked`, `isRousable`, `isAppointed`), and the new one must sit beside them and read the same way. Find where each renders its button and where the `disabled` attribute is already computed — the gate is one more clause on an existing expression, not a new wrapper.

- [ ] **Step 2: Write the failing tests**

All three test files already exist: `apps/web/src/ui/stage/ChainStage.test.tsx`,
`apps/web/src/ui/rail/BuyRail.test.tsx`, `apps/web/src/ui/rail/Miscreants.test.tsx`. Each
already builds its own props; **reuse that file's existing setup rather than inventing a
new one**, and add only the `isGated` prop to it. The three describes below name the
behavior to assert — write them against whatever render arrangement that file already uses.

In `ChainStage.test.tsx`, on a state where both the Minion and the Warren are owned and
rousable:

```tsx
describe('the onboarding gate', () => {
  it('disables a rung the gate does not name', () => {
    // isGated: (control) => !(control.kind === 'rouse' && control.tierId === 'minion')
    // assert: the Warren's rouse button is disabled
  });

  it('leaves the named rung live', () => {
    // same gate
    // assert: the Minion's rouse button is enabled
  });

  it('leaves every rung live when nothing is gated', () => {
    // isGated omitted
    // assert: the Warren's rouse button is enabled
  });

  it('never gates Smite', () => {
    // isGated: () => true
    // assert: the Smite control is enabled
  });
});
```

Replace each comment with the real assertion; they are here because the selector for each
button depends on that file's existing helpers, which the implementer will have in front of
them and this plan does not.

In `BuyRail.test.tsx`: with `isGated: (control) => !(control.kind === 'buy' && control.tierId === 'minion')`,
the Minion's Buy button is enabled and the Warren's is disabled; with `isGated` omitted, both
are enabled.

In `Miscreants.test.tsx`: with `isGated: (control) => !(control.kind === 'appoint' && control.overseerId === 'minion-hand')`,
the Taskmaster's button is enabled and every other post's is disabled; with `isGated` omitted,
affordability alone decides.

- [ ] **Step 3: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/stage apps/web/src/ui/rail`
Expected: FAIL — `isGated` is not a prop on any of the three.

- [ ] **Step 4: Add the prop to each component**

Add to each props interface, worded for that component:

```ts
  /**
   * Whether onboarding is holding this control back.
   *
   * A predicate of the same shape as the ones above it, so the component owes nothing to
   * how onboarding decides. Absent means nothing is gated, which is every state of the
   * game after the first run.
   */
  isGated?: (control: GatedControl) => boolean;
```

In `ChainStage`, the rouse button's `disabled` gains `|| isGated?.({ kind: 'rouse', tierId }) === true`. **The Smite control is not touched** — it stays live throughout, which is what lets the Malice track trigger at all. Add a comment there saying so.

In `BuyRail`, the purchase button's `disabled` gains `|| isGated?.({ kind: 'buy', tierId: tier.id }) === true`.

In `Miscreants`, the appoint button's `disabled` gains `|| isGated?.({ kind: 'appoint', overseerId: post.id }) === true`.

Import `GatedControl` as a type from `../../game/onboarding.ts` in each.

- [ ] **Step 5: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/ui`
Expected: PASS, including every test that existed before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/ui/stage/ChainStage.tsx apps/web/src/ui/stage/ChainStage.test.tsx \
        apps/web/src/ui/rail/BuyRail.tsx apps/web/src/ui/rail/BuyRail.test.tsx \
        apps/web/src/ui/rail/Miscreants.tsx apps/web/src/ui/rail/Miscreants.test.tsx
git commit -m "Let the stage, the muster and the miscreants hold a control back"
```

---

### Task 7: Wire it up and delete the tour

The last task, and the only one that removes anything. At the end of it the tour is gone from the repository and the two tracks run.

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `packages/content/src/ids.ts`, `copy.ts`, `v1/copy.ts`, `index.ts`
- Modify: `README.md`
- Delete: `apps/web/src/ui/Tour.tsx`, `Tour.css`, `Tour.test.tsx`, `apps/web/src/game/tour.ts`, `apps/web/src/game/tour.test.ts`

**Interfaces:**

- Consumes: everything produced by Tasks 1–6.

- [ ] **Step 1: Delete the tour**

```bash
git rm apps/web/src/ui/Tour.tsx apps/web/src/ui/Tour.css apps/web/src/ui/Tour.test.tsx \
       apps/web/src/game/tour.ts apps/web/src/game/tour.test.ts
```

Then remove from `packages/content`: the `TOUR_STEP_IDS` block and `TourStepId` in `ids.ts`; `TourCopy`, `TourStepCopy` and `readonly tour: TourCopy;` in `copy.ts`; the whole `tour:` block in `v1/copy.ts`; and every `Tour*` name from `index.ts`.

- [ ] **Step 2: Hold the prompt's row**

In `apps/web/src/App.css`, add before `.shell__foot`:

```css
/*
 * The prompt's row, held whether or not a beat is showing.
 *
 * Held rather than mounted on demand, for the reason `.shell__marker` is: a row that
 * appeared when the first beat arrived would shove the footer down the page mid-play.
 * The row is exactly as tall as the prompt at every width, including where it wraps on
 * a phone, so nothing moves when a beat lands or clears.
 */
.shell__prompt {
  margin-block-start: var(--space-4);
  min-height: 3.5rem;
}
```

- [ ] **Step 3: Write the failing tests**

Replace the tour describe in `apps/web/src/App.test.tsx` with:

```tsx
describe('first-run onboarding', () => {
  beforeEach(() => forgetOnboarding());

  it('opens on the first beat for a new player', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText(CURRENT_COPY.onboarding.dominion.stir)).toBeInTheDocument();
  });

  it('says nothing to a returning player', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(savedBlob());
    render(<App />);
    await screen.findByRole('button', { name: CURRENT_COPY.smite.action });
    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('says nothing to a player who has seen it before', async () => {
    markOnboardingSeen();
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findByRole('button', { name: CURRENT_COPY.smite.action });
    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('clears every prompt when the player skips', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.onboarding.skip }),
    );
    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('remembers a skip across visits', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.onboarding.skip }),
    );
    expect(hasSeenOnboarding()).toBe(true);
  });
});
```

Add `beforeEach(() => markOnboardingSeen())` to the top of every *other* describe in the file, replacing the existing `markTourSeen()` calls — jsdom has no IndexedDB, so without it every existing test looks like a first run and gets the prompt. Reuse whatever `savedBlob()` helper the file already has for a returning save.

- [ ] **Step 4: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/App.test.tsx`
Expected: FAIL — `forgetOnboarding` is not imported and no prompt renders.

- [ ] **Step 5: Wire the App**

First fix the imports. Drop `TOUR_ANCHORS`, `Tour`, `hasSeenTour` and `markTourSeen`. Add:

```tsx
import { CURRENT, CURRENT_COPY, CURRENT_ONBOARDING, type TierId } from '@dm/content';
import type { Copy, DominionBeatId, MaliceBeatId } from '@dm/content';
import {
  clearsBeat,
  goadLine,
  hasSeenOnboarding,
  isGatedOut,
  markOnboardingSeen,
  showingBeat,
  type ClearingAction,
  type GatedControl,
} from './game/onboarding.ts';
import { Prompt } from './ui/Prompt.tsx';
```

and bind the tracks beside the existing `content` and `copy`:

```tsx
const onboarding = CURRENT_ONBOARDING;
```

Then replace the tour block in `App.tsx` (the `tourOpen` state, `tourDecided` ref, its effect and `finishTour`) with:

```tsx
/**
 * Onboarding, for a first run and only a first run.
 *
 * Two conditions, and both are needed. `fresh` is this visit: a save on disk means a
 * returning player, whatever they have or have not been told. `hasSeenOnboarding` is
 * every visit before it, and it covers the player who arrived, skipped and closed the
 * tab before the first autosave ten seconds later — `fresh` alone would show it again.
 *
 * Latched into state rather than read every render, so it cannot reappear mid-session.
 */
const [running, setRunning] = useState(false);
const decided = useRef(false);
const [doneDominion, setDoneDominion] = useState<readonly DominionBeatId[]>([]);
const [doneMalice, setDoneMalice] = useState<readonly MaliceBeatId[]>([]);
/** Play time at which the beat on screen appeared, for the retirement clock. */
const shownAt = useRef<{ id: string; atMs: number } | null>(null);

useEffect(() => {
  if (!session.ready || decided.current) return;
  decided.current = true;
  if (session.fresh && !hasSeenOnboarding()) setRunning(true);
}, [session.ready, session.fresh]);

const stopOnboarding = useCallback(() => {
  markOnboardingSeen();
  setRunning(false);
}, []);
```

After `const { state, dispatch } = session;`, work out the beat on screen. **Dominion takes the bar; Malice shows only when no Dominion beat is showing** (spec §3.1):

```tsx
const dominionBeat = running
  ? showingBeat({ track: onboarding.dominion, consumed: doneDominion, state, content })
  : null;
const maliceBeat =
  running && dominionBeat === null
    ? showingBeat({ track: onboarding.malice, consumed: doneMalice, state, content })
    : null;
const beat = dominionBeat ?? maliceBeat;
```

Consume a beat when the player acts. Add one helper and call it from the existing `onRouse`, `onPurchase`, `onAppoint` and `onSmite` handlers, **after** the dispatch:

```tsx
const acted = useCallback(
  (action: ClearingAction): void => {
    if (dominionBeat && clearsBeat(dominionBeat, action)) {
      setDoneDominion((done) => [...done, dominionBeat.id]);
    }
    if (maliceBeat && clearsBeat(maliceBeat, action)) {
      setDoneMalice((done) => [...done, maliceBeat.id]);
    }
  },
  [dominionBeat, maliceBeat],
);
```

Retire a beat that nobody answered, on the same play-time clock the simulation runs on:

```tsx
useEffect(() => {
  if (!beat || beat.retireAfterMs === null) return;

  if (shownAt.current?.id !== beat.id) {
    shownAt.current = { id: beat.id, atMs: state.stats.playTimeMs };
    return;
  }

  if (state.stats.playTimeMs - shownAt.current.atMs >= beat.retireAfterMs) acted({ kind: 'dismiss' });
}, [beat, state.stats.playTimeMs, acted]);
```

Thread the gate into the three components. `isGated` is passed only while a beat is showing, so after onboarding the prop is absent and the controls are exactly what they were:

```tsx
const isGated = beat
  ? (control: GatedControl): boolean => isGatedOut(beat.gate, control)
  : undefined;
```

Pass `isGated={isGated}` to `ChainStage`, `BuyRail` and `Miscreants`. Because `exactOptionalPropertyTypes` is on, spread it conditionally — `{...(isGated ? { isGated } : {})}` — rather than passing `undefined`.

Add one resolver at module scope in `App.tsx`, below the component:

```tsx
/**
 * The line a beat says.
 *
 * `goad` is the only beat whose line is not fixed — hers is chosen from Apathy as it
 * bleeds, so the prompt mutates while the player resists and she works down her own
 * argument. Every other beat has exactly one line.
 *
 * The three Malice ids are checked before the Dominion lookup, so the fall-through can
 * only be reached by a Dominion id — and because the two unions are disjoint, the
 * typechecker knows it. No cast, and a beat added to either track without copy fails
 * typecheck rather than rendering an empty bar.
 */
function lineFor(copy: Copy, beatId: DominionBeatId | MaliceBeatId, apathy: number): string {
  if (beatId === 'goad') return goadLine(copy.onboarding.goad, apathy);
  if (beatId === 'first-blow') return copy.onboarding.malice['first-blow'];
  if (beatId === 'apathy') return copy.onboarding.malice.apathy;
  return copy.onboarding.dominion[beatId];
}
```

TypeScript narrows `beatId` to `DominionBeatId` after the three literal checks, because the
two unions share no members — so the final lookup typechecks with no cast at all. If it does
not, the two id sets have drifted into overlapping and **that** is the bug to fix, not this
function.

Render the bar in its held row, between `</main>` and `<footer className="shell__foot">`:

```tsx
<div className="shell__prompt">
  {beat && (
    <Prompt
      line={lineFor(copy, beat.id, state.smiteApathy)}
      voice={beat.voice}
      label={beat.voice === 'her' ? copy.onboarding.herLabel : copy.onboarding.narratorLabel}
      {...(beat.id === 'stir'
        ? {
            bail: {
              skip: copy.onboarding.skip,
              loadSave: copy.onboarding.loadSave,
              onSkip: stopOnboarding,
              onLoadSave: () => setLedgerOpen(true),
            },
          }
        : {})}
      {...(beat.clearedBy === 'dismiss'
        ? {
            dismiss: {
              label: copy.onboarding.dismiss,
              onDismiss: () => acted({ kind: 'dismiss' }),
            },
          }
        : {})}
    />
  )}
</div>
```

Finally, when Dominion's last beat is consumed, stop:

```tsx
useEffect(() => {
  if (running && doneDominion.length === onboarding.dominion.length) markOnboardingSeen();
}, [running, doneDominion.length]);
```

- [ ] **Step 6: Run the tests**

Run: `./node_modules/.bin/vitest run`
Expected: PASS, every file. If `App.test.tsx` still shows prompts in unrelated describes, the `markOnboardingSeen()` in their `beforeEach` is missing.

- [ ] **Step 7: Rewrite the README's onboarding paragraph**

Replace `README.md:105-108` — the paragraph beginning "A new player gets a five-card tour" — with exactly this:

```markdown
A first run is walked one action at a time. A line at the foot of the screen names the
next thing to do and holds back every other control until it is done, then clears and
leaves the player alone until the next moment worth teaching — six of them, ending when
the first Warren delivers five Minions nobody asked it for. It is skippable at the first
prompt and never returns.

The first time you smite, something else starts talking. It wants you to do it again
immediately, which is the wrong move, and it argues better the longer you refuse.
```

- [ ] **Step 8: Run the whole gate**

Run: `npx tsc --noEmit -p packages/content/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && ./node_modules/.bin/eslint . && ./node_modules/.bin/prettier --check . && ./node_modules/.bin/vitest run`
Expected: all clean. Confirm no file matching `[Tt]our` remains: `git ls-files | grep -i tour` prints nothing.

- [ ] **Step 9: Play it**

Run `npx vite --config apps/web/vite.config.ts` (or `pnpm dev`), open a private window so `localStorage` is empty, and walk the first three beats by hand. Confirm: the opening prompt offers Skip and Load save; rousing clears it immediately and the bar is empty while the cycle runs; the second prompt arrives when the cycle pays out; and while a beat is showing, every control except the named one and Smite is visibly disabled. Automated tests do not catch a gate that disables the wrong button.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Replace the first-run tour with the two onboarding tracks"
```

---

## Verification

After Task 7, the whole branch:

```bash
npx tsc --noEmit -p packages/content/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
./node_modules/.bin/vitest run
git ls-files | grep -i tour   # prints nothing
```

Then update PR #8's description to describe onboarding rather than the tour, since the branch no longer builds what that PR says it builds.
