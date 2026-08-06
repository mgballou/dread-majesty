# Post-Smite Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shop teeth, make the rail's recommendation correct, and clear the interface batch that accumulated behind the smite branch.

**Architecture:** Almost all of this is content numbers and web presentation. The engine gains exactly one field (`MilestoneProgress.previous`) and nothing else. No save version changes, no new engine logic, no change to the dependency direction `web → engine → content-types`.

**Tech Stack:** pnpm monorepo, TypeScript strict, React 19 + Vite, Vitest, `break_eternity.js`.

**Spec:** `docs/superpowers/specs/2026-08-06-post-smite-tuning-design.md`. Read the section a task names before starting it.

## Global Constraints

- **No `Date.now()`, no `Math.random()`, no I/O in `packages/engine`.**
- **Every resource and generator count is a `Decimal`.** Never a JS number, never a float.
- **`packages/content` has zero dependencies and must keep zero.** Content tests compare with `Number(...)`, never `Decimal`. Adding `break_eternity.js` to that package is a defect.
- **The engine never imports content data.** `v1` and `CURRENT` are barred by lint inside `packages/engine/src`.
- **Engine tests run against `packages/engine/test/fixtures/`, never shipping content.**
- **No `any`, no default exports, no `as` casts without a comment saying why.**
- **`as const` for every content literal and id set.**
- **Object parameters once a function takes three or more arguments.** Two or fewer stay positional.
- **No raw colour or size values outside `tokens.css`.** Semantic tokens only — `--line`, `--accent`, `--tone-apathy`. Component tokens are declared at the top of the component's own stylesheet, as the existing files do.
- **One accent per region.** Nothing added here may wear `--accent` or `button--primary`.
- **Reduced motion is designed, not stripped.** Nothing visible under normal motion may go missing under reduced motion.
- **Number formatting goes through `apps/web/src/ui/format.ts`.** `formatWhole` for Evil amounts and counts, `formatNumber` for rates and multipliers.
- **Prose follows the Orwell rules in the root `CLAUDE.md`, US English.** This binds code comments and all player-facing copy.
- **No comments in tests** unless the test is genuinely unusual.
- **Commit messages: imperative, one line, no trailers, no AI attribution.**

### Commands that actually work

`pnpm --filter @dm/engine test` and `pnpm --filter @dm/content test` **do nothing** — neither package has a `test` script. Always use an explicit path:

```bash
./node_modules/.bin/vitest run packages/engine/test/multipliers.test.ts
./node_modules/.bin/vitest run apps/web/src/ui/rail
./node_modules/.bin/vitest run                      # everything
pnpm check                                          # typecheck + lint + test
pnpm harness                                        # headless balance run
```

If `pnpm` is not on `PATH`, `./node_modules/.bin/vitest` and `node --experimental-strip-types packages/engine/scripts/harness.ts` both work directly.

### If commit signing fails

A locked 1Password vault fails with `1Password: agent returned an error` or `failed to fill whole buffer`. **Commit with `--no-gpg-sign` and keep going.** Never set `commit.gpgsign=false`. Report which SHAs went unsigned in your report file; they get re-signed in one pass at the end.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `packages/content/src/v1/generators.ts` | Smite rung prices, Overseer prices, and the header comment that records the harness output | 1 |
| `packages/content/test/generators.test.ts` | Ordering and ratio assertions over those prices | 1 |
| `packages/engine/src/selectors.ts` | `MilestoneProgress.previous` | 2 |
| `packages/engine/test/multipliers.test.ts` | Tests for it | 2 |
| `apps/web/src/ui/rail/railPlan.ts` | The ranking horizon | 3 |
| `packages/content/src/copy.ts` + `src/v1/copy.ts` | Copy interfaces and strings — touched by tasks 4, 6, 7, 8 | 4, 6, 7, 8 |
| `apps/web/src/ui/Meter.tsx` | Gains an optional `title` | 4 |
| `apps/web/src/ui/rail/TierRow.tsx` | Loses "Appointed", swaps its bar to milestone progress, says which count the price follows | 4 |
| `apps/web/src/ui/stage/ApathyArc.tsx` + `.css` + `.test.tsx` | Replaces `ApathyTicks.*` | 5 |
| `apps/web/src/ui/stage/EvilNode.tsx` + `.css` | Mounts the arc inside the medallion, carries the band in its spoken label | 5 |
| `apps/web/src/ui/Deck.tsx` + `.css` | The shut-tab dot | 6 |
| `apps/web/src/App.tsx` | Feeds the dot, mounts the prestige placeholder and marker | 6, 7 |
| `apps/web/src/ui/rail/PrestigeLocked.tsx` + `.css` | The placeholder that holds the slot | 7 |
| `apps/web/src/ui/rail/PrestigeMarker.tsx` + `.css` | The notice that leads to the panel | 7 |
| `packages/content/src/v1/copy.ts` | Prestige kept/taken/confirm accuracy | 8 |

---

## Task 1: Shop prices

**Spec:** §4.2 (smite ladders), §4.4 (Overseers), §4.1 (why), §7 (harness).

**Files:**

- Modify: `packages/content/src/v1/generators.ts`
- Modify: `packages/content/test/generators.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks import. Later web tasks will see the new prices when they run the suite; that is the only coupling.

**Context you need:** `SmiteRungDef.evil` and `OverseerDef.cost` are **strings**, so the value never passes through a JS float on its way into a `Decimal`. Keep them strings and keep the existing exponent notation (`'6e8'`, not `'600000000'`).

- [ ] **Step 1: Update the two Overseer ratio tests to the new ratios**

In `packages/content/test/generators.test.ts`, replace the test named `'prices the quicken and swell posts at four and sixteen times the automator'` with:

```ts
  it('prices the quicken and swell posts at twenty and two hundred times the automator', () => {
    for (const tier of v1.tiers) {
      const automate = Number(tier.overseers[0]?.cost ?? '0');
      const quicken = Number(tier.overseers[1]?.cost ?? '0');
      const swell = Number(tier.overseers[2]?.cost ?? '0');

      expect(quicken / automate).toBeCloseTo(20, 2);
      expect(swell / automate).toBeCloseTo(200, 2);
    }
  });
```

- [ ] **Step 2: Add the ladder-slope test**

Add to the same `describe` block that holds `'raises the Evil price at every rung of every ladder'`:

```ts
  it('spans a run with each ladder, at two hundred times a rung', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.evil));

      for (let index = 1; index < prices.length; index += 1) {
        expect(prices[index]! / prices[index - 1]!).toBeCloseTo(200, 2);
      }
    }
  });

  it('opens the shop on Reach, the cheapest first rung', () => {
    const firsts = v1.smite.upgrades.map((upgrade) => Number(upgrade.rungs[0]?.evil ?? '0'));
    const reach = Number(
      v1.smite.upgrades.find((upgrade) => upgrade.id === 'reach')?.rungs[0]?.evil ?? '0',
    );

    expect(reach).toBe(Math.min(...firsts));
  });
```

- [ ] **Step 3: Run the content tests and watch them fail**

```bash
./node_modules/.bin/vitest run packages/content/test/generators.test.ts
```

Expected: the three tests above fail. The ratio test reports `4` where `20` was expected; the slope test reports `12` where `200` was expected. `'opens the shop on Reach'` should already pass — Reach is already cheapest — and that is fine; it is there to stop a later edit breaking it.

- [ ] **Step 4: Write the new smite rung prices**

In `packages/content/src/v1/generators.ts`, replace the whole `upgrades` array inside `smite` with:

```ts
    upgrades: [
      {
        id: 'reach',
        name: 'Reach',
        base: 15 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '3e6', souls: '8', value: 17 * SECOND },
          { evil: '6e8', souls: '20', value: 19 * SECOND },
          { evil: '1.2e11', souls: '50', value: 21 * SECOND },
          { evil: '2.4e13', souls: '120', value: 23 * SECOND },
        ],
      },
      {
        id: 'weight',
        name: 'Weight',
        base: 2,
        unit: 'multiplier',
        rungs: [
          { evil: '6e6', souls: '8', value: 2.25 },
          { evil: '1.2e9', souls: '20', value: 2.5 },
          { evil: '2.4e11', souls: '50', value: 2.75 },
          { evil: '4.8e13', souls: '120', value: 3 },
        ],
      },
      {
        id: 'forgetting',
        name: 'Forgetting',
        base: 45 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '1.2e7', souls: '8', value: 40 * SECOND },
          { evil: '2.4e9', souls: '20', value: 36 * SECOND },
          { evil: '4.8e11', souls: '50', value: 32 * SECOND },
          { evil: '9.6e13', souls: '120', value: 30 * SECOND },
        ],
      },
      {
        id: 'restraint',
        name: 'Restraint',
        base: 0.25,
        unit: 'amount',
        rungs: [
          { evil: '1.8e7', souls: '8', value: 0.225 },
          { evil: '3.6e9', souls: '20', value: 0.2 },
          { evil: '7.2e11', souls: '50', value: 0.175 },
          { evil: '1.44e14', souls: '120', value: 0.15 },
        ],
      },
    ],
```

**Every `souls` value and every `value` is unchanged.** Only `evil` moves. If you find yourself editing a `value`, stop — that is a different change.

- [ ] **Step 5: Write the new Overseer prices**

Six edits in the same file, all `quicken` and `swell` costs. **Do not touch any `automate` cost.**

| Tier | post id | old | new |
| --- | --- | --- | --- |
| throne | `throne-goad` | `'6.4e15'` | `'3.2e16'` |
| throne | `throne-glut` | `'2.56e16'` | `'3.2e17'` |
| fortress | `fortress-goad` | `'2.56e12'` | `'1.28e13'` |
| fortress | `fortress-glut` | `'1.024e13'` | `'1.28e14'` |
| legion | `legion-goad` | `'9.6e8'` | `'4.8e9'` |
| legion | `legion-glut` | `'3.84e9'` | `'4.8e10'` |
| warren | `warren-goad` | `'9.6e7'` | `'4.8e8'` |
| warren | `warren-glut` | `'3.84e8'` | `'4.8e9'` |
| minion | `minion-goad` | `'4800'` | `'24000'` |
| minion | `minion-glut` | `'19200'` | `'240000'` |

(That is ten edits across five tiers — two per tier.)

- [ ] **Step 6: Run the content tests and watch them pass**

```bash
./node_modules/.bin/vitest run packages/content/test/generators.test.ts
```

Expected: PASS, all of them.

- [ ] **Step 7: Run the harness and confirm the generator economy did not move**

```bash
pnpm harness
```

Compare against the table in the `v1` header comment in `generators.ts`:

```
  Warrens        10m 53s    first prestige   41m 11s
  Dark Legions   39m 35s    souls at 8h      7.4e6
  Fortresses     1h 14m     souls at 12h     9.2e7
  Thrones        2h 03m
```

**These four tier times and the obsolescence table must be unchanged.** Nothing in Step 4 or Step 5 touches a generator `baseCost`, `costRate`, `yield`, `cycleMs`, or a milestone, so they cannot move. **If any of them do, you have edited something this task did not authorise — revert and re-read Step 5.**

The **Overseer reach-times will move** for `quicken` and `swell`, and that is the point.

- [ ] **Step 8: Update the header comment with the harness's real output**

The `v1` header comment carries a block beginning `When each Overseer first comes within reach`. Replace those figures with what Step 7 actually printed. **Paste the harness's numbers; do not estimate them.**

In the same comment, the paragraph ending `` `goad` and `glut` then sit at ×4 and ×16 of their tier's automator `` is now false. Rewrite that sentence to ×20 and ×200, and add one sentence saying why: the old ratios put every post inside the first hour, where income had already outrun them.

Add a short paragraph above the smite `upgrades` array recording the slope decision:

```ts
    // Rung prices climb ×200, not the ×12 they shipped at. Lifetime Evil spans ×3.9
    // million between fifteen minutes and two hours, and four rungs at ×12 span ×1,728
    // — so the ladder covered a five-hundredth of the run it lives in, and the whole
    // tree cost thirty-two seconds of income. The slope is what fixes that; raising
    // every price by a constant only moves which slice it covers. See the 2026-08-06
    // post-smite-tuning spec §4.1 for the measured curve.
```

- [ ] **Step 9: Fix whatever web tests the new prices broke**

```bash
./node_modules/.bin/vitest run
```

Web tests that seed a purse in order to afford a climb will now fail — the Malice panel's tests are the likely ones, and possibly `railPlan.test.ts` and `perPanelAccent.test.tsx`. **Fix them by raising the seeded purse to match the new prices, never by lowering a price back.** A test that now needs `new Decimal('1e7')` where it had `new Decimal(20000)` is correct.

**If a test can only be made to pass by deleting it, do not delete it — record it in your report as a finding and leave it failing.**

- [ ] **Step 10: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Price the shop to span a run instead of a slice of one"
```

---

## Task 2: The milestone band's floor

**Spec:** §5.6, §6.

**Files:**

- Modify: `packages/engine/src/selectors.ts:203-226`
- Modify: `packages/engine/test/multipliers.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `MilestoneProgress` gains `previous: number`. Task 4 reads it. The other four fields — `next: number | null`, `multiplier: number | null`, `owned: Decimal`, `remaining: Decimal | null` — keep their exact current names and types.

**Context you need:** `content.milestones` is ascending and never empty. The first six thresholds are 25, 50, 100, 200, 300, 400; past 400 they double (800, 1600, 3200 …). Thresholds are plain `number`; owned counts are `Decimal` and run past `Number.MAX_SAFE_INTEGER`, which is why `previous` is a `number` and every comparison against `owned` goes through `Decimal`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/engine/test/multipliers.test.ts`, inside the `describe` that already covers `milestoneProgress`:

```ts
  it('reads zero before the first threshold', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(3);

    expect(milestoneProgress(state, fixture, 'minion').previous).toBe(0);
  });

  it('reads the threshold last passed', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(60);

    expect(milestoneProgress(state, fixture, 'minion').previous).toBe(50);
  });

  it('reads the threshold itself when the count sits exactly on it', () => {
    const state = createState(fixture);
    state.gens.minion.owned = new Decimal(50);

    expect(milestoneProgress(state, fixture, 'minion').previous).toBe(50);
  });

  it('reads the last threshold of all once every one is passed', () => {
    const state = createState(fixture);
    const last = fixture.milestones[fixture.milestones.length - 1]!.at;
    state.gens.minion.owned = new Decimal(last).add(1);

    const progress = milestoneProgress(state, fixture, 'minion');

    expect(progress.next).toBeNull();
    expect(progress.previous).toBe(last);
  });
```

The fixture's milestone list must contain 25 and 50 for the second and third tests to mean anything. **Read `packages/engine/test/fixtures/content.ts` first.** If its thresholds differ, use its real values rather than 25/50 — and say so in your report.

- [ ] **Step 2: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run packages/engine/test/multipliers.test.ts
```

Expected: FAIL — `previous` is `undefined`, so `toBe(0)` and `toBe(50)` both fail.

- [ ] **Step 3: Add the field**

In `packages/engine/src/selectors.ts`, add `MilestoneDef` to the existing type import from `@dm/content`:

```ts
import type { Content, MilestoneDef, OverseerId, ProducibleId, TierId } from '@dm/content';
```

Replace the interface and the function:

```ts
export interface MilestoneProgress {
  /** Owned count the next threshold sits at, or null once every one is passed. */
  next: number | null;
  /**
   * The threshold last passed, or 0 before the first.
   *
   * A bar drawn from zero reads half full the instant a band opens, because the tail
   * thresholds double — `owned / next` is 0.5 at the start of every band past the
   * first. Progress within the band is the honest figure, and this is its floor.
   */
  previous: number;
  /** What passing it is worth. Null alongside `next`. */
  multiplier: number | null;
  owned: Decimal;
  remaining: Decimal | null;
}

/** Drives the milestone bar every rail row needs. */
export function milestoneProgress(
  state: GameState,
  content: Content,
  tierId: TierId,
): MilestoneProgress {
  const owned = state.gens[tierId].owned;

  // One walk for both ends of the band. The list is ascending, so the first threshold
  // the count has not reached is the next one, and whatever we walked past is the floor.
  let previous = 0;
  let next: MilestoneDef | null = null;
  for (const milestone of content.milestones) {
    if (owned.lt(milestone.at)) {
      next = milestone;
      break;
    }
    previous = milestone.at;
  }

  return {
    next: next?.at ?? null,
    previous,
    multiplier: next?.multiplier ?? null,
    owned,
    remaining: next === null ? null : new Decimal(next.at).sub(owned),
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
./node_modules/.bin/vitest run packages/engine/test/multipliers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Give milestone progress the floor of the band it is in"
```

---

## Task 3: The ranking horizon

**Spec:** §3.1.

**Files:**

- Modify: `apps/web/src/ui/rail/railPlan.ts:29-51`
- Modify: `apps/web/src/ui/rail/railPlan.test.ts` and whatever else the change breaks

**Interfaces:**

- Consumes: nothing.
- Produces: `HORIZON_SECONDS` keeps its name and its `export`. Its value becomes `7200`.

**Context you need:** `HORIZON_SECONDS` is the only opinion in the ranking. A purchase is scored on Evil returned over that window; a tier one rung further from Evil costs a factor of `H / depth`, so the window's length decides which tier wins. Nothing outside `apps/web` reads it — the harness deliberately does not import `railPlan`, and must not start.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/ui/rail/railPlan.test.ts`. Match the file's existing helpers for building a state — if it has one, use it rather than calling `createState` directly:

```ts
  it('lifts the Warren over the Minion at the count where a player notices', () => {
    const state = createState(CURRENT);
    state.gens.minion.owned = new Decimal(300);
    state.gens.minion.purchased = new Decimal(300);
    state.gens.warren.owned = new Decimal(26);
    state.gens.warren.purchased = new Decimal(26);
    state.resources.evil = new Decimal('1e12');

    const plan = railPlan({
      state,
      content: CURRENT,
      quantity: 1,
      isUnlocked: () => true,
      held: { purchase: null, appoint: null, climb: null },
    });

    expect(plan.best.purchase?.tierId).toBe('warren');
  });

  it('reaches past the Warren once Dark Legions are affordable', () => {
    const state = createState(CURRENT);
    state.gens.minion.owned = new Decimal(1000);
    state.gens.minion.purchased = new Decimal(1000);
    state.gens.warren.owned = new Decimal(40);
    state.gens.warren.purchased = new Decimal(40);
    state.resources.evil = new Decimal('1e12');

    const plan = railPlan({
      state,
      content: CURRENT,
      quantity: 1,
      isUnlocked: () => true,
      held: { purchase: null, appoint: null, climb: null },
    });

    expect(plan.best.purchase?.tierId).toBe('legion');
  });
```

Both scenarios were measured against the real content: at H=600 the first answers `minion` and the second `warren`; at H=7200 they answer `warren` and `legion`.

- [ ] **Step 2: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/railPlan.test.ts
```

Expected: FAIL — the first reports `minion`, the second `warren`. **If either already passes, stop and report it**: something else has changed the ranking and the rest of this task is built on a measurement that no longer holds.

- [ ] **Step 3: Change the constant and rewrite its comment**

Replace the whole doc comment on `HORIZON_SECONDS` and the constant itself:

```ts
/**
 * How far ahead a purchase is judged, in seconds.
 *
 * This constant is the whole of the ranking's opinion. A Minion pays in four seconds; a
 * Warren pays through Minions, so its return over a window grows with the window squared
 * over two, and a Legion cubed over six. The window's length therefore decides which tier
 * wins, and any value is a statement about how long the player intends to keep playing.
 *
 * **Two hours: the length of a run, not the length of a sitting.** The first reset worth
 * taking lands near 1h 47m.
 *
 * This was 600 for most of the project's life, on a payback-period argument that had
 * already been retracted as unmeasured. It has now been measured, and 600 was wrong.
 * Three simulated players making one purchase a second for two hours:
 *
 *   follows the gold, H=600            30m 1.28e9   1h 1.49e10   2h 5.49e13
 *   buys the biggest affordable tier   30m 1.73e9   1h 1.97e10   2h 1.15e14
 *
 * Following the recommendation was half as good as the genre's most naive heuristic.
 * Sweeping the horizon against the first policy:
 *
 *   600s   2h 5.49e13      4800s  2h 1.15e14
 *   1800s  2h 7.38e13      7200s  2h 1.15e14
 *                          86400s 2h 1.15e14
 *
 * It climbs to about 4800 and then flat-lines. **A plateau, not a peak** — which is the
 * property that matters, because nobody re-measures this before shipping a content
 * change. See the 2026-08-06 post-smite-tuning spec §3.1.
 */
export const HORIZON_SECONDS = 7200;
```

- [ ] **Step 4: Run the whole web suite and fix what broke**

```bash
./node_modules/.bin/vitest run apps/web
```

**Expect a lot of failures.** Every test asserting which row is lifted, or a `score`, or a `gain`, is reading a number that just changed. Fix each by updating the expectation to the new, correct answer.

**Rules for this step, and they matter more than the speed of it:**

- **Never delete a test to make the suite green.** If a test's premise is genuinely gone, record it in your report as a finding and leave it failing.
- **Never soften an assertion** — `toBe` does not become `toBeGreaterThan` to dodge a number.
- If a test's expectation changes from one tier to another (Minion → Warren), that is the change working. If it changes in a direction that makes no sense, stop and report it.

- [ ] **Step 5: Also retract the stale claim in the header**

`railPlan`'s big doc comment above the `railPlan` function says the ranking's blind spots include *"It cannot value an unlock."* **Leave that in.** The spec (§3.3) deliberately keeps it unfixed and documented. Do not add an unlock term.

- [ ] **Step 6: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Judge a purchase over a run rather than a sitting"
```

---

## Task 4: The rail row

**Spec:** §3.2 (which count the price follows), §5.5 (remove "Appointed"), §5.6 (the bar).

**Files:**

- Modify: `apps/web/src/ui/Meter.tsx`
- Modify: `apps/web/src/ui/rail/TierRow.tsx`
- Modify: `packages/content/src/copy.ts` (`RailCopy`, `MilestoneCopy`)
- Modify: `packages/content/src/v1/copy.ts`
- Modify: `apps/web/src/ui/rail/BuyRail.test.tsx`

**Interfaces:**

- Consumes: `milestoneProgress(state, content, tierId)` returning `{ next: number | null, previous: number, multiplier: number | null, owned: Decimal, remaining: Decimal | null }` — Task 2.
- Produces: `Meter` gains an optional `title?: string`. `MilestoneCopy` gains `bar`. `RailCopy.bought` changes wording only, keeping its `(count: string) => string` signature.

**Context you need:** `TierRow` currently renders, in order: name + flags + owned count, a `rail__bought` line, a produce line, a `Meter` sweeping **cycle** progress, and a `rail__line--milestone` paragraph. After this task the `Meter` sweeps **milestone** progress and the milestone paragraph is gone. The cycle sweep is not lost to the player — `CycleRing` on the stage already draws cycle progress for every tier.

- [ ] **Step 1: Give `Meter` an optional title**

In `apps/web/src/ui/Meter.tsx`, add to `MeterProps`:

```ts
  /**
   * Hover text. The accessible name still comes from `label` — `aria-label` wins over
   * `title`, so this adds a way to read the exact figures with a pointer without
   * changing what is announced.
   */
  title?: string;
```

Change the signature and the rendered element:

```ts
export function Meter({ label, value, max, className = '', title }: MeterProps): ReactNode {
```

and add `{...(title === undefined ? {} : { title })}` to the `<div>`'s props. **Spread rather than `title={title}`** — `exactOptionalPropertyTypes` is on, and passing an explicit `undefined` is a type error.

- [ ] **Step 2: Add the copy**

In `packages/content/src/copy.ts`, add to `MilestoneCopy`:

```ts
  /**
   * Names the milestone bar, and carries the figures the printed line used to.
   *
   * Every part arrives formatted. The bar replaced a line of text, so this string is
   * the only place those numbers still live — it is read by pointer through `title`
   * and by ear through `aria-label`.
   */
  readonly bar: (args: {
    readonly remaining: string;
    readonly plural: string;
    readonly multiplier: string;
    readonly threshold: string;
  }) => string;
  /** The bar's name once a tier has taken every milestone it has. */
  readonly barDone: (plural: string) => string;
```

Keep `next`, `done` and `noMore` — they are still used elsewhere and removing them is a separate change.

In `packages/content/src/v1/copy.ts`, add to the `milestone` block:

```ts
    bar: ({ remaining, plural, multiplier, threshold }): string =>
      `${remaining} more ${plural} for ${multiplier} output at ${threshold}.`,
    barDone: (plural: string): string => `Every milestone taken. The ${plural} will not make more than this.`,
```

Reword `rail.bought` in the same file so it says what the number is for:

```ts
    bought: (count: string): string => `${count} bought — the price follows this`,
```

- [ ] **Step 3: Write the failing tests**

Add to the `describe('BuyRail', …)` block in `apps/web/src/ui/rail/BuyRail.test.tsx`. That file holds a module-level `state`, reset in `beforeEach`, and a `draw()` helper that builds the plan and renders — mutate `state` first, then call `draw()`:

```tsx
  it('does not flag a tier as appointed on its row', () => {
    state.gens.minion.owned = new Decimal(30);
    state.overseers.minion = ['minion-hand'];
    draw();

    expect(screen.queryByText(CURRENT_COPY.overseer.filled)).toBeNull();
  });

  it('fills the bar with progress through the current milestone band', () => {
    state.gens.minion.owned = new Decimal(30);
    draw();

    const bar = screen.getByRole('progressbar', { name: /more Minions for/ });

    expect(bar).toHaveAttribute('aria-valuenow', '20');
  });

  it('says which count the price follows when bred units outnumber bought ones', () => {
    state.gens.minion.owned = new Decimal(30);
    state.gens.minion.purchased = new Decimal(10);
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.bought('10'))).toBeInTheDocument();
  });
```

The `aria-valuenow` of `20` is the arithmetic: 30 owned, band from 25 to 50, so `(30 − 25) / (50 − 25)` = 20%. **Confirm the shipping milestone list still opens 25, 50 before trusting that number.** The name regex has to disambiguate — every tier renders a row, so there are five progressbars on screen.

- [ ] **Step 4: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/BuyRail.test.tsx
```

Expected: FAIL on all three — the badge is still rendered, the progressbar is still named for a cycle, and the bought line reads `10 bought`.

- [ ] **Step 5: Rewrite the row**

In `apps/web/src/ui/rail/TierRow.tsx`:

Remove `isAppointed` from the `@dm/engine` import. Add `type MilestoneProgress` to it.

Delete the badge:

```tsx
          {isAppointed(state, content, tier.id) && (
            <span className="rail__flag rail__flag--overseen">{copy.overseer.filled}</span>
          )}
```

Replace the `Meter` and the milestone paragraph — that is, everything from `<Meter` through the closing `</p>` of `rail__line--milestone` — with:

```tsx
        <Meter
          className="rail__cycle"
          label={label}
          title={label}
          value={milestoneShare(progress)}
          max={1}
        />
```

with these two locals added at the top of the component's body, beside `const gen = …`:

```tsx
  const progress = milestoneProgress(state, content, tier.id);
  const label = milestoneLabel({ progress, plural: tier.plural, copy: copy.milestone });
```

Replace the `milestoneLine` helper with these two:

```tsx
/**
 * How far through the current band, as a fraction.
 *
 * Both ends are `Decimal` and only the fraction is converted: owned counts run past
 * `Number.MAX_SAFE_INTEGER` and the ratio never does. Past the last threshold there is
 * no band left, and a full bar is the honest drawing of that.
 */
function milestoneShare(progress: MilestoneProgress): number {
  const { next, previous, owned } = progress;
  if (next === null) return 1;

  const span = new Decimal(next).sub(previous);
  if (span.lte(0)) return 1;

  return Decimal.min(1, Decimal.max(0, owned.sub(previous).div(span))).toNumber();
}

/**
 * What the bar is called, and the figures the printed line used to carry.
 *
 * The line came off the row: the bar says the same thing in less space, and a rail row
 * carrying five lines of text was reading as a paragraph. Nothing is lost — this string
 * reaches a pointer through `title` and a screen reader through `aria-label`.
 */
interface MilestoneLabelInput {
  progress: MilestoneProgress;
  plural: string;
  copy: MilestoneCopy;
}

function milestoneLabel({ progress, plural, copy }: MilestoneLabelInput): string {
  const { next, remaining, multiplier } = progress;

  if (next === null || remaining === null || multiplier === null) {
    return copy.barDone(plural);
  }

  return copy.bar({
    remaining: formatWhole(remaining),
    plural,
    multiplier: `×${formatNumber(new Decimal(multiplier))}`,
    threshold: formatWhole(new Decimal(next)),
  });
}
```

The object parameter is the rule at three arguments or more, and `TierRow` already works this way — `buyLabel({ tier, purchase, emphasis, copy }: BuyLabelInput)` is the pattern to follow.

Rewrite the paragraph in `TierRow`'s doc comment that begins **"Neither rousing nor appointing is here."** It currently argues *for* the badge — "what is left on the row is one word saying whether anybody holds this one". That sentence is now false. The replacement should say that the row carries the buy decision and nothing else: who oversees a tier lives with the other posts in the miscreants panel, and the stage's node already says whether a tier is running.

Update the first paragraph too — it lists "how far the cycle has run" among what the row carries, and it no longer does.

- [ ] **Step 6: Run the tests and watch them pass**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail
```

Expected: PASS. `copy.rail.cycle` is now unused by `TierRow` — leave the copy string in place, it costs nothing and removing it is a separate change.

- [ ] **Step 7: Check the stylesheet**

`rail__flag--overseen` in `apps/web/src/ui/rail/BuyRail.css` is now dead. Remove that rule. Leave `rail__flag` — the `saving` flag still uses it. Leave `rail__cycle`; the bar still wears it.

- [ ] **Step 8: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Put the milestone on the rail row's bar and take the badge off"
```

---

## Task 5: The Apathy arc

**Spec:** §5.1.

**Files:**

- Create: `apps/web/src/ui/stage/ApathyArc.tsx`, `ApathyArc.css`, `ApathyArc.test.tsx`
- Delete: `apps/web/src/ui/stage/ApathyTicks.tsx`, `ApathyTicks.css`, `ApathyTicks.test.tsx`
- Modify: `apps/web/src/ui/stage/EvilNode.tsx`, `EvilNode.css`
- Modify: `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`

**Interfaces:**

- Consumes: `CYCLE_SEGMENTS` from `apps/web/src/ui/segments.ts`.
- Produces: `ApathyArc({ apathy, cap }: { apathy: number; cap: number })`. **It takes no `copy` prop** — see Step 1 for why.

**Context you need — read this before writing anything.**

The arc sits inside `.evil-node__medallion`, which is inside the `<button>`. That has one consequence you must handle: **the button carries an `aria-label`, which overrides everything inside it.** A `role="img"` with its own label placed in there would simply never be announced, and the Apathy band — which the current component's label carries — would be silently lost.

So the arc is `aria-hidden` and **the band sentence moves onto the button's own accessible name**. One announcement on the thing you press, instead of two. `SmiteCopy.spoken` gains a second argument to carry it.

- [ ] **Step 1: Widen `SmiteCopy.spoken`**

In `packages/content/src/copy.ts`, replace the `spoken` member of `SmiteCopy`:

```ts
  /**
   * Spoken name of the control, which is the Evil total itself.
   *
   * The total is the tap target, so its accessible name has to carry the verb, the
   * figure, and how tired the realm is. `band` is one of `SmiteCopy.bands`. The Apathy
   * gauge is drawn inside this control, and a label inside a button that carries an
   * `aria-label` is never announced — so this is the only place the band reaches
   * anyone reading by ear. Both parts arrive formatted.
   */
  readonly spoken: (amount: string, band: string) => string;
```

**Two positional arguments, not an object.** The object-parameter rule starts at three.

In `packages/content/src/v1/copy.ts`, update the implementation. It currently takes a bare `amount`; the new one appends the band. **Read what it says today and keep its voice** rather than inventing a new sentence — the shape is:

```ts
    spoken: (amount: string, band: string): string => `…${amount}…. ${band}`,
```

- [ ] **Step 2: Write the arc's failing tests**

Create `apps/web/src/ui/stage/ApathyArc.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYCLE_SEGMENTS } from '../segments.ts';
import { ApathyArc } from './ApathyArc.tsx';

describe('ApathyArc', () => {
  it('draws one segment per cycle segment', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights nothing at rest', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(0);
  });

  it('is mounted at rest, so nothing moves when it fills', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelector('.apathy')).not.toBeNull();
  });

  it('holds the top segment just under the cap, where a hammering player lives', () => {
    const { container } = render(<ApathyArc apathy={2.56} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights every segment at the cap', () => {
    const { container } = render(<ApathyArc apathy={3} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights one segment just above rest', () => {
    const { container } = render(<ApathyArc apathy={0.01} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(1);
  });

  it('clamps a value above the cap rather than overdrawing', () => {
    const { container } = render(<ApathyArc apathy={99} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('reads empty rather than dividing by a cap of zero', () => {
    const { container } = render(<ApathyArc apathy={1} cap={0} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(0);
  });

  it('is hidden from assistive tech, because the control it sits in carries the words', () => {
    render(<ApathyArc apathy={1} cap={3} />);

    expect(screen.queryByRole('img')).toBeNull();
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/stage/ApathyArc.test.tsx
```

Expected: FAIL — the module does not exist.

- [ ] **Step 4: Write the arc**

Create `apps/web/src/ui/stage/ApathyArc.tsx`:

```tsx
import type { ReactNode } from 'react';
import { CYCLE_SEGMENTS } from '../segments.ts';
import './ApathyArc.css';

interface ApathyArcProps {
  /** How tired the realm is, 0 to `cap`. */
  apathy: number;
  cap: number;
}

/** The arc's radius and sweep, in the SVG's own units. */
const SIZE = 100;
const RADIUS = 46;
/** Degrees of arc the whole gauge spans, centred on the bottom of the medallion. */
const SWEEP = 140;
/** Degrees of blank between one segment and the next. */
const GAP = 4;

/**
 * The realm's patience, drawn around the medallion it belongs to.
 *
 * **A share of the cap, never a count of it.** There are always `CYCLE_SEGMENTS`
 * segments and the cap decides only how far along them a point of Apathy carries you.
 * Raising the cap from three to six later is a content edit and nothing here moves —
 * which is the whole reason this is not one segment per point.
 *
 * **Around the medallion, not beside the control and not under the thumb.** It used to
 * be a row of dots below the button, which read as a floating widget because nothing
 * tied it to what it described. Beside the control is worse: the button is centred and
 * pinned, so a gauge on one edge either pushes the medallion off centre or eats the tap
 * target on a phone. Curved around the disc it is inside the control's boundary and
 * outside the part anybody presses — a fingertip lands on the middle, not the rim.
 *
 * **Always mounted and empty at rest**, so nothing moves when it fills.
 *
 * **It prints no number, and it is hidden from assistive tech.** The strike button owns
 * an `aria-label`, which overrides anything inside it, so a label here would never be
 * announced. The band sentence rides on that label instead — see `SmiteCopy.spoken`.
 *
 * **Reduced motion needs no special case.** Segments are discrete: one lights or it does
 * not, at every motion setting. There is no sweep to strip, which is the property the
 * row of dots had and the reason this drawing keeps it.
 */
export function ApathyArc({ apathy, cap }: ApathyArcProps): ReactNode {
  const share = cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;
  // Upward bound, and **deliberately the opposite of the flooring `quantise` does for
  // the cycle rings.** A ring measures how much of a cycle has elapsed, so it must not
  // claim progress that has not happened — floor. This measures where a level stands, so
  // a segment owns the band beneath it and stays lit until the value drops clear of it.
  //
  // Flooring here made the top segment unreachable in practice. Apathy is capped at
  // exactly `cap`, so a full share held for the single 100ms slice after a blow landed on
  // the cap and `step` bled it below — the last segment flashed for one frame a minute. A
  // player striking on every cooldown holds Apathy between 2.56 and 3.0 of 3 for ever.
  const lit = Math.ceil(share * CYCLE_SEGMENTS);

  const span = (SWEEP - GAP * (CYCLE_SEGMENTS - 1)) / CYCLE_SEGMENTS;
  const start = 90 - SWEEP / 2;

  return (
    <span className="apathy" aria-hidden="true">
      <svg className="apathy__dial" viewBox={`0 0 ${SIZE} ${SIZE}`} focusable="false">
        {Array.from({ length: CYCLE_SEGMENTS }, (_, index) => (
          <path
            key={index}
            className={index < lit ? 'apathy__segment apathy__segment--lit' : 'apathy__segment'}
            d={segment(start + index * (span + GAP), span)}
          />
        ))}
      </svg>
    </span>
  );
}

/** One segment's arc, as an SVG path from its start angle across `span` degrees. */
function segment(from: number, span: number): string {
  const a = point(from);
  const b = point(from + span);

  return `M ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x} ${b.y}`;
}

/** A point on the arc, in the SVG's units. Degrees, clockwise from three o'clock. */
function point(degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: SIZE / 2 + RADIUS * Math.cos(radians),
    y: SIZE / 2 + RADIUS * Math.sin(radians),
  };
}
```

Create `apps/web/src/ui/stage/ApathyArc.css`:

```css
/*
 * The realm's patience, curved around the medallion. See ApathyArc.tsx.
 *
 * One component token: a segment's stroke is a drawn weight rather than a laid-out
 * region, and no step on the space scale is the right thickness for a mark that has to
 * read as a gauge at the size a medallion gives it.
 */

.apathy {
  --apathy-stroke: 3px;

  position: absolute;
  inset: 0;
  display: block;
  /* The gauge is a readout drawn over a control. It must never take the press. */
  pointer-events: none;
}

.apathy__dial {
  inline-size: 100%;
  block-size: 100%;
  overflow: visible;
}

.apathy__segment {
  fill: none;
  stroke: var(--line);
  stroke-width: var(--apathy-stroke);
  stroke-linecap: round;
  /* Colour only — there is no geometry to animate, which is why this drawing needs no
     reduced-motion branch at all. The global collapse to 1ms covers it either way. */
  transition: stroke var(--duration-fast) ease-out;
}

.apathy__segment--lit {
  stroke: var(--tone-apathy);
}
```

- [ ] **Step 5: Run the arc's tests and watch them pass**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/stage/ApathyArc.test.tsx
```

Expected: PASS, all nine.

- [ ] **Step 6: Mount it in `EvilNode` and delete the old component**

In `apps/web/src/ui/stage/EvilNode.tsx`:

Change the import from `ApathyTicks` to `ApathyArc`. Move the element from its position after the `</button>` into `.evil-node__medallion`, just after `<TierArt …/>`:

```tsx
        <span className="evil-node__medallion">
          <TierArt slot={EVIL_ART} decorative />
          <ApathyArc apathy={state.smiteApathy} cap={content.smite.apathy.cap} />

          {landing !== null && (
            <span className="evil-node__landing" key={`land-${landing.id}`} aria-hidden="true" />
          )}
        </span>
```

Change the button's label to carry the band. `shown` is the existing local holding `formatWhole(total)`:

```tsx
        aria-label={copy.spoken(shown, band(apathyShare(state.smiteApathy, content.smite.apathy.cap), copy.bands))}
```

Add the `band` helper, moved across from the old component unchanged:

```tsx
/**
 * Which of the three sentences the realm is living in.
 *
 * Thirds, and the top band is reached only at the very top — `Math.min` rather than a
 * `Math.floor` that would put a full gauge in a fourth band that does not exist.
 */
function band(share: number, bands: SmiteCopy['bands']): string {
  const index = Math.min(bands.length - 1, Math.floor(share * bands.length));

  return bands[index] ?? bands[0];
}
```

It takes a share, so both this and the arc need the same clamp. **Export it from the arc rather than writing it twice** — add to `ApathyArc.tsx`:

```tsx
/**
 * How far along its cap Apathy stands, 0 to 1.
 *
 * Exported because the arc draws this and the control it sits inside speaks it, and two
 * copies of a clamp are two chances to disagree about what a cap of zero means.
 */
export function apathyShare(apathy: number, cap: number): number {
  return cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;
}
```

and have `ApathyArc` call it in place of its inline clamp. The call site in `EvilNode` then reads:

```tsx
        aria-label={copy.spoken(
          shown,
          band(apathyShare(state.smiteApathy, content.smite.apathy.cap), copy.bands),
        )}
```

Delete `ApathyTicks.tsx`, `ApathyTicks.css` and `ApathyTicks.test.tsx`. **The old test file's cases are already carried by Step 2's** — check that yourself before deleting, and if it holds a case Step 2 does not, add it to `ApathyArc.test.tsx` rather than losing it.

In `apps/web/src/ui/stage/EvilNode.css`, no new rule is needed — `.evil-node__medallion` is already `position: relative`, which is what the arc's `position: absolute` hangs off. **Confirm that is still true before moving on.**

- [ ] **Step 7: Fix `EvilNode`'s tests and run the stage suite**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/stage
```

`EvilNode.test.tsx` asserts against the button's accessible name, which now carries a third sentence. Update those expectations. Any test that looked for `.apathy__tick` moves to `.apathy__segment`.

- [ ] **Step 8: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Curve the Apathy gauge around the medallion it belongs to"
```

---

## Task 6: The shut-tab dot

**Spec:** §5.3.

**Files:**

- Modify: `apps/web/src/ui/Deck.tsx`, `apps/web/src/ui/Deck.css`
- Modify: `apps/web/src/App.tsx:105-177`
- Modify: `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`
- Modify: `apps/web/src/ui/Deck.test.tsx`

**Interfaces:**

- Consumes: `RailPlan.best` — `{ purchase: RailPurchase | null; appoint: RailAppointment | null; climb: RailClimb | null }`.
- Produces: `DeckTab` gains `marked?: boolean`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/ui/Deck.test.tsx` holds a module-level `TABS` array and a `draw()` that renders it. These tests need their own tabs, so they call `render` directly:

```tsx
  it('marks a shut tab holding something affordable', () => {
    const tabs: DeckTab[] = [
      { id: 'one', title: 'One', panel: <p>one</p> },
      { id: 'two', title: 'Two', panel: <p>two</p>, marked: true, markedLabel: 'something to spend on' },
    ];
    const { container } = render(<Deck tabs={tabs} />);

    expect(container.querySelectorAll('.deck__mark')).toHaveLength(1);
  });

  it('leaves an unmarked tab unmarked', () => {
    const { container } = render(<Deck tabs={TABS} />);

    expect(container.querySelectorAll('.deck__mark')).toHaveLength(0);
  });

  it('never marks the tab that is already open', () => {
    const tabs: DeckTab[] = [
      { id: 'one', title: 'One', panel: <p>one</p>, marked: true, markedLabel: 'something to spend on' },
      { id: 'two', title: 'Two', panel: <p>two</p> },
    ];
    const { container } = render(<Deck tabs={tabs} />);

    expect(container.querySelectorAll('.deck__mark')).toHaveLength(0);
  });

  it('never lets the mark wear the accent', () => {
    const tabs: DeckTab[] = [
      { id: 'one', title: 'One', panel: <p>one</p> },
      { id: 'two', title: 'Two', panel: <p>two</p>, marked: true, markedLabel: 'something to spend on' },
    ];
    const { container } = render(<Deck tabs={tabs} />);

    expect(container.querySelector('.deck__mark')?.className).not.toContain('accent');
  });

  it('says on a marked tab, by ear, that something there is affordable', () => {
    const tabs: DeckTab[] = [
      { id: 'one', title: 'One', panel: <p>one</p> },
      { id: 'two', title: 'Two', panel: <p>two</p>, marked: true, markedLabel: 'something to spend on' },
    ];
    render(<Deck tabs={tabs} />);

    expect(screen.getByRole('tab', { name: /something to spend on/ })).toBeInTheDocument();
  });
```

The third test pins the behaviour the render condition already has — an open tab shows its contents, so a dot on it would say nothing the panel is not already saying.

- [ ] **Step 2: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/Deck.test.tsx
```

Expected: FAIL — no `.deck__mark` exists.

- [ ] **Step 3: Add the mark**

In `apps/web/src/ui/Deck.tsx`, add to `DeckTab`:

```ts
  /**
   * Whether this panel holds something the player can afford right now.
   *
   * Drawn as a dot on the tab, and **never as the accent.** The accent is spent on
   * doing, never on going, and a tab is navigation — so the dot says "something here"
   * without claiming to be the thing worth pressing.
   */
  marked?: boolean;
  /**
   * Said on a marked tab's spoken name. Required in spirit whenever `marked` is set —
   * a dot hidden from assistive tech is a signal only sighted players get.
   */
  markedLabel?: string;
```

Render the dot inside `.deck__field`, after the glyph, and append the label to the tab's accessible name:

```tsx
            <span className="deck__edge">
              <span className="deck__field">
                {tab.glyph !== undefined && (
                  <span className="deck__glyph" aria-hidden="true">
                    <DeckGlyph kind={tab.glyph} />
                  </span>
                )}
                {marked(tab, index === open) && <span className="deck__mark" aria-hidden="true" />}
                <span className="deck__name">
                  {tab.title}
                  {marked(tab, index === open) && tab.markedLabel !== undefined
                    ? `. ${tab.markedLabel}`
                    : ''}
                </span>
              </span>
            </span>
```

with, below the component:

```tsx
/**
 * Whether this tab should wear the dot.
 *
 * Never the open one. Its panel is on screen, so the dot would be saying what the
 * player is already looking at.
 */
function marked(tab: DeckTab, isOpen: boolean): boolean {
  return tab.marked === true && !isOpen;
}
```

`.deck__name` is already visually hidden and carries the tab's spoken name — check that this is still true of the stylesheet before relying on it, and if the name is visible, put the label in an `aria-label` on the button instead.

Add the copy. In `packages/content/src/copy.ts`, add to `RailCopy` beside `lifted`:

```ts
  /** Added to a shut tab's spoken name when that panel holds something affordable. */
  readonly waiting: string;
```

In `packages/content/src/v1/copy.ts`, in the `rail` block beside `lifted`:

```ts
    waiting: 'something to spend on',
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/Deck.test.tsx
```

- [ ] **Step 5: Style the mark**

In `apps/web/src/ui/Deck.css`:

```css
/*
 * A shut panel holding something affordable.
 *
 * Neutral-bright, never `--accent`: the accent means *press this*, and a tab is a way
 * of getting somewhere rather than a thing to do. See Deck.tsx.
 */
.deck__mark {
  --deck-mark: 5px;

  inline-size: var(--deck-mark);
  block-size: var(--deck-mark);
  border-radius: 50%;
  background: var(--ink-muted);
}
```

Place it in the flow so it does not shift the glyph — read how `.deck__field` lays out and follow it.

- [ ] **Step 6: Feed it from `App`**

In `apps/web/src/App.tsx`, add `marked` and `markedLabel` to the three spending tabs:

- `muster`: `marked: plan.best.purchase !== null`
- `miscreants`: `marked: plan.best.appoint !== null`
- `malice`: `marked: plan.best.climb !== null`

`markedLabel: copy.rail.waiting` on all three.

**The `deeds` tab gets neither**, and that is right rather than an omission: deeds are a record, not a spend, and there is nothing there to press.

- [ ] **Step 7: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Mark a shut tab that is holding something you can afford"
```

---

## Task 7: Finding the prestige panel

**Spec:** §5.2.

**Files:**

- Create: `apps/web/src/ui/rail/PrestigeLocked.tsx`, `PrestigeLocked.css`, `PrestigeLocked.test.tsx`
- Create: `apps/web/src/ui/rail/PrestigeMarker.tsx`, `PrestigeMarker.css`, `PrestigeMarker.test.tsx`
- Modify: `apps/web/src/App.tsx:213-228`, `apps/web/src/App.css`
- Modify: `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`

**Interfaces:**

- Consumes: `isPrestigeWorthShowing(state, content)` from `apps/web/src/game/reveals.ts`; `prestigeGain(state, content): Decimal` from `@dm/engine`; `useReducedMotion()` from `apps/web/src/ui/useReducedMotion.ts`.
- Produces: `PrestigeLocked({ copy }: { copy: PrestigeCopy })` and `PrestigeMarker({ copy, onReveal }: { copy: PrestigeCopy; onReveal: () => void })`.

**Context you need:** `App` renders `<PrestigePanel />` inside `.shell__side` only when `isPrestigeWorthShowing` is true, so before that the slot is empty and the panel shoves the page down when it arrives. Separately, the panel sits below a deck with a tall floor height — on a phone that is a long scroll past the fold, which is the failure actually reported.

The marker's condition is **`prestigeGain(state, content).gt(0) && state.stats.prestiges === 0`**. Derived wholly from state the game already holds: a "dismissed" flag would have to be persisted or it returns on every reload, and persisting it means a save migration for interface chrome.

- [ ] **Step 1: Add the copy**

In `packages/content/src/copy.ts`, add to `PrestigeCopy`:

```ts
  /** Held in the panel's slot before souls are anywhere in reach. */
  readonly locked: string;
  /** The notice that leads a first-time player to the panel. */
  readonly owed: string;
  /** That notice's control. */
  readonly owedAction: string;
```

In `packages/content/src/v1/copy.ts`, in the `prestige` block:

```ts
    locked: 'Inflict further suffering.',
    owed: 'Souls are owed to you.',
    owedAction: 'Go and count them',
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/ui/rail/PrestigeLocked.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CURRENT_COPY } from '@dm/content';
import { PrestigeLocked } from './PrestigeLocked.tsx';

describe('PrestigeLocked', () => {
  it('says what to go and do', () => {
    render(<PrestigeLocked copy={CURRENT_COPY.prestige} />);

    expect(screen.getByText('Inflict further suffering.')).toBeInTheDocument();
  });

  it('offers nothing to press', () => {
    render(<PrestigeLocked copy={CURRENT_COPY.prestige} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

Create `apps/web/src/ui/rail/PrestigeMarker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT_COPY } from '@dm/content';
import { PrestigeMarker } from './PrestigeMarker.tsx';

describe('PrestigeMarker', () => {
  it('says souls are owed', () => {
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={() => {}} />);

    expect(screen.getByText('Souls are owed to you.')).toBeInTheDocument();
  });

  it('leads to the panel when pressed', async () => {
    const onReveal = vi.fn();
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={onReveal} />);
    await userEvent.click(screen.getByRole('button', { name: 'Go and count them' }));

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('never wears the accent, because the stage and the deck already carry one each', () => {
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={() => {}} />);

    expect(screen.getByRole('button').className).not.toContain('button--primary');
  });
});
```

`CURRENT_COPY` stands for whatever `@dm/content` actually exports for the shipping copy — **check `packages/content/src/index.ts` and use the real name.**

- [ ] **Step 3: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/PrestigeLocked.test.tsx apps/web/src/ui/rail/PrestigeMarker.test.tsx
```

Expected: FAIL — neither module exists.

- [ ] **Step 4: Write the two components**

`apps/web/src/ui/rail/PrestigeLocked.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { PrestigeCopy } from '@dm/content';
import { Panel } from '../Panel.tsx';
import './PrestigeLocked.css';

interface PrestigeLockedProps {
  copy: PrestigeCopy;
}

/**
 * The slot the reset will fill, held open before it can be taken.
 *
 * A placeholder in place, sized to what lands — the rule the rest of the interface keeps
 * everywhere. Without it the panel arrives from nowhere and shoves the deck up the page
 * once a session, which is the one thing a screen is not allowed to do.
 *
 * It names what to go and do rather than what is missing. "Inflict further suffering"
 * is a direction; "souls locked" is a complaint.
 *
 * Nothing here is pressable. A disabled control would say the reset is a thing you
 * nearly have, and it is not — it is a thing you have not earned.
 */
export function PrestigeLocked({ copy }: PrestigeLockedProps): ReactNode {
  return (
    <Panel title={copy.name} glyph="✧">
      <p className="prestige-locked__line">{copy.locked}</p>
    </Panel>
  );
}
```

`apps/web/src/ui/rail/PrestigeMarker.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { PrestigeCopy } from '@dm/content';
import './PrestigeMarker.css';

interface PrestigeMarkerProps {
  copy: PrestigeCopy;
  onReveal: () => void;
}

/**
 * A line above the deck, the first time souls are owed.
 *
 * The panel is below a deck that holds a floor height, which on a phone is a long scroll
 * past the fold — so a player can be well past the reveal threshold, with the panel
 * rendering, and never find it. A panel nobody scrolls to is not on screen.
 *
 * **Not the accent.** The stage carries one and the open deck panel carries the other;
 * a third would leave no primary at all (ui-sensibility §3). This is a signpost, and a
 * signpost is not a verb.
 *
 * Shown only before the first reset. After that, nobody needs telling where the button
 * is — which is also why nothing about this has to be saved.
 */
export function PrestigeMarker({ copy, onReveal }: PrestigeMarkerProps): ReactNode {
  return (
    <p className="prestige-marker" role="status">
      <span className="prestige-marker__line">{copy.owed}</span>
      <button type="button" className="button" onClick={onReveal}>
        {copy.owedAction}
      </button>
    </p>
  );
}
```

Write both stylesheets in the idiom of `apps/web/src/ui/rail/PrestigePanel.css` — semantic tokens only, component tokens declared at the top if a drawn size needs one.

- [ ] **Step 5: Run the tests and watch them pass**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/PrestigeLocked.test.tsx apps/web/src/ui/rail/PrestigeMarker.test.tsx
```

- [ ] **Step 6: Wire both into `App`**

In `apps/web/src/App.tsx`, replace the conditional render of `PrestigePanel` inside `.shell__side`:

```tsx
          <div className="shell__side">
            {showMarker && <PrestigeMarker copy={copy.prestige} onReveal={revealPrestige} />}

            <Deck tabs={tabs} />

            <div ref={prestigeSlot}>
              {isPrestigeWorthShowing(state, content) ? (
                <PrestigePanel
                  content={content}
                  copy={copy.prestige}
                  state={state}
                  version={session.version}
                  onPrestige={() => {
                    dispatch({ kind: 'prestige' });
                    sound.play('prestige');
                  }}
                />
              ) : (
                <PrestigeLocked copy={copy.prestige} />
              )}
            </div>
          </div>
```

Above the return, add:

```tsx
  const prestigeSlot = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const showMarker = prestigeGain(state, content).gt(0) && state.stats.prestiges === 0;

  // jsdom implements neither `scrollIntoView` nor smooth behaviour, so the call is
  // optional rather than guarded by a capability check — the test then exercises the
  // real branch everywhere the real method exists.
  const revealPrestige = (): void => {
    prestigeSlot.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };
```

Import `useRef` from `react`, `prestigeGain` from `@dm/engine`, `useReducedMotion` from `./ui/useReducedMotion.ts`, and both new components.

- [ ] **Step 7: Run the whole suite**

```bash
./node_modules/.bin/vitest run apps/web
```

`App`'s own tests may assert that nothing sits below the deck early on. Update those to expect the placeholder — that is the change working.

- [ ] **Step 8: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Hold the reset's slot and point a first-time player at it"
```

---

## Task 8: What a reset actually takes

**Spec:** §5.4.

**Files:**

- Modify: `packages/content/src/v1/copy.ts:245-258`
- Modify: `packages/content/test/copy.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. `PrestigeCopy`'s shape is unchanged — only the strings move.

**Context you need — check this against the engine before writing a word.** `prestige` in `packages/engine/src/intents.ts:226-271` is the authority. It carries forward `souls`, `lifetimeEvil`, `stats`, `earnedAchievements`, `unlocked`, `smiteKept` and `soulsSpent`. It replaces `resources`, `gens` and `overseers` from a fresh state, and sets `smiteRungs = { ...smiteKept }`.

So a reset **takes** the Evil, every generator, every Overseer, every milestone, and every smite rung not bought with souls. It **keeps** the souls, the achievements, the unlock flags, and the soul-bought rungs.

The current copy says it keeps "everything you have unlocked", which reads as covering the Overseers and the rungs. It does not. Both are real power, lost without warning.

- [ ] **Step 1: Write the failing tests**

Add to `packages/content/test/copy.test.ts`:

```ts
  it('names the Overseers among what a reset takes', () => {
    expect(v1Copy.prestige.clears).toMatch(/Overseer/i);
  });

  it('names the smite ranks among what a reset takes', () => {
    expect(v1Copy.prestige.clears).toMatch(/rank/i);
  });

  it('does not claim a reset keeps everything you have unlocked', () => {
    expect(v1Copy.prestige.keeps).not.toMatch(/everything you have unlocked/i);
    expect(v1Copy.prestige.confirmBody('40')).not.toMatch(/everything you have unlocked/i);
  });

  it('says the kept ranks are the ones souls paid for', () => {
    expect(v1Copy.prestige.keeps).toMatch(/soul/i);
  });
```

`v1Copy` stands for whatever the file already imports — **read it and match**.

- [ ] **Step 2: Run them and watch them fail**

```bash
./node_modules/.bin/vitest run packages/content/test/copy.test.ts
```

Expected: FAIL on all four.

- [ ] **Step 3: Rewrite the three strings**

In `packages/content/src/v1/copy.ts`, replace:

```ts
    clears:
      'Your Evil, everything you have built, every Overseer you appointed, every milestone, and every rank you did not pay souls to keep.',
    clearsTitle: 'Taken from you',
    keeps:
      'Your souls, your deeds, the tiers you have seen, and the ranks you paid souls to keep.',
    keepsTitle: 'Left to you',
```

and:

```ts
    confirmBody: (souls: string): string =>
      `You take ${souls} Damned Souls and start from nothing. Your souls, your deeds, the tiers you have seen and the ranks you paid souls to keep stay. Your Evil, every Throne, Fortress, Legion, Warren and Minion, every Overseer, every milestone, and every rank you did not pay for go.`,
```

Read these back against the Orwell rules before committing them: cut any word that can go, and keep the active voice.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
./node_modules/.bin/vitest run packages/content/test/copy.test.ts
```

- [ ] **Step 5: Check the panel still lays out**

```bash
./node_modules/.bin/vitest run apps/web/src/ui/rail/PrestigePanel.test.tsx
```

The strings are longer than what they replace. `PrestigePanel` renders `clears` and `keeps` as single `<li>` items in a two-column ledger; a test asserting exact text will need updating. **If the columns now read badly at a phone width, say so in your report** — it is a real finding, not something to fix by shortening the truth.

- [ ] **Step 6: Full check and commit**

```bash
pnpm check
git add -A
git commit -m "Say what a reset actually takes"
```

---

## Final verification

After Task 8:

- [ ] `pnpm check` passes.
- [ ] `pnpm harness` reports the four tier times and the obsolescence table unchanged from Task 1 Step 7.
- [ ] `git log --oneline` shows eight commits, one per task.
- [ ] No file named `ApathyTicks.*` remains: `git ls-files | grep ApathyTicks` prints nothing.
- [ ] `grep -rn 'HORIZON_SECONDS = 600' apps packages` finds nothing.
- [ ] Every commit is signed, or the unsigned SHAs are listed for re-signing.
