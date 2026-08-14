# Malice Track Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Malice onboarding track finish reliably on both pathways, stop its
narrator beat withdrawing after five seconds, split her copy into two lists that each move
one way, give her a cutout on the strike button, and make the first blow discoverable.

**Architecture:** Additive on the `first-run-tour` branch. Four tasks, in dependency order:
the content package (types, ids, tracks, copy), the pure web modules, the `App` wiring, then
the discovery pulse. No `packages/engine` file is touched and `SAVE_VERSION` does not move —
onboarding progress lives in `localStorage`, not the save.

**Tech Stack:** pnpm monorepo, TypeScript strict, React 19 + Vite, Vitest, `break_eternity.js`.

**Spec:** `docs/superpowers/specs/2026-08-14-malice-track-design.md`. Read it before Task 1.

## Global Constraints

- **`pnpm` is not on PATH.** Use the local binaries:
  - tests: `./node_modules/.bin/vitest run <path>`
  - full suite: `./node_modules/.bin/vitest run`
  - lint: `./node_modules/.bin/eslint .`
  - format: `./node_modules/.bin/prettier --check .` (`--write` to fix)
- **There is no root `tsconfig.json`.** `npx tsc --noEmit` at the repo root reads **zero**
  project files and always prints "No errors found". It proves nothing. Typecheck per package:
  - `npx tsc --noEmit -p packages/content/tsconfig.json`
  - `npx tsc --noEmit -p packages/engine/tsconfig.json`
  - `npx tsc --noEmit -p apps/web/tsconfig.json`
- **US English.** "behavior", "color", "labeled", "judgment", "favor". Never the British forms.
  This applies to comments and prose. Roughly forty pre-existing files use British spellings;
  that is existing convention and **out of scope** — do not churn files you are not otherwise
  editing.
- **Commit messages**: imperative, one line, no trailers, **no AI attribution of any kind**.
  Never add `Co-Authored-By: Claude`.
- **If commit signing fails** (`1Password: agent returned an error`, `failed to fill whole
  buffer`), commit with `--no-gpg-sign` and carry on. **Never** change `commit.gpgsign` in git
  config.
- **No `any`, no default exports, no `as` casts**, no stringly-typed ids. `as const` for every
  content literal. Discriminated unions over string flags.
- **Exhaustive `switch` with no `default` clause** — the compiler is the check.
- **`exactOptionalPropertyTypes` is on.** An optional prop is passed by conditional spread
  (`{...(x ? { x } : {})}`), never as `x={undefined}`.
- **`noUncheckedIndexedAccess` is on.** Every `arr[i]` is `T | undefined`. Never index a fixture
  array positionally in a test — use `.find()` by id with a guard.
- **No comments in tests** unless the test is genuinely unusual.
- One assertion per `expect`.
- The engine never imports content balance data. Nothing in this plan touches the engine.

---

## File Structure

**`packages/content/src/`**
- `ids.ts` — `MALICE_BEAT_IDS` renamed member (`apathy` → `verdict`)
- `onboarding.ts` — `BeatReady` loses a variant, `BeatClearedBy` becomes a union with an object
  member, new `BeatPoints`, `OnboardingBeat` gains optional `points`
- `copy.ts` — `GoadLine` renamed `WaitingLine`; `OnboardingCopy` swaps `goad` for `urging` and
  `waiting`, and `malice.apathy` for `malice.verdict`
- `v1/onboarding.ts` — the Malice track rewritten
- `v1/copy.ts` — her two line sets, both verdict lines, the `cascade` fix
- `index.ts` — export surface follows the renames

**`packages/content/test/onboarding.test.ts`** — updated for all of the above

**`apps/web/src/game/`**
- `onboarding.ts` — latching, the rewritten `supersededBeat`, `clearsBeat` over the union,
  `bandCount` dropped, `caved` in progress, the two line pickers
- `spotlight.ts` — takes a beat, reads `points` with a gate fallback
- `onboarding.test.ts` — updated and extended

**`apps/web/src/App.tsx`** — track priority, the latch stamp, the clock restart, the `caved`
flag, line selection

**`apps/web/src/ui/stage/EvilNode.tsx` / `.css`**, **`ChainStage.tsx`** — the discovery pulse

**`docs/superpowers/specs/2026-08-13-onboarding-design.md`** — the stale `cascade` quotation

---

## Task 1: The content package

**Files:**
- Modify: `packages/content/src/ids.ts`
- Modify: `packages/content/src/onboarding.ts`
- Modify: `packages/content/src/copy.ts`
- Modify: `packages/content/src/v1/onboarding.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Modify: `packages/content/src/index.ts`
- Modify: `packages/content/test/onboarding.test.ts`
- Modify: `docs/superpowers/specs/2026-08-13-onboarding-design.md`

**Interfaces:**
- Produces, for Tasks 2-4:
  - `MaliceBeatId = 'first-blow' | 'goad' | 'verdict'`
  - `BeatPoints = { kind: 'rouse'; tierId: TierId } | { kind: 'buy'; tierId: TierId } | { kind: 'appoint'; overseerId: OverseerId } | { kind: 'smite' }`
  - `BeatClearedBy = 'gated-action' | 'smite' | 'dismiss' | { kind: 'superseded'; when: BeatReady }`
  - `OnboardingBeat<Id>` gains `readonly points?: BeatPoints`
  - `WaitingLine { readonly aboveApathy: number; readonly line: string }` (was `GoadLine`)
  - `OnboardingCopy` gains `readonly urging: readonly string[]` and
    `readonly waiting: readonly WaitingLine[]`; `malice` becomes
    `{ 'first-blow': string; verdict: { caved: string; resisted: string } }`
  - `BeatReady` no longer has a `band-at-least` variant

> **Expected:** `apps/web` will not typecheck at the end of this task. That is correct — Tasks
> 2 and 3 repair it. The gate for this task is the content package alone.

- [ ] **Step 1: Read the spec**

Read `docs/superpowers/specs/2026-08-14-malice-track-design.md` in full. Sections 1 through 5
and 7.1 are what this task implements.

- [ ] **Step 2: Rename the beat id**

In `packages/content/src/ids.ts`, change:

```ts
export const MALICE_BEAT_IDS = ['first-blow', 'goad', 'apathy'] as const;
```

to:

```ts
export const MALICE_BEAT_IDS = ['first-blow', 'goad', 'verdict'] as const;
```

Also in that file, around line 94, a doc comment reads "watch five Minions arrive without being
asked". Change "five Minions" to "Minions" — the count is not guaranteed. See §4.2 of the spec.

- [ ] **Step 2a: Add the two beat-id guards**

Still in `packages/content/src/ids.ts`, beside `isTierId` and in exactly the form the other
guards there use. Task 3 needs them to narrow the latch's remembered id back to one track.

```ts
export function isDominionBeatId(id: string): id is DominionBeatId {
  return (DOMINION_BEAT_IDS as readonly string[]).includes(id);
}

export function isMaliceBeatId(id: string): id is MaliceBeatId {
  return (MALICE_BEAT_IDS as readonly string[]).includes(id);
}
```

The `as readonly string[]` is the existing convention in this file — every guard there is written
this way, and it is the one place a cast is allowed because a guard cannot express it otherwise.
Match it rather than inventing a second form. Export both from `packages/content/src/index.ts`
alongside the other guards.

- [ ] **Step 3: Change the beat model types**

In `packages/content/src/onboarding.ts`:

Delete the `band-at-least` member of `BeatReady` (the last one, with its doc comment).

Add a new exported type after `BeatGate`:

```ts
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
```

Replace `BeatClearedBy` and its doc comment with:

```ts
/**
 * What consumes a beat, besides retiring unread.
 *
 * `superseded` carries its own condition: the beat is consumed when `when` holds on the
 * current state. A beat says what ends it rather than deferring to whether its successor
 * happens to be ready, which coupled two beats through a condition neither of them stated.
 */
export type BeatClearedBy =
  | 'gated-action'
  | 'smite'
  | 'dismiss'
  | { readonly kind: 'superseded'; readonly when: BeatReady };
```

Add to `OnboardingBeat<Id>`, after `gate`:

```ts
  /** Overrides `gate` for the spotlight only. Absent means the spotlight follows the gate. */
  readonly points?: BeatPoints;
```

- [ ] **Step 4: Change the copy types**

In `packages/content/src/copy.ts`:

Rename `GoadLine` to `WaitingLine` and update its doc comment's first line to describe the
waiting list. Keep the existing paragraph about the list being total.

Replace the `malice` and `goad` members of `OnboardingCopy` with:

```ts
  readonly malice: {
    readonly 'first-blow': string;
    /**
     * The narrator's answer to her, one line per way her turn ended. Chosen from a fact
     * recorded when she was consumed, not from a value re-read later — the beat latches, so
     * a line picked from decaying Apathy would be pinned to one arbitrary frame.
     */
    readonly verdict: {
      readonly caved: string;
      readonly resisted: string;
    };
  };
  /** What she says in the cooldown after a blow, indexed by lifetime blows and clamped. */
  readonly urging: readonly string[];
  /** What she says while she is being ignored, chosen by descending Apathy. */
  readonly waiting: readonly WaitingLine[];
```

- [ ] **Step 5: Rewrite the Malice track**

In `packages/content/src/v1/onboarding.ts`, replace the whole `malice` array with:

```ts
  malice: [
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
      // She arrives on the blow itself, on the same condition as the narrator, so she
      // queues directly behind him and takes the bar inside the cooldown — an answer to
      // what the player just did, with the whole cooldown to be read in. It also stops
      // her withdrawing: the old condition lapsed on every cooldown, so she vanished and
      // came back on each cave, which is most of why her lines looked like they repeated.
      //
      // Three lifetime blows ends her: the one that summoned her, plus two caves. A count,
      // not an Apathy band — a band is only reachable near the cooldown floor, so a player
      // striking every forty-five seconds caved over and over and was handed the ending
      // written for someone who resisted. See the spec §2.
      id: 'goad',
      ready: { kind: 'smites-at-least', count: 1 },
      gate: { kind: 'none' },
      points: { kind: 'smite' },
      voice: 'her',
      clearedBy: { kind: 'superseded', when: { kind: 'smites-at-least', count: 3 } },
      retireAfterMs: 75 * SECOND,
    },
    {
      // Ready always, so it lands however her turn ended, and dismiss-only so the player
      // closes the answer themselves. Which of its two lines it carries is decided by how
      // she was consumed, not by anything read off the state when it shows.
      id: 'verdict',
      ready: { kind: 'always' },
      gate: { kind: 'none' },
      voice: 'narrator',
      clearedBy: 'dismiss',
      retireAfterMs: null,
    },
  ],
```

Also update the file's header doc comment: it says "Nothing in this file is a balance number in
its own right except the two retirement windows." There is now one window. Fix the count.

- [ ] **Step 6: Rewrite the onboarding copy**

In `packages/content/src/v1/copy.ts`, replace the `cascade` line and the whole `malice` and
`goad` block. The `dominion` entries other than `cascade` are unchanged.

```ts
      cascade:
        'Minions you did not raise, already at work. Everything above feeds what is below it, all at once. The rest is yours.',
    },
    malice: {
      'first-blow':
        'I knew it would not take long for you to take matters into your own hands. When you strike, the dark force in you runs through the ranks and everything works harder for a while. Try not to overdo it.',
      verdict: {
        caved: 'You listened to her. Everyone does, once. Let them rest and the fear returns.',
        resisted:
          'You outlasted her. She has nothing else to do but wait. Let them rest and the fear returns.',
      },
    },
    // What she says in the twenty seconds after a blow. Indexed by lifetime blows, so it
    // only ever moves forward — the old single list was keyed to Apathy, which rises when
    // the player caves, and so walked her backwards through her own lines.
    //
    // Two entries against a three-blow supersession: the third blow ends her turn on the
    // frame it lands, so a third line would be unreachable. The picker clamps.
    urging: [
      "Oh, that was good. Again — while they are still trembling. Don't let them settle.",
      "There. You felt that, didn't you? Once more and they will not settle for a week.",
    ],
    // Descending, and the last entry always matches. She reads the resistance and renames
    // it weakness, then stops pushing and gets intimate — and then she is simply correct,
    // which is the only honest thing she says and the most persuasive. See the spec §4.
    //
    // Thresholds are set against when she actually reaches this state: the cooldown clears
    // twenty seconds after the blow with Apathy at 0.556, and it bleeds to zero at
    // forty-five. That gives the three lines roughly ten, eleven and thirty seconds.
    waiting: [
      {
        aboveApathy: 0.35,
        line: 'You are being careful. I do like that in you. But careful is not the same as strong.',
      },
      {
        aboveApathy: 0.12,
        line: "No? Then I'll wait with you. I have nothing else. Neither, in the end, do you.",
      },
      {
        aboveApathy: -1,
        line: 'There. They have forgotten you entirely. That is the moment — take it, and take all of it.',
      },
    ],
  },
} as const satisfies Copy;
```

The em dashes and typographic apostrophes are literal characters — copy them exactly.

- [ ] **Step 7: Fix the remaining stale count**

In `packages/content/src/v1/onboarding.ts`, the `cascade` beat's comment says "It is a caption
on five Minions that arrived without being asked". Change to "on Minions that arrived without
being asked".

In `docs/superpowers/specs/2026-08-13-onboarding-design.md`, three places quote the old line —
around lines 105, 184 and 188. Update the quoted string to the new one and change "five Minions
arrive" to "Minions arrive" in the mermaid edge label. A spec that quotes shipped copy must
quote what shipped.

- [ ] **Step 8: Check the export surface**

`packages/content/src/index.ts` re-exports the onboarding and copy types. Make sure it exports
`BeatPoints` and `WaitingLine` and no longer exports `GoadLine`. Follow whatever form the file
already uses.

- [ ] **Step 9: Update the content tests**

In `packages/content/test/onboarding.test.ts`:

Replace the `it("answers her in the narrator's voice")` case body's `'apathy'` with `'verdict'`.

Replace the whole `describe('the Malice track resolves')` block with:

```ts
describe('the Malice track resolves', () => {
  const malice = v1Onboarding.malice;
  const beat = (id: string) => malice.find((candidate) => candidate.id === id);

  it('keeps her talking until the player has caved twice', () => {
    expect(beat('goad')?.clearedBy).toEqual({
      kind: 'superseded',
      when: { kind: 'smites-at-least', count: 3 },
    });
  });

  it('lets the verdict land however her turn ended', () => {
    expect(beat('verdict')?.ready).toEqual({ kind: 'always' });
  });

  it('never expires the verdict', () => {
    expect(beat('verdict')?.retireAfterMs).toBeNull();
  });

  it('never expires the opening explanation', () => {
    expect(beat('first-blow')?.retireAfterMs).toBeNull();
  });

  it('leaves her the one beat that gives up on its own', () => {
    const timed = malice.filter((candidate) => candidate.retireAfterMs !== null);
    expect(timed.map((candidate) => candidate.id)).toEqual(['goad']);
  });

  it('brings her on with the blow rather than with the next one', () => {
    expect(beat('goad')?.ready).toEqual({ kind: 'smites-at-least', count: 1 });
  });

  it('gives every superseded beat a successor to hand over to', () => {
    for (const track of [v1Onboarding.dominion, v1Onboarding.malice]) {
      expect(typeof track.at(-1)?.clearedBy).toBe('string');
    }
  });

  it('points her at the strike rather than at her own gate', () => {
    expect(beat('goad')?.points).toEqual({ kind: 'smite' });
  });
});
```

In `describe('the onboarding copy')`, replace the three `copy.goad` cases with:

```ts
  it('orders the waiting lines by descending threshold', () => {
    const thresholds = copy.waiting.map((entry) => entry.aboveApathy);
    expect(thresholds).toEqual([...thresholds].sort((one, other) => other - one));
  });

  it('ends the waiting list on a threshold that always matches', () => {
    expect(copy.waiting.at(-1)?.aboveApathy).toBeLessThan(0);
  });

  it('gives every waiting entry a line', () => {
    for (const entry of copy.waiting) expect(entry.line.length).toBeGreaterThan(0);
  });

  it('gives her a line for every blow that can land while she is on screen', () => {
    expect(copy.urging.length).toBeGreaterThanOrEqual(2);
  });

  it('gives the narrator an answer for each way her turn ends', () => {
    expect([copy.malice.verdict.caved, copy.malice.verdict.resisted].every((l) => l.length > 0)).toBe(true);
  });

  it('does not promise the cascade a count it cannot keep', () => {
    expect(copy.dominion.cascade).not.toContain('Five');
  });
```

The `import type { BeatGate, BeatReady }` line at the top stays as it is.

- [ ] **Step 10: Run the content tests**

Run: `./node_modules/.bin/vitest run packages/content`
Expected: PASS, no skipped or empty tests.

- [ ] **Step 11: Typecheck the content package**

Run: `npx tsc --noEmit -p packages/content/tsconfig.json`
Expected: exit 0.

Do **not** run the web typecheck yet; it is expected to fail until Task 3.

- [ ] **Step 12: Commit**

```bash
git add packages/content docs/superpowers/specs/2026-08-13-onboarding-design.md
git commit -m "Rebuild the Malice track on a cave count, two line sets and both endings"
```

---

## Task 2: The pure web modules

**Files:**
- Modify: `apps/web/src/game/onboarding.ts`
- Modify: `apps/web/src/game/spotlight.ts`
- Test: `apps/web/src/game/onboarding.test.ts`

**Interfaces:**
- Consumes from Task 1: `BeatPoints`, `BeatClearedBy` as a union with an object member,
  `OnboardingBeat.points`, `WaitingLine`, `MaliceBeatId` including `'verdict'`, and the absence
  of `band-at-least`.
- Produces, for Task 3:
  - `isBeatReady({ ready, state, content }): boolean` — **`bandCount` is gone**
  - `showingBeat({ track, consumed, state, content, shownId }): OnboardingBeat<Id> | null`
  - `supersededBeat({ track, consumed, state, content }): Id | null`
  - `latches(beat): boolean`
  - `herLine({ urging, waiting, state }): string`
  - `urgingLine(lines: readonly string[], smites: number): string`
  - `waitingLine(lines: readonly WaitingLine[], apathy: number): string`
  - `OnboardingProgress` gains `readonly caved: boolean`
  - `spotlightFor(beat): { target?: string; panel?: string }` — **takes a beat, not a gate**

> **Expected:** `apps/web` still does not typecheck at the end of this task — `App.tsx` calls
> the old signatures. Task 3 repairs it. The gate here is
> `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts` plus the content suite.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/game/onboarding.test.ts`. Follow the file's existing helpers for building
fixture state — read it first and reuse whatever it already has rather than inventing a second
way to make a `GameState`. Do not index fixture arrays positionally; use `.find()` by id.

The cases that must exist, and each is one `it`:

1. A latching beat that has been shown stays showing when its `ready` no longer holds.
   Build a beat with `gate: { kind: 'none' }` and `clearedBy: 'dismiss'` whose `ready` is
   false, pass `shownId` equal to its id, and assert `showingBeat` returns it.
2. The same beat with `shownId: null` returns null.
3. A **gated** beat with `clearedBy: 'gated-action'` whose `ready` is false returns null even
   when `shownId` matches it — latching must not reach a gated beat.
4. `latches` is true for `{ gate: none, clearedBy: 'dismiss' }` and false for a gated beat.
5. `supersededBeat` returns the beat's id when its `superseded.when` holds.
6. `supersededBeat` returns null when `when` does not hold.
7. `supersededBeat` returns null for a beat whose `clearedBy` is a plain string.
8. `supersededBeat` reports the first **unconsumed** beat even when that beat's own `ready`
   is false. (This is the deadlock guard from the previous design and it still matters: she is
   superseded by the very strike that restarts the cooldown.)
9. `clearsBeat` returns false for a beat whose `clearedBy` is `{ kind: 'superseded', ... }`,
   for every action kind.
10. `urgingLine` returns the first entry at 1 blow and the second at 2.
11. `urgingLine` clamps: at 9 blows it returns the last entry.
12. `urgingLine` returns the first entry at 0 blows rather than reading off the front.
13. `waitingLine` picks the first entry whose threshold Apathy exceeds.
14. `waitingLine` takes the calmer line when Apathy sits exactly on a boundary (the threshold
    is exclusive).
15. `herLine` returns an urging line while `smiteCooldownMs > 0`.
16. `herLine` returns a waiting line when `smiteCooldownMs` is 0.
17. `readOnboarding` round-trips `caved: true`.
18. `readOnboarding` reads a stored object with no `caved` key as `caved: false`.
19. `spotlightFor` returns `.evil-node` for a beat whose `points` is `{ kind: 'smite' }`.
20. `spotlightFor` falls back to the gate for a beat with no `points` — assert the `buy` case
    still returns the row selector and the `muster` panel.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts`
Expected: FAIL — compile errors on the new exports, which do not exist yet.

- [ ] **Step 3: Drop `bandCount` and the band condition**

In `apps/web/src/game/onboarding.ts`:

Remove the `import { bandIndex } from './apathy.ts';` line. `apathy.ts` stays — `EvilNode` and
`ApathyArc` still use it.

Remove the `case 'band-at-least':` arm from `isBeatReady`, and remove `bandCount` from the
parameter object and its type. Do the same for `showingBeat` and `supersededBeat`.

- [ ] **Step 4: Add latching**

Add, above `showingBeat`:

```ts
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
```

Give `showingBeat` a `shownId: Id | null` parameter, documented as "the beat that was on screen
last frame, or null", and make its body:

```ts
  const next = track.find((beat) => !consumed.includes(beat.id));
  if (!next) return null;
  if (next.id === shownId && latches(next)) return next;
  return isBeatReady({ ready: next.ready, state, content }) ? next : null;
```

- [ ] **Step 5: Rewrite `supersededBeat`**

Replace the function and its doc comment with:

```ts
/**
 * The beat on screen whose own supersession condition has come true.
 *
 * The third answer to "what ends a beat", beside the player acting (`clearsBeat`) and nobody
 * acting for long enough (`shouldRetire`). This one is neither: the state has moved far enough
 * that the beat has said its piece.
 *
 * The condition rides on the beat rather than on whether its successor is ready. That earlier
 * shape coupled two beats through a condition neither of them stated, and it forced a subtle
 * rule about not requiring the beat being cleared to be ready — she is only ready when the
 * cooldown is clear, and the cave that supersedes her restarts it, so asking for her readiness
 * here deadlocked. Nothing asks now.
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
```

- [ ] **Step 6: Handle the union in `clearsBeat`**

```ts
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
```

- [ ] **Step 7: Replace `goadLine` with the two pickers**

Delete `goadLine` and its doc comment. Add:

```ts
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
```

Update the type import at the top of the file: `GoadLine` becomes `WaitingLine`.

- [ ] **Step 8: Carry `caved` in the written-down progress**

Add to `OnboardingProgress`:

```ts
  /** Whether she got what she asked for. Decides which line the verdict carries. */
  readonly caved: boolean;
```

Set `caved: false` in both `FINISHED` and `UNTOUCHED`, and add to `readOnboarding`'s returned
object:

```ts
    caved: 'caved' in parsed && parsed.caved === true,
```

- [ ] **Step 9: Point the spotlight from the beat**

Rewrite `apps/web/src/game/spotlight.ts`'s function. Keep the whole existing doc comment about
selectors versus refs and about panel ids — it is still true — and add a paragraph explaining
`points`. The signature and body become:

```ts
export function spotlightFor(
  beat: Pick<OnboardingBeat<string>, 'gate' | 'points'>,
): { target?: string; panel?: string } {
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
```

The paragraph to add:

```
 * A beat may `points` at a control it does not gate, and that is how she frames the strike:
 * pointing draws the eye, gating holds everything else back, and she must not gate — the
 * player refusing her is one of the two ways her conversation ends. Absent, the spotlight
 * follows the gate, which is every other beat.
```

- [ ] **Step 10: Run the tests**

Run: `./node_modules/.bin/vitest run apps/web/src/game/onboarding.test.ts packages/content`
Expected: PASS.

Every test in the file must assert something. If the reshape emptied an existing case — a test
that now builds a fixture and asserts nothing, or asserts a tautology — either give it a real
assertion or delete it. A previous pass on this branch left five silently vacuous tests behind;
read each case you touched and confirm it still tests what its name claims.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/game
git commit -m "Latch dismiss-only beats and give supersession its own condition"
```

---

## Task 3: Wire it into App

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes everything Task 2 produces.
- Produces nothing for later tasks except a green `apps/web` typecheck.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/App.test.tsx`, following the file's existing render helpers and its
existing approach to first-run setup and to advancing play time. Read the file first.

Note the two harness constraints this file already lives under:
- Faking `setTimeout` makes Testing Library hang under vitest. Fake only `performance` and the
  animation frame, and install the fakes **before** `render`.
- jsdom measures every element as zero, so the spotlight's cutout branch cannot be exercised
  here. Assert on which beat and which line are on screen, not on geometry.

The cases:

1. **The five-second regression.** Reach the verdict beat, then advance until its old condition
   would have lapsed, and assert its line is still on screen.
2. **The caved ending.** Three blows and the prompt reads the `caved` verdict line.
3. **Cadence independence.** Three blows spaced far enough apart that Apathy returns to zero
   between them still reach the `caved` verdict line. *This is the §2 defect and it fails on
   the shipped code.*
4. **The resisted ending.** One blow and 75 seconds of play time, and the prompt reads the
   `resisted` verdict line.
5. **The window restarts.** One blow, 70 seconds, a second blow, another 30 seconds — she is
   still on screen. (Total elapsed is past 75s from her first appearance.)
6. **Priority.** With the opening Dominion beat consumed and a Dominion beat and a Malice beat
   both ready, the prompt carries the Malice line.
7. **The opening beat is not interrupted.** On the very first beat, a blow does not take the
   bar — the opening line and its Skip tutorial button are both still on screen.
8. **Dominion resumes.** After the verdict is dismissed, the next ready Dominion beat takes the
   bar.
9. **The spotlight follows her to the strike.** While she is on screen, `spotlightFor` on the
   showing beat names `.evil-node` and that element is present in the rendered document. (This
   is the anchor test's job — a class rename must not silently lose the spotlight.)

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/App.test.tsx`
Expected: FAIL — compile errors on the changed signatures, then assertion failures.

- [ ] **Step 3: Remove the local `bandCount`**

Delete the `const bandCount = copy.smite.bands.length;` line and its comment. Nothing in the
onboarding path needs it now. `EvilNode` computes its own from the same copy.

- [ ] **Step 4: Hold the caved flag and widen the stamp**

```ts
  const [caved, setCaved] = useState(false);
```

Seed it in the decision effect beside the two lists:

```ts
    setCaved(decision.progress.caved);
```

Widen the shown stamp to carry the blow count, so the retirement clock can restart on a blow:

```ts
  /**
   * The beat on screen, when it appeared, and how many blows had landed then.
   *
   * The play time drives the retirement clock. The blow count restarts it: a beat asking for
   * an action that the player then takes has been answered, and giving up on them ten seconds
   * after they caved reads as the tutorial not watching. `goad` is the only beat this reaches
   * — every other beat asking for an action is cleared by it rather than timed out.
   */
  const shownAt = useRef<{ id: string; atMs: number; smites: number } | null>(null);
```

- [ ] **Step 5: Flip the track priority**

Replace the two `showingBeat` calls and the `beat` line with:

```ts
  /**
   * Which track holds the bar.
   *
   * Malice wins once it has started, and holds until it ends. Nothing is lost by making
   * Dominion wait: no Dominion beat carries a retirement window and every one of them is ready
   * off state that does not decay. Dominion winning is what cut into her conversation — the
   * track began on a blow struck during the ten-minute opening, got crowded off the bar, and
   * was interrupted by the next Dominion beat coming ready.
   *
   * The exception is the opening beat, which carries the only Skip tutorial and Load save
   * buttons in the game. A player who strikes before rousing anything must not lose their way
   * out for the next minute.
   */
  const openingDone = doneDominion.length > 0;
  const shownId = shownAt.current?.id ?? null;

  const maliceBeat =
    running && openingDone
      ? showingBeat({
          track: onboarding.malice,
          consumed: doneMalice,
          state,
          content,
          shownId: isMaliceBeatId(shownId) ? shownId : null,
        })
      : null;
  const dominionBeat =
    running && maliceBeat === null
      ? showingBeat({
          track: onboarding.dominion,
          consumed: doneDominion,
          state,
          content,
          shownId: isDominionBeatId(shownId) ? shownId : null,
        })
      : null;
  const beat = maliceBeat ?? dominionBeat;
```

`shownAt` is a ref read during render. That is deliberate and safe here: it holds what was on
screen last frame, the game loop re-renders every frame, and the only reader is the latch. Say
so in a comment.

`isDominionBeatId` and `isMaliceBeatId` come from `@dm/content`; Task 1 Step 2a adds them. Both
take `string`, not `string | null`, so the null check comes first — write the two `shownId`
arguments exactly as:

```ts
          shownId: shownId !== null && isMaliceBeatId(shownId) ? shownId : null,
```

```ts
          shownId: shownId !== null && isDominionBeatId(shownId) ? shownId : null,
```

- [ ] **Step 6: Record how she was consumed, and restart her clock**

Replace the retirement effect's body with:

```ts
  useEffect(() => {
    if (handedOver) {
      // A supersession is the state moving on rather than something the player did, so it is
      // consumed the way `retire()` is. It also means the player took the action the beat was
      // asking for — that is what a supersession condition reads — which is what the verdict
      // needs to know, and what it must not try to work out later from a value that decays.
      setDoneMalice((done) => [...done, handedOver]);
      setCaved(true);
      return;
    }

    if (!beat) {
      shownAt.current = null;
      return;
    }

    if (shownAt.current?.id !== beat.id || shownAt.current.smites !== state.stats.smites) {
      shownAt.current = {
        id: beat.id,
        atMs: state.stats.playTimeMs,
        smites: state.stats.smites,
      };
      return;
    }

    if (
      shouldRetire({ beat, shownAtMs: shownAt.current.atMs, playTimeMs: state.stats.playTimeMs })
    ) {
      retire();
    }
  }, [beat, handedOver, state.stats.playTimeMs, state.stats.smites, retire]);
```

`handedOver` loses its `bandCount` argument. Its doc comment's reference to the note in
`supersededBeat` about not requiring readiness should be reworded — that coupling is gone, but
the reason the check reads from the track rather than from `maliceBeat` still stands: the
handover must fire while she is off screen for her own cooldown.

- [ ] **Step 7: Write `caved` down**

Add it to the persistence effect's payload and its dependency array:

```ts
    writeOnboarding({
      dominion: doneDominion,
      malice: doneMalice,
      caved,
      done: doneDominion.length === onboarding.dominion.length,
    });
  }, [running, doneDominion, doneMalice, caved, onboarding.dominion.length]);
```

- [ ] **Step 8: Point the spotlight at the beat**

```ts
  const spotlight = beat ? spotlightFor(beat) : null;
```

- [ ] **Step 9: Choose the line**

Replace `lineFor` and its call. The function becomes:

```ts
function lineFor({
  copy,
  beatId,
  state,
  caved,
}: {
  copy: Copy;
  beatId: DominionBeatId | MaliceBeatId;
  state: GameState;
  caved: boolean;
}): string {
  if (beatId === 'goad') {
    return herLine({
      urging: copy.onboarding.urging,
      waiting: copy.onboarding.waiting,
      state,
    });
  }
  if (beatId === 'first-blow') return copy.onboarding.malice['first-blow'];
  if (beatId === 'verdict') {
    return caved ? copy.onboarding.malice.verdict.caved : copy.onboarding.malice.verdict.resisted;
  }
  return copy.onboarding.dominion[beatId];
}
```

Keep the existing comment about the three Malice ids being checked before the Dominion lookup —
it is what makes the fall-through type-safe — and update it to say three rather than whatever
it says now if the count changed.

The call site becomes `line={lineFor({ copy, beatId: beat.id, state, caved })}`.

- [ ] **Step 10: Run the web suite**

Run: `./node_modules/.bin/vitest run apps/web`
Expected: PASS.

Several existing tests will have broken on the signature changes — `App.test.tsx`,
`ChainStage.test.tsx`, `BuyRail.test.tsx`, `Miscreants.test.tsx` and `DevBar.test.tsx` all touch
onboarding. Fix them to the new shapes rather than deleting them, and check that each still
asserts what its name claims.

- [ ] **Step 11: Typecheck all three packages**

```bash
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p packages/engine/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```
Expected: all three exit 0.

- [ ] **Step 12: Commit**

```bash
git add apps/web
git commit -m "Give Malice the bar once it starts and pick the verdict from how she ended"
```

---

## Task 4: The first blow has to be findable

**Files:**
- Modify: `apps/web/src/ui/stage/EvilNode.tsx`
- Modify: `apps/web/src/ui/stage/EvilNode.css`
- Modify: `apps/web/src/ui/stage/ChainStage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/ui/stage/ChainStage.test.tsx`

**Interfaces:**
- Consumes: nothing new from Tasks 1-3 beyond a green tree.
- Produces: `EvilNode` and `ChainStage` gain an optional `beckon?: boolean` prop.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/ui/stage/ChainStage.test.tsx`, following its existing `stage({...})` helper:

1. With `beckon` passed and no blows struck, the Evil node carries `data-beckon="true"`.
2. Without `beckon`, it does not.
3. Under reduced motion the node still carries `data-beckon="true"` — the attribute is state,
   and dropping the animation is the stylesheet's job, not the component's.

Then a stylesheet contract case, in whichever test file this repo already uses for reading CSS
as text (search for an existing test that reads a `.css` file with `readFileSync`; follow it):

4. `EvilNode.css` gates the beckon animation on `[data-motion='full']`, so reduced motion drops
   it.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/stage`
Expected: FAIL.

- [ ] **Step 3: Add the prop and the attribute**

In `EvilNode.tsx`, add to the props interface:

```ts
  /** Draw the eye to a control the player has never used. See App for when. */
  beckon?: boolean;
```

Destructure it with a default of `false` and put it on the root element:

```tsx
    <div
      className="evil-node"
      data-motion={reduced ? 'reduced' : 'full'}
      data-smite={phase.kind}
      data-beckon={beckon ? 'true' : 'false'}
    >
```

`ChainStage.tsx` takes the same optional prop and passes it through with a conditional spread,
matching how it already forwards `isGated`.

- [ ] **Step 4: Animate it**

In `EvilNode.css`, at the end of the file:

```css
/* The first blow has to be found. Smite sits outside every cutout for the whole Dominion
   track, so without this the tutorial spends ten minutes quietly saying it is not the thing
   to look at, and it gets found by fiddling.

   Emphasis only, on a control that is already visible, labeled and reachable — so reduced
   motion drops it and puts nothing in its place. That is the opposite of the spotlight ring,
   which carries the pointing and therefore stays. */
.evil-node[data-motion='full'][data-beckon='true'][data-smite='ready'] .evil-node__strike {
  animation: evil-node-beckon var(--duration-slow) ease-in-out infinite;
}

@keyframes evil-node-beckon {
  50% {
    transform: scale(1.015);
  }
}
```

Before writing it, check `.evil-node__strike`, `:hover`, `:active` and `--lifted` at lines
28-60 for an existing `transform`. If one is there, this animation will fight it — animate
`box-shadow` or `opacity` on the medallion instead and say in the comment why.

- [ ] **Step 5: Decide when it runs, in App**

In `App.tsx`, beside the other onboarding derivations:

```ts
  /**
   * Whether to draw the eye to the strike.
   *
   * Never struck a blow, and not standing on the opening beat — that beat carries the only way
   * out of the tutorial, and a second thing asking for attention beside it is the near-tie the
   * accent has no hysteresis to survive. It ends itself the first time the button is used and
   * never returns, which is why there is no timer here and nothing random: a random delay in
   * the interface makes a timing-sensitive thing unreproducible exactly where it needs tuning,
   * and it would have no stopping condition.
   */
  const beckon = state.stats.smites === 0 && !(running && doneDominion.length === 0);
```

Pass it to `ChainStage` with a conditional spread, as `isGated` is passed.

- [ ] **Step 6: Run the web suite**

Run: `./node_modules/.bin/vitest run apps/web`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "Beckon at the strike until the player has struck once"
```

---

## Task 5: Tie the rate to the surge

**Files:**
- Modify: `apps/web/src/ui/crown/Crown.tsx`
- Modify: `apps/web/src/ui/crown/Crown.css`
- Test: `apps/web/src/ui/crown/Crown.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: nothing. Independent of the rest of this plan and safe to do in any order.

Read §7.3 of the spec first.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/ui/crown/Crown.test.tsx`, following its existing render helper and its existing
way of putting the state into a smite phase (it already tests all three standings — reuse that):

1. With the blow running, the rate figure carries `data-smite="active"`.
2. With the blow ready, it carries `data-smite="ready"`.
3. While cooling, it carries `data-smite="cooling"`.
4. The standing text is not inside the element carrying the attribute — it is a different fact
   and keeps its own color. Assert the standing element is not a descendant of the figure.

Then the stylesheet contract case, in the same file the repo already uses for reading CSS as
text (the same one Task 4 used):

5. `Crown.css` gives the active state `var(--tone-resource)` — the same token `EvilNode.css`
   uses on `[data-smite='active']`, which is what makes the two read as one fact. Assert the
   token name, not a hex value.

- [ ] **Step 2: Run them and watch them fail**

Run: `./node_modules/.bin/vitest run apps/web/src/ui/crown`
Expected: FAIL.

- [ ] **Step 3: Split the figure out of the line**

In `Crown.tsx`, replace the rate paragraph with:

```tsx
      {/* The figure and its label in their own span, so the surge can light the thing it
          actually changes. The standing beside it is a different fact and keeps its own
          color — lighting the whole line would say the whole line had changed. */}
      <p className="crown__rate">
        <span className="crown__figure" data-smite={smite.kind}>
          {formatNumber(rate)} {copy.evil.name} per second
        </span>
        <span className="crown__dot" aria-hidden="true" />
        <span className="crown__standing">{standing(smite, copy.smite, content)}</span>
      </p>
```

- [ ] **Step 4: Light it**

In `Crown.css`, after `.crown__rate`:

```css
/*
 * The blow's whole effect is that production runs harder, and this is the one figure that
 * reports production. Without this the number changes and nothing says why.
 *
 * `--tone-resource` is not a new choice: it is the Evil tone, and `EvilNode` already turns it
 * on `[data-smite='active']`. The same tone in two places reads as one fact; two different
 * highlights would read as two.
 *
 * Not carrying the state on its own — the standing on this same line reads "reigning" through
 * the surge, so this is emphasis on something already said in words.
 */
.crown__figure[data-smite='active'] {
  color: var(--tone-resource);
}
```

Do not add a transition unless `.crown` already uses one; if you do add one, gate it on
`prefers-reduced-motion` the way the rest of the app does.

- [ ] **Step 5: Run the web suite**

Run: `./node_modules/.bin/vitest run apps/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "Turn the rate to the Evil tone while the blow is running"
```

---

## Final gate

Run every check before reporting done:

```bash
./node_modules/.bin/vitest run
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p packages/engine/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
```

All six must be clean. Then confirm:

- No file under `packages/engine/src` is in the diff.
- `SAVE_VERSION` is unchanged.
- No commit message on this branch carries AI attribution:
  `rtk proxy git log --format='%an <%ae>%n%b' main..HEAD | grep -i claude` finds nothing.
