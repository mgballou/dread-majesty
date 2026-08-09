# Soul Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prestige soul formula's square root with a tunable exponent so the prestige loop settles near ×7 instead of diverging, and re-denominate everything priced in souls to match.

**Architecture:** One number does the work — `soulsEarned` stops hardcoding `.sqrt()` and reads `content.prestige.exponent`. Everything else in this plan is consequence: `msToNextSoul` inverts the same formula, the Keep prices and two achievement thresholds are written in the old denomination and must be restated, and existing saves carry old-denomination souls that need an exact conversion. The engine's global multiplier is not touched — favour stays linear in souls.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `break_eternity.js` Decimal, Vitest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-08-08-soul-curve-design.md`. Read §3, §4 and §6 before starting. Section numbers cited below refer to it.

**Branch:** Work continues on `post-smite-tuning`, which is already open as PR #7. Do **not** create a branch, do not merge, do not rebase, and do not force-push. Commit on top of what is there.

## Global Constraints

- **Never run `git rebase`, `git push --force`, or `git reset --hard`.** The branch is pushed and shared. If a commit needs correcting, add another commit.
- **Never edit a shipped `MIGRATIONS` entry** in `packages/engine/src/save.ts`. Correcting a migration means appending a new one. Entries 6 and 7 are shipped.
- **`packages/engine` may never import `@dm/content`'s balance data** (`v1`, `CURRENT`). Content types and the id vocabulary only. Lint enforces this.
- **Engine tests run against `packages/engine/test/fixtures/`, never shipping content.**
- **Every resource, generator count and soul figure is a `Decimal`.** Never a JS number.
- **No `any`, no default exports, no `as` casts** without a comment saying why a type guard cannot express it.
- **Object parameters once a function takes three or more arguments.** Two or fewer stay positional.
- `k · perSoul = 0.6` is the whole of the balance. `k = 600` and `perSoul = 0.001`. Changing one without the other moves the plateau (§3).
- Prose in comments and copy follows Orwell's rules and **US English** spelling.
- Run `pnpm check` before every commit. If `pnpm` is not on PATH, the working equivalents are in "Commands that actually work" below.

## Commands that actually work

`pnpm` was not on PATH in the session that wrote this plan. These are verified:

```bash
./node_modules/.bin/vitest run                      # all tests, all packages
./node_modules/.bin/vitest run packages/engine      # one package
npx tsc --noEmit -p packages/engine                 # typecheck one package
npx tsc --noEmit -p packages/content
npx tsc --noEmit -p apps/web
npx eslint .
npx prettier --check .
npx prettier --write <file>
node --experimental-strip-types packages/engine/scripts/harness.ts
```

`pnpm --filter @dm/engine test` silently does nothing. Do not use it and do not report its output as a pass.

`node --experimental-strip-types` cannot run `packages/engine/src/save.ts` — TypeScript parameter properties are unsupported. Anything needing `save.ts` must run as a Vitest test, not a script.

## File structure

| File | Responsibility in this change |
| --- | --- |
| `packages/content/src/types.ts` | `PrestigeDef` gains `exponent` |
| `packages/engine/test/fixtures/content.ts` | fixture prestige block gains `exponent` |
| `packages/engine/src/selectors.ts` | `soulsEarned` and `msToNextSoul` read the exponent |
| `packages/content/src/v1/generators.ts` | new prestige block; new Keep prices on 16 rungs |
| `packages/content/src/ids.ts` | two achievement ids change |
| `packages/content/src/v1/achievements.ts` | two achievement thresholds change |
| `packages/content/src/v1/copy.ts` | two achievement copy entries; `worth` percentage |
| `packages/engine/src/state.ts` | `SAVE_VERSION` 8 → 9 |
| `packages/engine/src/save.ts` | migration 8 → 9 |
| `packages/engine/scripts/harness.ts` | prestige-loop report and growth exponent |

---

### Task 1: Give `PrestigeDef` an exponent

The formula stops being a square root. This task changes only the shape of the data and the two selectors that read it — no balance numbers move, so every existing test must still pass unchanged.

**Files:**
- Modify: `packages/content/src/types.ts:193-199`
- Modify: `packages/engine/test/fixtures/content.ts:124`
- Modify: `packages/engine/src/selectors.ts:98-103` and `:129-148`
- Test: `packages/engine/test/selectors.test.ts`

**Interfaces:**
- Produces: `PrestigeDef` with `readonly exponent: number`. Later tasks set it to `0.055` in shipping content.
- Produces: `soulsEarned(state, content): Decimal` and `msToNextSoul(state, content): number | null` — signatures unchanged.

- [ ] **Step 1: Write the failing test**

Add to `packages/engine/test/selectors.test.ts`. The fixture's prestige block is `{ k: 150, scale: '1e11', perSoul: 0.02 }`; this test pins that a non-square-root exponent is honored, using a fixture override so shipping content is never involved.

```ts
describe('soulsEarned at an exponent that is not a square root', () => {
  it('raises lifetime Evil to the exponent the content names', () => {
    const content = { ...fixtureContent, prestige: { ...fixtureContent.prestige, exponent: 1 } };
    const state = createState(content);
    state.lifetimeEvil = new Decimal('2e11');

    expect(soulsEarned(state, content).toNumber()).toBe(300);
  });

  it('still reads as a square root when the exponent says so', () => {
    const content = { ...fixtureContent, prestige: { ...fixtureContent.prestige, exponent: 0.5 } };
    const state = createState(content);
    state.lifetimeEvil = new Decimal('4e11');

    expect(soulsEarned(state, content).toNumber()).toBe(300);
  });
});
```

With `exponent: 1`, `souls = 150 · (2e11 / 1e11)^1 = 300`. With `exponent: 0.5`, `souls = 150 · (4e11 / 1e11)^0.5 = 300`.

Check the file's existing imports before adding — `createState`, `Decimal` and the fixture content are already imported in this test file under names it already uses. Match them rather than adding duplicates.

- [ ] **Step 2: Run it and watch it fail**

```bash
./node_modules/.bin/vitest run packages/engine/test/selectors.test.ts
```

Expected: FAIL. Typecheck rejects `exponent` on `PrestigeDef`, and the first case would return 424 (the square root of 2 times 300) rather than 300.

- [ ] **Step 3: Add the field to the type**

In `packages/content/src/types.ts`, replace the `PrestigeDef` interface:

```ts
export interface PrestigeDef {
  /** souls = floor(k * (lifetimeEvil / scale) ^ exponent) */
  readonly k: number;
  readonly scale: string;
  /**
   * How steeply souls follow lifetime Evil. Not a free choice: the prestige loop
   * diverges unless `exponent * perSoul` stays under the reciprocal of how fast the
   * generator economy grows. See §2.1 of the 2026-08-08 soul curve spec, which also
   * says when to re-derive it.
   */
  readonly exponent: number;
  /** Additive share of the global multiplier granted per soul. 0.02 = +2%. */
  readonly perSoul: number;
}
```

- [ ] **Step 4: Add it to the fixture**

In `packages/engine/test/fixtures/content.ts`, line 124:

```ts
  prestige: { k: 150, scale: '1e11', exponent: 0.5, perSoul: 0.02 },
```

`0.5` keeps every existing fixture-based expectation exactly where it is.

- [ ] **Step 5: Add it to shipping content, unchanged in behavior**

In `packages/content/src/v1/generators.ts`, in the `prestige` block near line 367, add `exponent: 0.5` beside the existing `k`, `scale` and `perSoul`. Do not touch the other three values in this task — Task 3 does that, and keeping this task behavior-neutral is what makes the whole suite a regression check on it.

- [ ] **Step 6: Read the exponent in both selectors**

In `packages/engine/src/selectors.ts`, `soulsEarned`:

```ts
export function soulsEarned(state: GameState, content: Content): Decimal {
  const { k, scale, exponent } = content.prestige;
  const raw = state.lifetimeEvil.div(new Decimal(scale)).pow(exponent).mul(k);
  const nearest = raw.round();
  return raw.sub(nearest).abs().lte(SOUL_EPSILON) ? nearest : raw.floor();
}
```

And `msToNextSoul`, whose first two lines and comment both change. Replace lines 130-141 with:

```ts
  const { k, scale, exponent } = content.prestige;
  const target = new Decimal(scale).mul(
    soulsEarned(state, content).add(1).div(k).pow(1 / exponent),
  );
  const remaining = target.sub(state.lifetimeEvil);
  // `soulsEarned` raises lifetime Evil to `exponent`; `target` raises the soul count
  // back by its reciprocal. They are inverse operations, not the same computation, and
  // a double mantissa cannot always carry one back through the other exactly — well
  // past 1e30 the two paths routinely disagree about which side of an integer
  // `lifetimeEvil` actually sits on. A small exponent makes the reciprocal large,
  // which widens that gap rather than narrowing it, so this branch matters more here
  // than it did under the square root. `remaining <= 0` means precision has run out,
  // not that a soul is due. Null, the existing "cannot say" contract, is the honest
  // answer — never a false "any moment now" that would sit on the panel forever
  // because the soul count never moves to clear it.
  if (remaining.lte(0)) return null;
```

- [ ] **Step 7: Run the new test, then the whole suite**

```bash
./node_modules/.bin/vitest run packages/engine/test/selectors.test.ts
./node_modules/.bin/vitest run
```

Expected: the two new cases PASS, and **every other test passes unchanged**. Nothing in this task moves a balance number, so a failure anywhere else means the exponent was applied wrongly — most likely `.pow(exponent)` landing on the wrong side of the `k` multiply. If any test outside `selectors.test.ts` fails, stop and fix it rather than updating its expectation.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p packages/content && npx tsc --noEmit -p packages/engine && npx tsc --noEmit -p apps/web
npx eslint . && npx prettier --check .
git add -A
git commit -m "Let the content name how steeply souls follow lifetime Evil"
```

If the commit fails with `1Password: agent returned an error` or `failed to fill whole buffer`, re-run it with `--no-gpg-sign` and note the SHA in your report. Never set `commit.gpgsign` to false.

---

### Task 2: A property test for the formula and its inverse

`msToNextSoul` raises the soul count to `1 / exponent`, which at the shipping value is about 18.2. Steep powers are where precision goes. This task pins the round trip before Task 3 makes the exponent small, so a later failure is unambiguous.

**Files:**
- Test: `packages/engine/test/selectors.test.ts`

**Interfaces:**
- Consumes: `soulsEarned(state, content): Decimal` from Task 1, and `PrestigeDef.exponent`.

- [ ] **Step 1: Write the property test**

The property: for any lifetime Evil, the soul count is monotone — more Evil never yields fewer souls — and the next soul's target always sits strictly above the current lifetime Evil whenever `msToNextSoul` is willing to answer. Both hold at any exponent, which is why this is worth more than a table of examples.

```ts
describe('the soul formula and its inverse', () => {
  const exponents = [0.5, 0.2, 0.055];
  const lifetimes = ['1e10', '5e12', '3e15', '7e18', '2e22', '9e25'];

  it('never pays fewer souls for more lifetime Evil', () => {
    for (const exponent of exponents) {
      const content = { ...fixtureContent, prestige: { ...fixtureContent.prestige, exponent } };
      let previous = new Decimal(-1);
      for (const lifetime of lifetimes) {
        const state = createState(content);
        state.lifetimeEvil = new Decimal(lifetime);
        const souls = soulsEarned(state, content);
        expect(souls.gte(previous)).toBe(true);
        previous = souls;
      }
    }
  });

  it('puts the next soul strictly ahead of where the player stands', () => {
    for (const exponent of exponents) {
      const content = { ...fixtureContent, prestige: { ...fixtureContent.prestige, exponent } };
      for (const lifetime of lifetimes) {
        const state = createState(content);
        state.lifetimeEvil = new Decimal(lifetime);
        state.gens.minion.owned = new Decimal(10);
        const wait = msToNextSoul(state, content);
        if (wait === null) continue;
        expect(wait).toBeGreaterThan(0);
      }
    }
  });
});
```

`state.gens.minion.owned` is set because `msToNextSoul` returns null when nothing is producing, and a test that only ever hit the null branch would assert nothing. If the fixture's lowest tier is not `minion`, use whichever tier the fixture defines that produces `evil` — check `packages/engine/test/fixtures/content.ts` and use that id.

- [ ] **Step 2: Run it**

```bash
./node_modules/.bin/vitest run packages/engine/test/selectors.test.ts
```

Expected: PASS. This test describes behavior Task 1 already delivered — it is a net, not a red-green pair. If it fails, the bug is real and in Task 1's code.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Pin that souls rise with lifetime Evil at every exponent"
```

---

### Task 3: The new curve

The balance change. One block of four numbers.

**Files:**
- Modify: `packages/content/src/v1/generators.ts` (the `prestige` block, near line 367, and the file's header comment)
- Test: `packages/content/test/generators.test.ts`

**Interfaces:**
- Consumes: `PrestigeDef.exponent` from Task 1.
- Produces: shipping `prestige` = `{ k: 600, scale: '5.07e9', exponent: 0.055, perSoul: 0.001 }`.

- [ ] **Step 1: Write the failing test**

Add to `packages/content/test/generators.test.ts`. These pin the two things §3 says must not drift apart.

```ts
describe('the prestige curve', () => {
  it('holds the product that fixes the plateau', () => {
    expect(v1.prestige.k * v1.prestige.perSoul).toBeCloseTo(0.6, 6);
  });

  it('keeps the exponent under the threshold the economy allows', () => {
    // Spec §2.1: stability needs exponent * perSoul * k * a < 1, and measured `a` peaks
    // at 18.4. The product above is 0.6, so this is the whole of the condition.
    expect(v1.prestige.exponent * 0.6 * 18.4).toBeLessThan(1.05);
  });

  it('anchors the scale on the lifetime Evil that first paid a soul', () => {
    const { k, scale, exponent } = v1.prestige;
    // 5.147e9 is the measured lifetime Evil at 41m 51s.
    const souls = k * Math.pow(5.147e9 / Number(scale), exponent);

    expect(Math.round(souls)).toBe(600);
  });

  it('spans a run rather than a lifetime', () => {
    const { k, scale, exponent } = v1.prestige;
    // 2.394e15 and 2.1e25 are measured lifetime Evil at three and twelve hours.
    const atThreeHours = k * Math.pow(2.394e15 / Number(scale), exponent);
    const atTwelveHours = k * Math.pow(2.1e25 / Number(scale), exponent);

    expect(Math.round(atThreeHours)).toBe(1231);
    expect(Math.round(atTwelveHours)).toBe(4336);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
./node_modules/.bin/vitest run packages/content
```

Expected: FAIL. `k` is 150 and `perSoul` 0.02, so the product is 3, not 0.6.

- [ ] **Step 3: Set the numbers**

In `packages/content/src/v1/generators.ts`, replace the `prestige` block:

```ts
  prestige: {
    // `k` and `perSoul` are one lever: favour is `1 + perSoul * k * (L/scale)^exponent`,
    // so their product, 0.6, is the whole of the balance and `k` alone decides what the
    // player reads. Six hundred is a display choice — souls in the hundreds and
    // thousands at a tenth of a percent each, because a prestige currency reading `2`
    // reads as broken whatever the arithmetic underneath. Any pair holding the product
    // at 0.6 plays identically; changing one without the other moves the plateau.
    k: 600,
    // Lifetime Evil at 41m 51s, where the first soul has always landed.
    scale: '5.07e9',
    // Not a free choice. The old 0.5 made each reset raise the soul count to about the
    // ninth power, so favour ran ×12, then ×634, then past anything the simulation could
    // carry. See §1 and §2.1 of the 2026-08-08 soul curve spec for the measurement and
    // for when this has to be re-derived — it is tied to how fast the generator economy
    // grows, not to prestige.
    exponent: 0.055,
    perSoul: 0.001,
  },
```

- [ ] **Step 4: Update the file header's souls paragraph**

The header comment near line 168 currently reads that `scale` is 1.14e14 and `k` 150, that souls come out as `k·√(lifetime/scale)`, that the first soul lands at 41m 51s and 40–50 souls arrive at about 2h 10m, and that `perSoul` stays 0.02. **Every sentence of that paragraph is now false except the first-soul timing.** Replace the paragraph with:

```
 * *Souls.* `scale` is 5.07e9, `k` 600, `exponent` 0.055 and `perSoul` 0.001. Souls come
 * out as `k·(lifetime/scale)^exponent`. The first soul still lands at 41m 51s, which is
 * what `scale` names; the curve past it is far flatter than the square root it replaced,
 * because the square root let each reset raise the soul count to about the ninth power.
 * A run pays roughly 600 souls at 41m, 1,230 at three hours and 4,340 at twelve. `k` and
 * `perSoul` multiply to 0.6 and only that product matters to the balance.
```

The three figures: 600 souls at 41m, 1,231 at three hours, 4,336 at twelve. Round them in
prose as above; the tests in Step 1 carry the exact values.

Read the paragraph in place before replacing it — if it has drifted from this description, the file is the truth and this plan is stale. Say so in your report and match the file.

- [ ] **Step 5: Run the content tests, then everything**

```bash
./node_modules/.bin/vitest run packages/content
./node_modules/.bin/vitest run
```

Expected: the new prestige cases PASS. **Other tests may now fail**, and only two kinds of failure are legitimate: a test asserting an old soul figure, and a test asserting an old Keep or achievement threshold. Task 4 and Task 5 own those. If a failing test is neither, stop — it is a real regression.

List every test you had to leave failing in your report, by name. Do not delete or skip a test to get to green.

- [ ] **Step 6: Commit**

```bash
npx prettier --write packages/content/src/v1/generators.ts
git add -A
git commit -m "Flatten the soul curve so prestige settles instead of diverging"
```

---

### Task 4: Re-denominate the Keep prices

Keeping a rung costs 8 / 20 / 50 / 120 souls, which under the new curve is more than the economy will ever hold. §4.1 sets 220 / 660 / 1,100 / 1,760.

**Files:**
- Modify: `packages/content/src/v1/generators.ts` (the `souls` field on all 16 rungs, near lines 399-438)
- Test: `packages/content/test/generators.test.ts`

**Interfaces:**
- Consumes: `v1.prestige` from Task 3.
- Produces: every `SmiteRungDef.souls` at the new scale. `keepCost` in `packages/engine/src/smite.ts` reads these unchanged — no engine edit.

- [ ] **Step 1: Write the failing test**

```ts
describe('the soul price of permanence', () => {
  it('prices every ladder the same by rung', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.souls));

      expect(prices).toEqual([220, 660, 1100, 1760]);
    }
  });

  it('keeps a full ladder inside what a long run pays', () => {
    const ladder = v1.smite.upgrades[0]!.rungs.reduce(
      (total, rung) => total + Number(rung.souls),
      0,
    );
    const twelveHourRun = 600 * Math.pow(2.1e25 / Number(v1.prestige.scale), v1.prestige.exponent);

    expect(ladder).toBeLessThan(twelveHourRun);
  });
});
```

The second case is the one that matters: it is what stops the prices drifting back out of reach the next time the curve moves.

- [ ] **Step 2: Run it and watch it fail**

```bash
./node_modules/.bin/vitest run packages/content
```

Expected: FAIL, reporting `[8, 20, 50, 120]`.

- [ ] **Step 3: Set the prices**

In `packages/content/src/v1/generators.ts`, on all four ladders (`reach`, `weight`, `forgetting`, `restraint`), change each rung's `souls` value. Rung order is the same on every ladder:

| Rung | was | becomes |
| --- | --- | --- |
| 1 | `'8'` | `'220'` |
| 2 | `'20'` | `'660'` |
| 3 | `'50'` | `'1100'` |
| 4 | `'120'` | `'1760'` |

Sixteen values in total. Change only the `souls` field — every `evil` and `value` on those rungs stays exactly as it is.

- [ ] **Step 4: Update the comment above the ladders**

The comment near line 380 explains the soul prices in terms of the old scale ("8 souls costs about 8.4% of a first prestige"). Restate it:

```
 * The soul price of a Keep is 220/660/1100/1760 by rung, flat across all four ladders.
 * That is about 18% of a first prestige for the opening rung, the share it has always
 * been — the figures moved only because the 2026-08-08 soul curve re-denominated souls,
 * not because permanence got dearer. A full ladder is 3,740 souls and all four 14,960,
 * against a bank that reaches roughly 6,000 at the plateau and climbs past it on longer
 * runs and deeper content.
```

Read the comment in place first. If it says something other than the above, keep whatever it says that is still true and change only what the reprice falsified — then say in your report what you found and what you changed.

- [ ] **Step 5: Run the tests**

```bash
./node_modules/.bin/vitest run packages/content
./node_modules/.bin/vitest run
```

Expected: the Keep cases PASS. `generators.test.ts` already has a case asserting the soul price rises at every rung of every ladder — it must still pass, because 220 < 660 < 1100 < 1760.

- [ ] **Step 6: Commit**

```bash
npx prettier --write packages/content/src/v1/generators.ts
git add -A
git commit -m "Re-denominate the price of keeping a rung"
```

---

### Task 5: Retune the soul achievements

`souls-1` fires within seconds of the first Evil at the new scale and `souls-10000` sits past the plateau. §4.2 sets 500 / 3,000 / 10,000. Two ids change; `souls-10000` keeps both its id and its threshold.

**Files:**
- Modify: `packages/content/src/ids.ts:65-67`
- Modify: `packages/content/src/v1/achievements.ts:52-54`
- Modify: `packages/content/src/v1/copy.ts:131-141`
- Test: `packages/engine/test/save.test.ts`

**Interfaces:**
- Produces: `AchievementId` union containing `'souls-500'`, `'souls-3000'`, `'souls-10000'` in place of `'souls-1'`, `'souls-100'`, `'souls-10000'`.

- [ ] **Step 1: Write the failing test**

An id that vanishes must not strand a save. `deserialize` already filters `earnedAchievements` against the shipping id list, but nothing proves it. Add to `packages/engine/test/save.test.ts`:

```ts
describe('a save holding an achievement the build no longer ships', () => {
  it('loads, dropping the unknown id', () => {
    const state = createState(fixtureContent);
    const blob = { ...serialize(state), earnedAchievements: ['souls-1', 'prestige-1'] };

    const loaded = deserialize(blob as never, fixtureContent);

    expect(loaded.earnedAchievements).toEqual(['prestige-1']);
  });
});
```

`'souls-1'` is not in the fixture content's achievement list, which is what makes it stand in for a retired id. The `as never` is needed because `SaveBlob` types `earnedAchievements` as `AchievementId[]` and the whole point is a value outside that union — add a comment saying exactly that, since the constraints bar unexplained casts:

```ts
    // `as never`: the blob deliberately carries an id outside `AchievementId`, which is
    // the case under test and a shape the type cannot express.
```

Check `packages/engine/test/save.test.ts` for the names it already imports `serialize`, `deserialize`, `createState` and the fixture content under, and reuse them. If the fixture's achievement list has no `prestige-1`, use whichever id it does define.

- [ ] **Step 2: Run it**

```bash
./node_modules/.bin/vitest run packages/engine/test/save.test.ts
```

Expected: PASS — this documents existing behavior rather than driving new code. If it fails, the filter is not doing what `save.ts:126` appears to do, and that is a real bug to fix before going on.

- [ ] **Step 3: Change the ids**

In `packages/content/src/ids.ts`, lines 65-67:

```ts
  'souls-500',
  'souls-3000',
  'souls-10000',
```

- [ ] **Step 4: Change the thresholds**

In `packages/content/src/v1/achievements.ts`, lines 52-54:

```ts
  defineAchievement('souls-500', { kind: 'souls', atLeast: '500' }),
  defineAchievement('souls-3000', { kind: 'souls', atLeast: '3000' }),
  defineAchievement('souls-10000', { kind: 'souls', atLeast: '10000' }),
```

- [ ] **Step 5: Move the copy with them**

In `packages/content/src/v1/copy.ts`, the three entries at lines 131-141 are keyed by id, so two keys change. Keep each joke and change only the number:

```ts
    'souls-500': {
      name: 'First Damnation',
      description: 'Hold 500 Damned Souls. They are smaller than you expected.',
    },
    'souls-3000': {
      name: 'A Full Drawer',
      description: 'Hold 3,000 Damned Souls. You file them by date.',
    },
    'souls-10000': {
      name: 'A Low Sound',
      description: 'Hold 10,000 Damned Souls. In a quiet room you can hear them.',
    },
```

Both names survive. Only `souls-500`'s description changes wording — it read "Hold a Damned Soul. It is smaller than you expected", a singular that no longer fits a count of 500. `souls-10000` is untouched and reproduced here only so the block reads as a whole.

Typecheck will fail until every key in this record matches the `AchievementId` union, which is the safety net for getting a rename half-done.

- [ ] **Step 6: Run everything**

```bash
npx tsc --noEmit -p packages/content
./node_modules/.bin/vitest run
```

Expected: PASS. A content test asserts every achievement id has a copy entry and vice versa; it catches a missed rename.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/content/src/ids.ts packages/content/src/v1/achievements.ts packages/content/src/v1/copy.ts
git add -A
git commit -m "Move the soul achievements onto the new scale"
```

---

### Task 6: Migrate saves from the old denomination

Existing saves carry souls in the old scale. `lifetimeEvil` survives every reset, so the conversion is exact rather than a guess. §4.3.

**Files:**
- Modify: `packages/engine/src/state.ts:19`
- Modify: `packages/engine/src/save.ts` (`MIGRATIONS`)
- Test: `packages/engine/test/save.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime — the migration inlines its own constants.
- Produces: `SAVE_VERSION = 9` and a `MIGRATIONS[8]` entry.

- [ ] **Step 1: Write the failing test**

The invariant `souls + soulsSpent ≈ soulsEarned(lifetimeEvil)` is what `prestigeGain` rests on, and a naive per-field rescale breaks it because the map between denominations is not linear.

```ts
describe('migrating souls to the 2026-08-08 denomination', () => {
  const blob = {
    ...serialize(createState(fixtureContent)),
    saveVersion: 8,
    souls: '31630',
    soulsSpent: '0',
    lifetimeEvil: '5.07e18',
    smiteKept: { reach: 0, weight: 0, forgetting: 0, restraint: 0 },
  };

  it('lands the reported playtest save near eighteen hundred souls', () => {
    const migrated = migrate(blob as never);

    expect(Math.round(Number(migrated.souls) / 100) * 100).toBe(1800);
  });

  it('stamps the new version', () => {
    expect(migrate(blob as never).saveVersion).toBe(9);
  });

  it('never leaves the player owing souls they cannot have', () => {
    const migrated = migrate({ ...blob, soulsSpent: '792' } as never);

    expect(Number(migrated.souls)).toBeGreaterThanOrEqual(0);
  });

  it('charges the new price for rungs already kept', () => {
    const kept = { reach: 4, weight: 0, forgetting: 0, restraint: 0 };
    const migrated = migrate({ ...blob, smiteKept: kept } as never);

    expect(Number(migrated.soulsSpent)).toBe(3740);
  });
});
```

`5.07e18` is the lifetime Evil a 31,630-soul save recovers under the old formula, and `600 · (5.07e18 / 5.07e9)^0.055` is about 1,800. A full `reach` ladder at the new prices is 220 + 660 + 1100 + 1760 = 3,740.

The `as never` casts are needed because `SaveBlob['saveVersion']` is typed to the current version. Comment them the same way Task 5 does.

- [ ] **Step 2: Run it and watch it fail**

```bash
./node_modules/.bin/vitest run packages/engine/test/save.test.ts
```

Expected: FAIL — `migrate` throws `UnmigratableSave(8)`, because no step 8 exists.

- [ ] **Step 3: Raise the save version**

In `packages/engine/src/state.ts`, line 19:

```ts
export const SAVE_VERSION = 9;
```

Leave `MIN_SUPPORTED_SAVE_VERSION` at 6. The file carries a version history comment above `SAVE_VERSION` — add a line for 9 in the style already there, saying that souls were re-denominated.

- [ ] **Step 4: Write the migration**

Append to `MIGRATIONS` in `packages/engine/src/save.ts`. Do not touch entries 6 or 7.

```ts
  // 8 → 9: souls are re-denominated. The old curve paid `150·√(lifetime/1.14e14)` and
  // each soul was worth 2%; the new one pays `600·(lifetime/5.07e9)^0.055` at a tenth of
  // a percent. `lifetimeEvil` survives every reset, so the new total is not converted
  // from the old count at all — it is recomputed from the Evil that earned it, which is
  // exact where a rescale of the count would not be.
  //
  // The two soul fields cannot be converted separately. `prestigeGain` is
  // `soulsEarned − souls − soulsSpent`, and the map between denominations is not linear,
  // so rescaling each in turn would break that invariant and hand the player either free
  // souls or a debt they can never clear. Instead the total is recomputed, what the
  // player already owns is priced at the new rates, and the remainder is what they hold.
  //
  // Every constant here is inlined and frozen. The engine may not import balance data,
  // and a shipped migration must not drift when the content is next retuned.
  8: (blob) => {
    const KEEP_PRICES = [220, 660, 1100, 1760] as const;

    const earned = new Decimal(blob.lifetimeEvil).div(new Decimal('5.07e9')).pow(0.055).mul(600);

    let spent = new Decimal(0);
    for (const kept of Object.values(blob.smiteKept ?? {})) {
      for (let rung = 0; rung < kept; rung += 1) {
        spent = spent.add(KEEP_PRICES[rung] ?? 0);
      }
    }

    return {
      ...blob,
      saveVersion: 9,
      souls: Decimal.max(0, earned.sub(spent)).floor().toString(),
      soulsSpent: spent.toString(),
    };
  },
```

`KEEP_PRICES[rung] ?? 0` rather than a non-null assertion: `noUncheckedIndexedAccess` is on, and a save carrying a kept count beyond four rungs is corrupt data the migration should survive rather than crash on.

Check that `Decimal` is imported in `save.ts` — if it is not, add `import Decimal from 'break_eternity.js';` at the top with the other imports.

- [ ] **Step 5: Run the tests**

```bash
./node_modules/.bin/vitest run packages/engine/test/save.test.ts
./node_modules/.bin/vitest run
```

Expected: PASS, all four new cases and every existing save test. The existing suite has round-trip tests for versions 6 and 7; they must still pass, because their blobs now chain through the new step and it only touches soul fields.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p packages/engine
npx eslint . && npx prettier --check .
git add -A
git commit -m "Convert saved souls to the denomination that replaced them"
```

---

### Task 7: Say the new percentage

The panel renders `perSoul` as a percentage, so the copy follows the number without any layout change. §5.

**Files:**
- Modify: `packages/content/src/v1/copy.ts:230-231`
- Test: `apps/web/src/ui/rail/PrestigePanel.test.tsx`

**Interfaces:**
- Consumes: `v1.prestige.perSoul = 0.001` from Task 3.

- [ ] **Step 1: Read what renders it**

`apps/web/src/ui/rail/PrestigePanel.tsx:75` formats `perSoul × 100` and passes it to `copy.favour`, so "Their favour, at 0.1% each" comes out on its own once Task 3 lands. Only `copy.worth`, which hardcodes nothing but is described in §5, needs a look.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/ui/rail/PrestigePanel.test.tsx`, matching however that file already renders the panel:

```tsx
it('names the share a soul is worth', () => {
  renderPanel({ souls: new Decimal(1800) });

  expect(screen.getByText(/0\.1% each/)).toBeInTheDocument();
});

it('shows the favour those souls buy', () => {
  renderPanel({ souls: new Decimal(1800) });

  expect(screen.getByText('×2.8')).toBeInTheDocument();
});
```

`renderPanel` is a stand-in for whatever helper the file already uses — read the file and use its existing setup rather than adding a second way to render. If it renders inline, do that. 1,800 souls at 0.001 each is `1 + 1.8 = ×2.8`.

- [ ] **Step 3: Run it and watch it fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/PrestigePanel.test.tsx
```

Expected: FAIL on the percentage — the panel will be showing whatever the shipping `perSoul` renders as. If Task 3 has already landed, the first case may pass; the second still pins the multiplier.

- [ ] **Step 4: Check the copy still reads true**

In `packages/content/src/v1/copy.ts`, `prestige.worth` is a function of the rendered percentage:

```ts
    worth: (perSoul: string): string =>
      `Each soul adds ${perSoul} to everything you make. It never goes away.`,
```

This sentence survives the change with no edit — it takes the share as an argument. **Make no change unless the rendered string reads wrongly.** If it does, fix it and say so in your report. A task whose right answer is "nothing to change here" is a valid outcome; do not invent an edit to look busy.

- [ ] **Step 5: Run the web tests**

```bash
./node_modules/.bin/vitest run apps/web
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Show what a soul is worth at the new scale"
```

If nothing changed outside the test file, commit the test alone with the message `Pin what the prestige panel says a soul is worth`.

---

### Task 8: Teach the harness to play more than one run

The fault this whole plan fixes was invisible because nothing ever simulated a second run. §6 makes that a standing report.

**Files:**
- Modify: `packages/engine/scripts/harness.ts`

**Interfaces:**
- Consumes: `prestigeGain`, `soulsEarned`, `globalMultiplier` from `packages/engine/src`, and `apply` with `{ kind: 'prestige' }`.

- [ ] **Step 1: Read how the harness runs today**

`run(content)` in `packages/engine/scripts/harness.ts` builds one state, steps it for `SIMULATED_DAYS`, and prints tables. `decide(state, content)` is the buying policy. Both are reused as they are — this task adds a second report after the existing one and changes none of the current output.

- [ ] **Step 2: Add the prestige-loop report**

Append a function and call it at the end of `run`, after the existing tables print:

```ts
/**
 * Eight successive runs, claiming souls between each.
 *
 * The 2026-08-08 soul curve spec's §1 fault — favour compounding without limit — cannot
 * be seen in any single run, and every table above this one is a single run. What makes
 * a build safe is the last column settling, not landing in any particular band, so that
 * is what this reports.
 *
 * `a` is the growth exponent of lifetime Evil against time. Stability needs
 * `a · exponent · perSoul · k < 1`, and the spec's §2.1 says to re-read this whenever the
 * generator economy is retuned, not only when prestige is touched.
 */
function prestigeLoop(content: Content): void {
  const RUNS = 8;
  const RUN_MS = 3 * HOUR;
  const state = createState(content);

  console.log('\nPRESTIGE LOOP — eight three-hour runs');
  console.log('run  favour going in   souls held after');

  const favours: number[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const favour = globalMultiplier(state, content).toNumber();
    favours.push(favour);

    for (let t = 0; t < RUN_MS; t += DT_MS) {
      decide(state, content);
      step(state, content, DT_MS);
    }

    if (prestigeGain(state, content).gt(0)) {
      apply(state, content, { kind: 'prestige' });
    }

    console.log(
      `${String(run).padStart(3)}  ${favour.toFixed(2).padStart(15)}   ${state.souls.toExponential(3).padStart(16)}`,
    );
  }

  const last = favours[favours.length - 1] ?? 0;
  const previous = favours[favours.length - 2] ?? 0;
  const settled = previous > 0 && last / previous < 1.02;
  console.log(`\nsettled: ${settled ? 'yes' : 'NO — the loop is still climbing'}`);
}
```

`globalMultiplier` is exported from `packages/engine/src/step.ts` and re-exported from `selectors.ts`; import it alongside the selectors the harness already imports. `HOUR` and `DT_MS` are already defined in this file.

Note the reset is guarded on `prestigeGain(state, content).gt(0)` because `apply` refuses a prestige worth nothing, and an unguarded call would silently do nothing while the report claimed a reset happened.

- [ ] **Step 3: Add the growth exponent to the report**

The harness already records lifetime Evil at the checkpoints in `CHECKPOINTS`. After the checkpoint table prints, add:

```ts
/**
 * How steeply lifetime Evil grows with time, over the two windows the soul curve was
 * fitted against. `q · p · k · a < 1` is the stability condition; at the shipping
 * numbers the product is 0.6, so anything much above `a = 1.66` is a warning.
 */
function growthExponent(early: Decimal, late: Decimal, timesLonger: number): number {
  return late.div(early).ln().toNumber() / Math.log(timesLonger);
}
```

`timesLonger` is the ratio of the two sample times, not a duration — 2 for both 2h→4h and
4h→8h. Naming it `hours` would invite passing 4.

and print `a` over 2h→4h and 4h→8h using the lifetime Evil values the checkpoint pass already collected. Read how that pass stores them and use the same values rather than re-running the simulation — the harness is slow enough already.

- [ ] **Step 4: Run the harness**

```bash
node --experimental-strip-types packages/engine/scripts/harness.ts
```

Expected: the existing tables print unchanged, then the prestige loop. Favour should climb roughly ×2.2 → ×3.8 → ×5.2 → ×6.3 → ×6.7 → ×7.0 → ×7.1 and report `settled: yes`.

**If it reports `settled: NO`, stop and report it as a blocker.** That means the shipping numbers do not converge and no later task can fix it — the exponent in Task 3 would need re-deriving against the measured `a`. Do not adjust the 1.02 threshold to make it pass.

Record the actual sequence in your report. The figures above were measured before this plan was written, and the harness's simulated player buys slightly differently than that probe did, so small differences are expected and fine. A ×20 or a still-climbing tail is not.

- [ ] **Step 5: Confirm the harness still does not gate CI**

```bash
rtk proxy grep -rn "harness" .github/ package.json
```

Expected: `harness` appears as a script in `package.json` and **nowhere in `.github/`**. If it appears in a workflow, do not add it — report it, since the balance harness must never gate CI.

- [ ] **Step 6: Commit**

```bash
npx prettier --write packages/engine/scripts/harness.ts
npx eslint packages/engine/scripts/harness.ts
git add -A
git commit -m "Play eight runs in the harness so a runaway loop cannot hide"
```

---

### Task 9: Final sweep

**Files:**
- Modify: whichever comments and docs the sweep finds stale

- [ ] **Step 1: Hunt every stale soul figure**

```bash
rtk proxy grep -rn "perSoul\|2%\|souls-1\b\|souls-100\b\|1.14e14\|sqrt(lifetime\|√(lifetime" packages/ apps/ docs/
```

Every hit is a candidate. `docs/superpowers/specs/2026-08-03-dread-majesty-design.md` §5.4 describes the old formula — **do not edit it.** It is a historical record, and the 2026-08-08 spec's header already says it supersedes that section. Comments in code that describe current behavior are different: those must be true.

- [ ] **Step 2: Fix what is false**

For each hit in `packages/`, `apps/` or a plan document, decide whether it describes what the code does now. Correct the ones that do not. Say in your report which files you changed and which you deliberately left.

- [ ] **Step 3: Run the whole check**

```bash
./node_modules/.bin/vitest run
npx tsc --noEmit -p packages/content && npx tsc --noEmit -p packages/engine && npx tsc --noEmit -p apps/web
npx eslint . && npx prettier --check .
```

Expected: all green. Report the test count.

- [ ] **Step 4: Run the harness one last time**

```bash
node --experimental-strip-types packages/engine/scripts/harness.ts
```

Expected: `settled: yes`. Paste the prestige-loop table and the generator timings into your report — the timings are the check that nothing in this plan moved the generator economy, which it should not have.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "Bring the remaining soul figures onto the new scale"
git push origin post-smite-tuning
```

A plain `git push`. Never `--force`.

- [ ] **Step 6: Update the PR body**

PR #7 already has a description covering the earlier batch. Add a section for this work rather than replacing what is there — the PR now carries two rounds. Follow the format in the global `CLAUDE.md`: `Verb X preposition Y (optionally) clause Z`, 5–8 bullets, US English, output as a markdown code block.

```bash
gh pr view 7 --json body --jq .body
```

Read it, append, and update with `gh pr edit 7 --body-file <file>`.
