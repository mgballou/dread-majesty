# Smite as a System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Smite a cost (Apathy), a ceiling, and a shop of four upgrade ladders bought with Evil and made permanent with souls.

**Architecture:** `SmiteDef` stops holding flat values and holds four ladders instead; rung 0 of each is the value the game runs on today. A new `packages/engine/src/smite.ts` resolves a ladder to the value at the player's rung, and every existing reader goes through it. Apathy is one real number on `GameState` that `step` bleeds and the `smite` intent reads before it strikes. Two new intents climb a ladder with Evil and lock a rung with souls. The web gains a fifth panel's worth of content in the deck's fourth slot, and the ledger moves back to a footer button and a `Sheet`.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `break_eternity.js`, React 19, Vite, Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-04-smite-as-a-system-design.md`. Read the section a task cites before starting it.

## Global Constraints

These bind every task. Copied from `CLAUDE.md` and the spec.

- **No `Date.now()`, no `Math.random()`, no I/O inside `packages/engine`.**
- **`step` and `apply` are the only functions permitted to mutate `GameState`.** Every selector and every component treats state as read-only.
- **Read from a snapshot, write into a delta, commit at slice end.** Nothing produced within a slice may affect anything else within that same slice.
- **One `step`, called from both paths.** No second simulation for offline.
- **Every resource and generator count is a `Decimal`.** Never a JS number. `smiteApathy`, `smiteBlow`, `smiteRungs` and `smiteKept` are plain numbers and this is correct — a gauge, a multiplier and two integer indices are none of them a resource or a generator count, and they sit beside `smiteActiveMs` and `stats.smites`, which are already plain. `souls` and `soulsSpent` are `Decimal`.
- **The engine never imports content balance data.** `v1` and `CURRENT` are barred by lint. Engine tests run against `packages/engine/test/fixtures/`, never shipping content.
- **No `any`. No `as` casts** except where a type guard genuinely cannot express it, with a comment saying why. `unknown` at boundaries, narrowed immediately.
- **No default exports. No barrel re-exports across packages** beyond each package's `src/index.ts`.
- **`as const` for every content literal and id set.** Ids are unions of literals, never `string`.
- **Discriminated unions over string flags.** An intent is `{ kind: 'climb', ... }`.
- **Errors are typed classes with a static factory.** Never `throw new Error('...')`.
- **No raw values outside `apps/web/src/ui/tokens.css`.** Semantic names only — never `#c9a227`, never `grey-800`.
- **One accent per region.** The stage's is Smite; the deck's open panel carries its own.
- **Reduced motion is designed, not stripped.** Nothing visible under full motion may go missing under reduced motion.
- **Number formatting is one shared function** — `formatNumber` in `apps/web/src/ui/format.ts` — for every `Decimal`.
- **No comments in tests** unless the test is genuinely unusual. One assertion per `expect`.
- **Run `pnpm check` before every commit.** It is `typecheck + lint + test`.
- **Commit messages: imperative, one line, no trailers, no AI attribution.**
- **Node:** the default `node` on this machine is v23.2.0 and lacks `node:sqlite`, which breaks pnpm. Every shell that runs pnpm must first run:
  `export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"`
- **`pnpm --filter @dm/web test <pattern>` silently does nothing on this machine** (exits 0 in ~0.2s with no output). To run one web test file: `cd apps/web && npx vitest run <path>`.

### One correction this plan makes to the spec

The spec has souls buying permanence but does not say what happens to the souls. `prestigeGain` is `soulsEarned(lifetimeEvil) − state.souls`, so **spending souls would raise the next prestige payout by exactly what was spent** — every Keep refunds itself on the next reset and permanence is free.

This plan adds `soulsSpent: Decimal` to `GameState`, subtracts it in `prestigeGain`, and leaves `globalMultiplier` reading `state.souls` alone. So a Keep costs souls permanently and costs the 2%-per-soul production multiplier with them. That is the price the design needs; without it there is no price at all. Task 2 adds the field, Task 5 wires it.

---

## File Structure

**`packages/content`**

| File | Responsibility |
| --- | --- |
| `src/ids.ts` | add `SMITE_UPGRADE_IDS`, `SmiteUpgradeId`, `isSmiteUpgradeId` |
| `src/types.ts` | rewrite `SmiteDef`; add `SmiteRungDef`, `SmiteUpgradeDef`, `SmiteUnit` |
| `src/index.ts` | export all of the above |
| `src/v1/generators.ts` | the shipping smite block: cooldown, apathy, four ladders |
| `src/copy.ts` | `SmiteCopy` additions; new `WrathCopy`; `Copy.wrath` |
| `src/v1/copy.ts` | the writing |
| `test/generators.test.ts` | ladder shape and ordering |

**`packages/engine`**

| File | Responsibility |
| --- | --- |
| `src/smite.ts` | **new.** Ladder resolution and every smite selector |
| `src/types.ts` | new state fields, two new intents, four new failures |
| `src/state.ts` | `createState`, `cloneState`, `SAVE_VERSION` 8 |
| `src/step.ts` | Apathy bleed; `globalMultiplier` reads `smiteBlow` |
| `src/intents.ts` | `smite` rewritten; `climb`, `keep`; `prestige` changes |
| `src/selectors.ts` | `smitePhase` clamps and resolves; `prestigeGain` subtracts `soulsSpent` |
| `src/save.ts` | blob fields, serialize, deserialize, migration 7 → 8 |
| `src/index.ts` | exports |
| `test/fixtures/content.ts` | fixture smite block in the new shape |
| `test/smite.test.ts` | rewritten and extended |
| `test/wrath.test.ts` | **new.** climb, keep, prestige, the measure |

**`apps/web`**

| File | Responsibility |
| --- | --- |
| `src/ui/tokens.css` | `--tone-apathy`, `--tone-apathy-well` |
| `src/ui/stage/ApathyBar.tsx` / `.css` | **new.** The gauge under the Smite button |
| `src/ui/stage/EvilNode.tsx` / `.css` | takes `state`, mounts the bar |
| `src/ui/wrath/Wrath.tsx` / `.css` | **new.** The four-ladder panel |
| `src/ui/rail/railPlan.ts` | third option kind |
| `src/ui/rail/useRailPlan.ts` | third held key |
| `src/ui/rail/QuantityChip.css` | padding |
| `src/ui/DeckGlyph.tsx` | `'wrath'` replaces `'ledger'` |
| `src/App.tsx` / `App.css` | deck tabs, footer button, `Sheet` |

---

## Task 1: The four upgrade ids

**Spec:** §4.1.

**Files:**
- Modify: `packages/content/src/ids.ts`
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/test/generators.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SMITE_UPGRADE_IDS: readonly ['weight', 'reach', 'forgetting', 'restraint']`, `type SmiteUpgradeId = (typeof SMITE_UPGRADE_IDS)[number]`, `isSmiteUpgradeId(id: string): id is SmiteUpgradeId`. All three exported from `@dm/content`.

Purely additive. Nothing reads these yet, so nothing else can break.

- [ ] **Step 1: Write the failing test**

Append to `packages/content/test/generators.test.ts`:

```ts
describe('the smite upgrade ids', () => {
  it('names four ladders', () => {
    expect(SMITE_UPGRADE_IDS).toHaveLength(4);
  });

  it('repeats none of them', () => {
    expect(new Set(SMITE_UPGRADE_IDS).size).toBe(SMITE_UPGRADE_IDS.length);
  });

  it('accepts an id it ships', () => {
    expect(isSmiteUpgradeId('weight')).toBe(true);
  });

  it('rejects an id it does not', () => {
    expect(isSmiteUpgradeId('patience')).toBe(false);
  });
});
```

Add to the imports at the top of that file:

```ts
import { SMITE_UPGRADE_IDS, isSmiteUpgradeId } from '../src/ids.ts';
```

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/content test
```

Expected: FAIL — `SMITE_UPGRADE_IDS` is not exported from `../src/ids.ts`.

- [ ] **Step 3: Add the ids**

Append to `packages/content/src/ids.ts`, after `ACHIEVEMENT_IDS`:

```ts
/**
 * The four ladders a player climbs to make a blow worth more.
 *
 * Ids are permanent — a save records the rung each one stands on — so one may be
 * added but never renamed or reused. Content order is offer order, and the content
 * lists Reach first because it is the cheapest and the one that teaches the system.
 */
export const SMITE_UPGRADE_IDS = ['weight', 'reach', 'forgetting', 'restraint'] as const;
export type SmiteUpgradeId = (typeof SMITE_UPGRADE_IDS)[number];
```

And beside the other guards at the bottom of the file:

```ts
export function isSmiteUpgradeId(id: string): id is SmiteUpgradeId {
  return (SMITE_UPGRADE_IDS as readonly string[]).includes(id);
}
```

- [ ] **Step 4: Export from the package surface**

In `packages/content/src/index.ts`, add `SMITE_UPGRADE_IDS` and `isSmiteUpgradeId` to the value export from `./ids.ts`, and `SmiteUpgradeId` to the type export:

```ts
export {
  TIER_IDS,
  RESOURCE_IDS,
  ACHIEVEMENT_IDS,
  OVERSEER_IDS,
  SMITE_UPGRADE_IDS,
  isTierId,
  isResourceId,
  isAchievementId,
  isOverseerId,
  isSmiteUpgradeId,
} from './ids.ts';
export type {
  TierId,
  ResourceId,
  ProducibleId,
  AchievementId,
  OverseerId,
  SmiteUpgradeId,
} from './ids.ts';
```

- [ ] **Step 5: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS, everything green.

- [ ] **Step 6: Commit**

```bash
git add packages/content/src/ids.ts packages/content/src/index.ts packages/content/test/generators.test.ts
git commit -m "Name the four smite upgrade ladders"
```

---

## Task 2: The state fields and save version 8

**Spec:** §4.2, §4.5, and this plan's "One correction".

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/state.ts`
- Modify: `packages/engine/src/save.ts`
- Test: `packages/engine/test/save.test.ts`

**Interfaces:**
- Consumes: `SmiteUpgradeId`, `SMITE_UPGRADE_IDS` from `@dm/content` (Task 1).
- Produces: on `GameState` — `smiteApathy: number`, `smiteBlow: number`, `smiteRungs: Record<SmiteUpgradeId, number>`, `smiteKept: Record<SmiteUpgradeId, number>`, `soulsSpent: Decimal`. `SAVE_VERSION = 8`.

Additive only. Nothing reads these yet.

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/test/save.test.ts`. Match the file's existing import style — it already imports `deserialize`, `serialize`, `migrate` and `createState`; add `SMITE_UPGRADE_IDS` from `@dm/content` if it is not already there.

```ts
describe('save version 8', () => {
  it('migrates a version 7 blob', () => {
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(migrate(blob).saveVersion).toBe(8);
  });

  it('starts a migrated save with no apathy', () => {
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(deserialize(blob).smiteApathy).toBe(0);
  });

  it('starts a migrated save with a blow worth nothing extra', () => {
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(deserialize(blob).smiteBlow).toBe(1);
  });

  it('starts a migrated save at the bottom of every ladder', () => {
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };
    const state = deserialize(blob);

    expect(SMITE_UPGRADE_IDS.map((id) => state.smiteRungs[id])).toEqual([0, 0, 0, 0]);
  });

  it('starts a migrated save having spent no souls', () => {
    const blob = { ...serialize(createState(fixture), 0), saveVersion: 7 };

    expect(deserialize(blob).soulsSpent.eq(0)).toBe(true);
  });

  it('round-trips the rungs it was given', () => {
    const state = createState(fixture);
    state.smiteRungs.weight = 2;
    state.smiteKept.weight = 1;

    expect(deserialize(serialize(state, 0)).smiteKept.weight).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/engine test
```

Expected: FAIL — `smiteApathy` does not exist on `GameState`.

- [ ] **Step 3: Add the state fields**

In `packages/engine/src/types.ts`, add `SmiteUpgradeId` to the type import from `@dm/content`, then insert these after `smiteCooldownMs`:

```ts
  /**
   * How tired the realm is of being smitten. 0 to `content.smite.apathy.cap`, real.
   *
   * Every blow adds to it and it bleeds off on its own, which is what turns Smite from
   * a metronome into a decision — see spec §2. A real number rather than an integer
   * deliberately: an integer sheds in visible jumps, and a jump is a knife-edge where
   * hitting the shed by a second is worth a great deal and missing it by a second is
   * worth nothing.
   *
   * A plain number, not a `Decimal`. It is a bounded gauge, not a resource or a
   * generator count, and it sits beside the countdowns above for the same reason.
   */
  smiteApathy: number;
  /**
   * The multiplier the running blow carries. 1 when none runs.
   *
   * Necessary because the multiplier now varies per blow: `globalMultiplier` has to
   * know what **this** blow was worth, not what a fresh one would be. Without it,
   * buying Weight mid-blow would retroactively upgrade the blow already running.
   */
  smiteBlow: number;
  /**
   * Where each ladder stands this run. A reset drops each to its `smiteKept` floor.
   *
   * Rung 0 is the ladder's base value and costs nothing. The invariant `smiteKept[id]
   * <= smiteRungs[id]` holds always, which is why the effective value reads
   * `smiteRungs` alone and there is no `max()` anywhere in the engine.
   */
  smiteRungs: Record<SmiteUpgradeId, number>;
  /** The permanent floor, bought with souls. Never cleared by a reset. */
  smiteKept: Record<SmiteUpgradeId, number>;
```

And beside `souls`:

```ts
  /**
   * Souls spent on permanence, kept for ever.
   *
   * `prestigeGain` is `soulsEarned(lifetimeEvil) − souls`, so without this a spent soul
   * would come straight back on the next reset and permanence would be free. Subtracting
   * it is what makes a Keep cost something. `globalMultiplier` reads `souls` alone and
   * not this, so spending also costs the 2%-per-soul production it was granting — which
   * is the whole price of locking a rung in.
   */
  soulsSpent: Decimal;
```

- [ ] **Step 4: Fill them in `createState` and `cloneState`**

In `packages/engine/src/state.ts`, add to the imports:

```ts
import { RESOURCE_IDS, SMITE_UPGRADE_IDS, TIER_IDS } from '@dm/content';
import type { Content, OverseerId, ResourceId, SmiteUpgradeId, TierId } from '@dm/content';
```

Bump the version and record the step:

```ts
/**
 * 1: the original shape.
 * 2: adds `earnedAchievements`.
 * 3: adds `unlocked`.
 * 4: adds `overseers`, and `running` on every tier.
 * 5: adds the two smite countdowns.
 * 6: adds purchased counts, and turns `overseers` from a per-tier flag into the
 *    posts held, in content order.
 * 7: adds the per-run clock.
 * 8: adds Apathy, the running blow's multiplier, the two ladder counters and the
 *    souls spent on permanence.
 */
export const SAVE_VERSION = 8;
```

Inside `createState`, before the `return`:

```ts
  const smiteRungs = {} as Record<SmiteUpgradeId, number>;
  const smiteKept = {} as Record<SmiteUpgradeId, number>;
  for (const id of SMITE_UPGRADE_IDS) {
    smiteRungs[id] = 0;
    smiteKept[id] = 0;
  }
```

And in the returned object, after `smiteCooldownMs: 0,`:

```ts
    smiteApathy: 0,
    smiteBlow: 1,
    smiteRungs,
    smiteKept,
```

and beside `souls`:

```ts
    soulsSpent: new Decimal(0),
```

In `cloneState`, before the `return`:

```ts
  const smiteRungs = {} as Record<SmiteUpgradeId, number>;
  const smiteKept = {} as Record<SmiteUpgradeId, number>;
  for (const id of SMITE_UPGRADE_IDS) {
    smiteRungs[id] = state.smiteRungs[id];
    smiteKept[id] = state.smiteKept[id];
  }
```

and in its returned object:

```ts
    soulsSpent: new Decimal(state.soulsSpent),
    smiteApathy: state.smiteApathy,
    smiteBlow: state.smiteBlow,
    smiteRungs,
    smiteKept,
```

- [ ] **Step 5: Carry them through the save**

In `packages/engine/src/save.ts`, add to the imports:

```ts
import { isAchievementId, isOverseerId, RESOURCE_IDS, SMITE_UPGRADE_IDS, TIER_IDS } from '@dm/content';
import type { AchievementId, OverseerId, ResourceId, SmiteUpgradeId, TierId } from '@dm/content';
```

Add to `SaveBlob`, after `smiteCooldownMs?: number;`:

```ts
  /** Added in save version 8. Optional because a version 7 blob does not carry it. */
  smiteApathy?: number;
  smiteBlow?: number;
  smiteRungs?: Record<string, number>;
  smiteKept?: Record<string, number>;
  soulsSpent?: string;
```

In `serialize`, before the `return`:

```ts
  const smiteRungs: Record<string, number> = {};
  const smiteKept: Record<string, number> = {};
  for (const id of SMITE_UPGRADE_IDS) {
    smiteRungs[id] = state.smiteRungs[id];
    smiteKept[id] = state.smiteKept[id];
  }
```

and in its returned object, after `smiteCooldownMs: state.smiteCooldownMs,`:

```ts
    smiteApathy: state.smiteApathy,
    smiteBlow: state.smiteBlow,
    smiteRungs,
    smiteKept,
    soulsSpent: state.soulsSpent.toString(),
```

In `deserialize`, before the `return`:

```ts
  // Unknown ids are dropped rather than trusted, and a missing one reads as the bottom
  // of its ladder — the same policy the achievement and roster lists follow above.
  const smiteRungs = {} as Record<SmiteUpgradeId, number>;
  const smiteKept = {} as Record<SmiteUpgradeId, number>;
  for (const id of SMITE_UPGRADE_IDS) {
    const rung = migrated.smiteRungs?.[id] ?? 0;
    const kept = migrated.smiteKept?.[id] ?? 0;
    smiteRungs[id] = Math.max(rung, kept);
    smiteKept[id] = Math.min(rung, kept);
  }
```

and in its returned object:

```ts
    soulsSpent: new Decimal(migrated.soulsSpent ?? '0'),
    smiteApathy: migrated.smiteApathy ?? 0,
    smiteBlow: migrated.smiteBlow ?? 1,
    smiteRungs,
    smiteKept,
```

The `max`/`min` pair is not defensive noise: `smiteKept <= smiteRungs` is an invariant the whole engine reads without checking, and a hand-edited or truncated blob is the one place it can arrive violated. Clamping here means it can never be violated anywhere else.

Add the migration entry:

```ts
  // 7 → 8: Apathy, the two ladder counters and the souls spent on permanence arrive.
  // Every default is the game a version 7 save was already playing — no Apathy, a blow
  // worth its base, every ladder at rung 0 and nothing spent. `deserialize` supplies
  // them, so this step only moves the number.
  7: (blob) => ({ ...blob, saveVersion: 8 }),
```

- [ ] **Step 6: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS. If `apps/web` builds a `GameState` literal anywhere it will now fail typecheck; add the five fields there with the same defaults.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src packages/engine/test
git commit -m "Add the smite ladder state and save version 8"
```

---

## Task 3: Ladders replace the flat smite values

**Spec:** §3.1, §4.1, §4.4.

**Files:**
- Modify: `packages/content/src/types.ts`
- Modify: `packages/content/src/index.ts`
- Modify: `packages/content/src/v1/generators.ts`
- Create: `packages/engine/src/smite.ts`
- Modify: `packages/engine/src/step.ts`, `src/selectors.ts`, `src/intents.ts`, `src/index.ts`
- Modify: `packages/engine/test/fixtures/content.ts`
- Modify: `packages/engine/test/smite.test.ts`
- Modify: `apps/web/src/ui/stage/EvilNode.tsx`, `apps/web/src/ui/stage/ChainStage.tsx`
- Modify: `apps/web/src/ui/crown/Crown.test.tsx`
- Test: `packages/content/test/generators.test.ts`

**Interfaces:**
- Consumes: `SmiteUpgradeId`, `SMITE_UPGRADE_IDS` (Task 1); `GameState.smiteRungs` (Task 2).
- Produces, all from `packages/engine/src/smite.ts` and re-exported by `@dm/engine`:
  - `smiteWeight(state: GameState, content: Content): number`
  - `smiteDurationMs(state: GameState, content: Content): number`
  - `smiteBleedMs(state: GameState, content: Content): number`
  - `smiteStep(state: GameState, content: Content): number`
- Produces from `@dm/content`: `SmiteRungDef`, `SmiteUpgradeDef`, `SmiteUnit`, and the rewritten `SmiteDef`.

**Behaviour must not change.** Rung 0 of Weight and Reach hold exactly what `multiplier` and `durationMs` held. This task moves values; it adds no mechanic.

**On argument style:** these selectors take `(state, content)` positionally, and Task 5's take `(state, content, id)`. `CLAUDE.md` asks for an object parameter at three arguments, but every neighbouring selector in this codebase is three positional — `productionPerSecond(state, content, producible)`, `milestoneProgress(state, content, tierId)`, `isUnlockReached(state, content, tierId)`. Match the neighbours. Consistency inside one file beats the general rule here, and this note exists so the point is not re-litigated in review.

- [ ] **Step 1: Write the failing content test**

Append to `packages/content/test/generators.test.ts`:

```ts
describe('the smite ladders', () => {
  it('ships one ladder per id', () => {
    expect(v1.smite.upgrades.map((upgrade) => upgrade.id).sort()).toEqual(
      [...SMITE_UPGRADE_IDS].sort(),
    );
  });

  it('gives every ladder four rungs', () => {
    for (const upgrade of v1.smite.upgrades) {
      expect(upgrade.rungs).toHaveLength(4);
    }
  });

  it('raises Weight up its ladder', () => {
    const values = ladder('weight').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('raises Reach up its ladder', () => {
    const values = ladder('reach').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('lowers Forgetting down its ladder', () => {
    const values = ladder('forgetting').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('lowers Restraint down its ladder', () => {
    const values = ladder('restraint').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('starts Weight where the flat multiplier used to sit', () => {
    expect(ladder('weight').base).toBe(2);
  });

  it('starts Reach where the flat duration used to sit', () => {
    expect(ladder('reach').base).toBe(15_000);
  });

  it('raises the Evil price at every rung of every ladder', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => new Decimal(rung.evil).toNumber());
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('raises the soul price at every rung of every ladder', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => new Decimal(rung.souls).toNumber());
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('never lets the cooldown fall under the shortest blow', () => {
    expect(v1.smite.cooldownMs).toBeGreaterThanOrEqual(ladder('reach').base);
  });
});
```

Add to that file's imports and, above the `describe`, the helper it uses:

```ts
import Decimal from 'break_eternity.js';
import { SMITE_UPGRADE_IDS, isSmiteUpgradeId } from '../src/ids.ts';
import type { SmiteUpgradeId, SmiteUpgradeDef } from '../src/index.ts';
```

```ts
function ladder(id: SmiteUpgradeId): SmiteUpgradeDef {
  const found = v1.smite.upgrades.find((upgrade) => upgrade.id === id);
  if (!found) throw new Error(`no ladder ${id}`);
  return found;
}
```

That `throw new Error` is in a test helper, not in shipping code, so the typed-error rule does not reach it.

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/content test
```

Expected: FAIL — `upgrades` does not exist on `SmiteDef`.

- [ ] **Step 3: Rewrite the content types**

Replace the whole `SmiteDef` block in `packages/content/src/types.ts`:

```ts
/** How a ladder's value should be drawn. The engine never reads it; the web does. */
export type SmiteUnit = 'seconds' | 'multiplier' | 'amount';

export interface SmiteRungDef {
  /** Evil to climb to this rung within a run. A string, so it never passes a float. */
  readonly evil: string;
  /** Souls to make this rung the permanent floor. A string, for the same reason. */
  readonly souls: string;
  /** What the effect reads at this rung. */
  readonly value: number;
}

/**
 * One ladder, and the four rungs above its base.
 *
 * `base` is rung 0 — what the ladder reads before anything is bought — and it carries
 * no price. Keeping it here rather than beside `cooldownMs` is what stops a base value
 * and a rung-0 value drifting apart.
 */
export interface SmiteUpgradeDef {
  readonly id: SmiteUpgradeId;
  /** Display title. The engine never reads it. */
  readonly name: string;
  readonly base: number;
  readonly unit: SmiteUnit;
  /** Rungs 1..N, ascending in price. Never includes rung 0. */
  readonly rungs: readonly SmiteRungDef[];
}

/**
 * The tap verb (spec §5.5), and what it costs to keep using it.
 *
 * A blow raises production for a while, and **every blow makes the next one worth
 * less**. Apathy bleeds off on its own, so striking well beats striking constantly and
 * both beat never striking. See `2026-08-04-smite-as-a-system-design.md` §2.
 *
 * The cooldown is flat and on no ladder. A blow lasts `reach` milliseconds, so a
 * cooldown shorter than that only re-ups a buff already running — the useful range
 * starts at the duration and every second above it cuts uptime. Escalating it could set
 * a ceiling but never create a choice, which is why the escalation is on the blow's
 * value instead. Reach is the tempo upgrade.
 */
export interface SmiteDef {
  readonly cooldownMs: number;
  readonly apathy: {
    /** Added to `smiteApathy` by every blow. */
    readonly perBlow: number;
    /** `smiteApathy` never exceeds this. */
    readonly cap: number;
  };
  /** One per `SmiteUpgradeId`. Content order is offer order. */
  readonly upgrades: readonly SmiteUpgradeDef[];
}
```

Add the `SmiteUpgradeId` import at the top of that file:

```ts
import type {
  AchievementId,
  OverseerId,
  ProducibleId,
  ResourceId,
  SmiteUpgradeId,
  TierId,
} from './ids.ts';
```

Export the new types from `packages/content/src/index.ts`, in the existing `./types.ts` type block:

```ts
  SmiteDef,
  SmiteRungDef,
  SmiteUpgradeDef,
  SmiteUnit,
```

- [ ] **Step 4: Write the shipping ladders**

Replace the `smite:` block in `packages/content/src/v1/generators.ts`:

```ts
  smite: {
    // Flat, and on no ladder. See SmiteDef's note on why escalating it cannot work.
    cooldownMs: 20 * SECOND,
    apathy: { perBlow: 1, cap: 3 },
    // Reach first: it is the cheapest, and uptime is the effect a player feels before
    // they have worked out what Apathy is doing.
    upgrades: [
      {
        id: 'reach',
        name: 'Reach',
        base: 15 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '2.5e3', souls: '8', value: 17 * SECOND },
          { evil: '3e4', souls: '20', value: 19 * SECOND },
          { evil: '3.6e5', souls: '50', value: 21 * SECOND },
          { evil: '4.3e6', souls: '120', value: 23 * SECOND },
        ],
      },
      {
        id: 'weight',
        name: 'Weight',
        base: 2,
        unit: 'multiplier',
        rungs: [
          { evil: '5e3', souls: '8', value: 2.25 },
          { evil: '6e4', souls: '20', value: 2.5 },
          { evil: '7.2e5', souls: '50', value: 2.75 },
          { evil: '8.6e6', souls: '120', value: 3 },
        ],
      },
      {
        id: 'forgetting',
        name: 'Forgetting',
        base: 45 * SECOND,
        unit: 'seconds',
        rungs: [
          { evil: '1e4', souls: '8', value: 40 * SECOND },
          { evil: '1.2e5', souls: '20', value: 36 * SECOND },
          { evil: '1.44e6', souls: '50', value: 32 * SECOND },
          { evil: '1.73e7', souls: '120', value: 30 * SECOND },
        ],
      },
      {
        id: 'restraint',
        name: 'Restraint',
        base: 0.25,
        unit: 'amount',
        rungs: [
          { evil: '1.5e4', souls: '8', value: 0.225 },
          { evil: '1.8e5', souls: '20', value: 0.2 },
          { evil: '2.16e6', souls: '50', value: 0.175 },
          { evil: '2.6e7', souls: '120', value: 0.15 },
        ],
      },
    ],
  },
```

- [ ] **Step 5: Create the resolver**

Create `packages/engine/src/smite.ts`:

```ts
import type { Content, SmiteUpgradeDef, SmiteUpgradeId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * What each ladder reads at the rung the player stands on.
 *
 * Every question about a blow's weight, its length, how fast Apathy bleeds and what a
 * point of it costs goes through here. `step` calls `smiteBleedMs` once a slice —
 * 36,000 times to catch up an hour — so the walk is over four entries and allocates
 * nothing but the result.
 *
 * Selectors here take `(state, content)` and `(state, content, id)` positionally, which
 * matches every neighbouring selector in this package rather than the object-parameter
 * rule. See the plan's Task 3 note.
 */

function ladder(content: Content, id: SmiteUpgradeId): SmiteUpgradeDef | undefined {
  return content.smite.upgrades.find((upgrade) => upgrade.id === id);
}

/**
 * A ladder's value at an arbitrary rung, clamped to the ladder's own length.
 *
 * Exported because the ranking in the interface needs to ask what a rung the player has
 * not bought yet would read. Rung 0 and anything below it is the base; anything above
 * the top rung is the top rung, so asking for one past the end of a maxed ladder gives
 * the honest answer that nothing would change.
 */
export function smiteValueAt(content: Content, id: SmiteUpgradeId, rung: number): number {
  const upgrade = ladder(content, id);
  if (!upgrade) return 0;
  if (rung <= 0) return upgrade.base;

  const index = Math.min(rung, upgrade.rungs.length) - 1;
  return upgrade.rungs[index]?.value ?? upgrade.base;
}

function valueNow(state: GameState, content: Content, id: SmiteUpgradeId): number {
  return smiteValueAt(content, id, state.smiteRungs[id]);
}

/** What a blow multiplies production by at zero Apathy. */
export function smiteWeight(state: GameState, content: Content): number {
  return valueNow(state, content, 'weight');
}

/** How long a blow holds. */
export function smiteDurationMs(state: GameState, content: Content): number {
  return valueNow(state, content, 'reach');
}

/** How long one whole point of Apathy takes to bleed away. */
export function smiteBleedMs(state: GameState, content: Content): number {
  return valueNow(state, content, 'forgetting');
}

/** What one point of Apathy takes off a blow. */
export function smiteStep(state: GameState, content: Content): number {
  return valueNow(state, content, 'restraint');
}
```

- [ ] **Step 6: Move every reader onto it**

`packages/engine/src/step.ts` — in `globalMultiplier`, replace the smite line:

```ts
  const fromSmite = state.smiteActiveMs > 0 ? smiteWeight(state, content) : 1;
```

and add `import { smiteWeight } from './smite.ts';`. (Task 4 replaces this with `state.smiteBlow`; it reads the ladder here so this task changes no behaviour.)

`packages/engine/src/selectors.ts` — in `smitePhase`:

```ts
  if (state.smiteActiveMs > 0) {
    // Clamped, because Reach can be bought while a blow is running and the blow keeps
    // the length it was struck at. A stored duration would be a field that matters for
    // one frame a run; a clamp is a line.
    const duration = smiteDurationMs(state, content);
    return { kind: 'active', share: Math.min(1, state.smiteActiveMs / duration) };
  }
```

and add `import { smiteDurationMs } from './smite.ts';`.

`packages/engine/src/intents.ts` — in `smite`:

```ts
  state.smiteActiveMs = smiteDurationMs(state, content);
```

and add `smiteDurationMs` to a `./smite.ts` import.

`packages/engine/src/index.ts` — add the new module's surface:

```ts
export { smiteValueAt, smiteWeight, smiteDurationMs, smiteBleedMs, smiteStep } from './smite.ts';
```

- [ ] **Step 7: Update the fixture**

Replace the `smite:` block in `packages/engine/test/fixtures/content.ts`:

```ts
  // Round numbers, chosen so a whole Minion cycle (24s) fits inside a blow — which is
  // what makes "produced exactly twice as much" a thing a test can assert at all. The
  // ladders are deliberately of unequal length, so a test that walks one off its top
  // proves the code assumes no particular number of rungs.
  smite: {
    cooldownMs: 120_000,
    apathy: { perBlow: 1, cap: 3 },
    upgrades: [
      {
        id: 'weight',
        name: 'Fixture Weight',
        base: 2,
        unit: 'multiplier',
        rungs: [
          { evil: '1000', souls: '5', value: 3 },
          { evil: '4000', souls: '10', value: 4 },
        ],
      },
      {
        id: 'reach',
        name: 'Fixture Reach',
        base: 48_000,
        unit: 'seconds',
        rungs: [{ evil: '2000', souls: '5', value: 72_000 }],
      },
      {
        id: 'forgetting',
        name: 'Fixture Forgetting',
        base: 60_000,
        unit: 'seconds',
        rungs: [{ evil: '3000', souls: '5', value: 30_000 }],
      },
      {
        id: 'restraint',
        name: 'Fixture Restraint',
        base: 0.5,
        unit: 'amount',
        rungs: [{ evil: '5000', souls: '5', value: 0.25 }],
      },
    ],
  },
```

- [ ] **Step 8: Update the engine smite tests**

In `packages/engine/test/smite.test.ts`, replace the destructure at the top:

```ts
import { smiteDurationMs, smiteWeight } from '../src/smite.ts';

const cooldownMs = fixture.smite.cooldownMs;
```

and replace every use of the old `durationMs` and `multiplier` locals with `smiteDurationMs(state, fixture)` and `smiteWeight(state, fixture)` inside each test, building the state first. For example:

```ts
  it('starts the buff', () => {
    const state = running();
    smite(state);

    expect(state.smiteActiveMs).toBe(smiteDurationMs(state, fixture));
  });
```

Delete the test named `'pays nothing at once — a blow is the buff and nothing else'` only if it fails; it should still pass, because nothing here adds an instant payment.

- [ ] **Step 9: Update the two web call sites**

`apps/web/src/ui/stage/EvilNode.tsx` — the node needs the state to resolve the ladders. Replace the `content` prop's doc and add `state`:

```ts
  /** Read only for the smite ladders, so the node can say what a blow is worth. */
  content: Content;
  /** Read-only here, as everywhere outside the engine. */
  state: GameState;
```

Add `import type { GameState } from '@dm/engine';` and `import { smiteDurationMs, smiteWeight } from '@dm/engine';`, thread `state` through the destructure, and rewrite `worth`:

```ts
function worth(copy: SmiteCopy, state: GameState, content: Content): string {
  return copy.worth({
    multiplier: `×${smiteWeight(state, content)}`,
    seconds: `${Math.round(smiteDurationMs(state, content) / 1000)}s`,
  });
}
```

with the call site becoming `title={ready ? worth(copy, state, content) : copy.hint}`.

`apps/web/src/ui/stage/ChainStage.tsx` — pass it, in the `<EvilNode>` block:

```tsx
        content={content}
        state={state}
```

`apps/web/src/ui/crown/Crown.test.tsx:46` — replace `CURRENT.smite.durationMs` with a resolved value:

```ts
    step(state, CURRENT, smiteDurationMs(state, CURRENT));
```

adding `smiteDurationMs` to that file's `@dm/engine` import.

- [ ] **Step 10: Run the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS. Every existing smite test still passes, because rung 0 holds what the flat values held.

- [ ] **Step 11: Commit**

```bash
git add packages apps/web/src
git commit -m "Turn the flat smite values into four ladders"
```

---

## Task 4: Apathy

**Spec:** §2.1, §2.2, §2.5.

**Files:**
- Modify: `packages/engine/src/smite.ts`, `src/step.ts`, `src/intents.ts`, `src/index.ts`
- Test: `packages/engine/test/smite.test.ts`

**Interfaces:**
- Consumes: `smiteWeight`, `smiteStep`, `smiteBleedMs`, `smiteDurationMs` (Task 3); `GameState.smiteApathy`, `.smiteBlow` (Task 2).
- Produces: `nextBlowMultiplier(state: GameState, content: Content): number`, exported from `@dm/engine`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/smite.test.ts`:

```ts
describe('apathy', () => {
  it('starts at nothing', () => {
    expect(createState(fixture).smiteApathy).toBe(0);
  });

  it('prices the first blow of a run at full weight', () => {
    const state = running();

    expect(nextBlowMultiplier(state, fixture)).toBe(2);
  });

  it('rises by one with a blow', () => {
    const state = running();
    smite(state);

    expect(state.smiteApathy).toBe(1);
  });

  it('prices a blow by the apathy it found, not the apathy it caused', () => {
    const state = running();
    smite(state);

    expect(state.smiteBlow).toBe(2);
  });

  it('prices the second blow lower', () => {
    const state = running();
    smite(state);
    step(state, fixture, cooldownMs);

    expect(nextBlowMultiplier(state, fixture)).toBe(1.5);
  });

  it('bleeds a whole point over the forgetting time', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture));

    expect(state.smiteApathy).toBe(0);
  });

  it('bleeds by exactly the share of the slice', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture) / 4);

    expect(state.smiteApathy).toBeCloseTo(0.75);
  });

  it('never bleeds below nothing', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture) * 10);

    expect(state.smiteApathy).toBe(0);
  });

  it('caps rather than spiralling', () => {
    const state = running();
    for (let blow = 0; blow < 20; blow += 1) {
      state.smiteCooldownMs = 0;
      smite(state);
    }

    expect(state.smiteApathy).toBe(fixture.smite.apathy.cap);
  });

  it('floors a blow at one, so a blow is never a penalty', () => {
    const state = running();
    state.smiteApathy = fixture.smite.apathy.cap;

    expect(nextBlowMultiplier(state, fixture)).toBe(1);
  });

  it('agrees on apathy whichever way the slice is cut', () => {
    const once = running();
    const twice = running();
    smite(once);
    smite(twice);
    step(once, fixture, 20_000);
    step(twice, fixture, 10_000);
    step(twice, fixture, 10_000);

    expect(once.smiteApathy).toBeCloseTo(twice.smiteApathy);
  });

  it('holds the running blow at what it was struck for', () => {
    const state = running();
    smite(state);
    state.smiteRungs.weight = 2;

    expect(globalMultiplier(state, fixture).toNumber()).toBe(2);
  });

  it('gives the blow back its worth once it runs out', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteDurationMs(state, fixture));

    expect(state.smiteBlow).toBe(1);
  });

  it('keeps the apathy through a reset, so a reset does not clear the debt', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteApathy).toBe(1);
  });

  it('clears the running blow on a reset', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteBlow).toBe(1);
  });
});
```

Add to that file's imports:

```ts
import { nextBlowMultiplier, smiteBleedMs, smiteDurationMs } from '../src/smite.ts';
```

- [ ] **Step 2: Run them and watch them fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/engine test
```

Expected: FAIL — `nextBlowMultiplier` is not exported.

- [ ] **Step 3: Add the selector**

Append to `packages/engine/src/smite.ts`:

```ts
/**
 * What the next blow would multiply production by, at the Apathy standing now.
 *
 * **Floored at 1.** A blow that made things worse would be a trap, and the floor means
 * a player who has not worked the system out can only ever waste taps rather than lose
 * ground. It also means a content edit cannot accidentally invert the verb.
 */
export function nextBlowMultiplier(state: GameState, content: Content): number {
  const raw = smiteWeight(state, content) - smiteStep(state, content) * state.smiteApathy;
  return Math.max(1, raw);
}
```

- [ ] **Step 4: Bleed it in `step`**

In `packages/engine/src/step.ts`, replace the two countdown lines at the top of `step`:

```ts
  // Spent before anything is produced, so a slice that ends the buff does not also
  // get paid at the raised rate. The countdowns are the only clock the engine has.
  state.smiteActiveMs = Math.max(0, state.smiteActiveMs - dtMs);
  state.smiteCooldownMs = Math.max(0, state.smiteCooldownMs - dtMs);

  // The blow's worth is spent with it. Reading `smiteActiveMs` alone would leave the
  // last struck multiplier lying on the state for the interface to find.
  if (state.smiteActiveMs <= 0) state.smiteBlow = 1;

  // Apathy bleeds at the same rate everywhere — online, offline and in the harness —
  // because it is spent out of `dtMs` like every other counter. That is what makes a
  // returning player always come back at zero without a single special case.
  state.smiteApathy = Math.max(0, state.smiteApathy - dtMs / smiteBleedMs(state, content));
```

and change `globalMultiplier`'s smite term to read the struck blow:

```ts
  const fromSmite = state.smiteActiveMs > 0 ? state.smiteBlow : 1;
```

Drop the now-unused `smiteWeight` import and add `smiteBleedMs`.

- [ ] **Step 5: Price the blow in the intent**

In `packages/engine/src/intents.ts`, replace the body of `smite`:

```ts
function smite(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'smite' }>,
): IntentResult {
  if (state.smiteCooldownMs > 0) return { ok: false, intent, reason: 'smite-cooling' };

  state.stats.smites += 1;

  // Read before the strike, never after. This blow is priced by the Apathy it found,
  // not by the Apathy it causes — which is what makes the first blow of a run full
  // weight and the fourth one nearly nothing.
  state.smiteBlow = nextBlowMultiplier(state, content);

  // Set, not added: striking again the moment the cooldown lifts restarts the buff
  // rather than stacking it, so two blows can never be worth more than two blows.
  state.smiteActiveMs = smiteDurationMs(state, content);
  state.smiteCooldownMs = content.smite.cooldownMs;

  state.smiteApathy = Math.min(
    content.smite.apathy.cap,
    state.smiteApathy + content.smite.apathy.perBlow,
  );

  return { ok: true, intent, detail: 'Struck' };
}
```

and in `prestige`, replace the smite lines:

```ts
  // The run is over, so the buff goes with it. The cooldown and the Apathy do not: both
  // are limits on how often a player may strike, and clearing either would hand out a
  // free blow per reset. Apathy bleeds out inside a minute anyway.
  state.smiteActiveMs = 0;
  state.smiteBlow = 1;
```

Add `nextBlowMultiplier` to the `./smite.ts` import.

- [ ] **Step 6: Export it**

In `packages/engine/src/index.ts`, add `nextBlowMultiplier` to the `./smite.ts` export.

- [ ] **Step 7: Run the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS. The §4.3 golden must still pass — it does not smite, so Apathy cannot touch it. If it fails, stop and fix that before anything else.

- [ ] **Step 8: Commit**

```bash
git add packages/engine
git commit -m "Make every blow cost the next one"
```

---

## Task 5: Climb, keep, and the measure

**Spec:** §3.3, §4.3, §4.4, §5.2, and this plan's "One correction".

**Files:**
- Modify: `packages/engine/src/types.ts`, `src/smite.ts`, `src/intents.ts`, `src/selectors.ts`, `src/index.ts`
- Create: `packages/engine/test/wrath.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–4.
- Produces:
  - Intents `{ kind: 'climb'; upgradeId: SmiteUpgradeId }` and `{ kind: 'keep'; upgradeId: SmiteUpgradeId }`
  - `IntentFailure` gains `'unknown-upgrade' | 'rung-maxed' | 'nothing-to-keep' | 'insufficient-souls'`
  - `climbCost(state, content, id): Decimal | null`
  - `keepCost(state, content, id): Decimal | null`
  - `canClimb(state, content, id): boolean`
  - `canKeep(state, content, id): boolean`
  - `smiteAverageMultiplier(state, content, bump: SmiteUpgradeId | null): number`

`'unknown-upgrade'` is not in the spec's list. It is here for symmetry with `'unknown-tier'` and `'unknown-overseer'`, which every other id-taking intent already returns.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/test/wrath.test.ts`:

```ts
import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/intents.ts';
import { prestigeGain } from '../src/selectors.ts';
import {
  canClimb,
  canKeep,
  climbCost,
  keepCost,
  smiteAverageMultiplier,
} from '../src/smite.ts';
import { createState } from '../src/state.ts';
import type { GameState } from '../src/types.ts';
import { fixture } from './fixtures/content.ts';

function rich(): GameState {
  const state = createState(fixture);
  state.resources.evil = new Decimal('1e9');
  state.souls = new Decimal(100);
  return state;
}

function climb(state: GameState, upgradeId: 'weight' | 'reach' | 'forgetting' | 'restraint') {
  return apply(state, fixture, { kind: 'climb', upgradeId });
}

function keep(state: GameState, upgradeId: 'weight' | 'reach' | 'forgetting' | 'restraint') {
  return apply(state, fixture, { kind: 'keep', upgradeId });
}

describe('climbing a ladder', () => {
  it('raises the rung', () => {
    const state = rich();
    climb(state, 'weight');

    expect(state.smiteRungs.weight).toBe(1);
  });

  it('spends the Evil', () => {
    const state = rich();
    const before = state.resources.evil;
    climb(state, 'weight');

    expect(before.sub(state.resources.evil).eq(1000)).toBe(true);
  });

  it('refuses when the Evil is short', () => {
    const state = createState(fixture);

    expect(climb(state, 'weight').ok).toBe(false);
  });

  it('says why it refused a short purse', () => {
    const state = createState(fixture);
    const result = climb(state, 'weight');

    expect(result.ok === false && result.reason).toBe('insufficient-resource');
  });

  it('refuses at the top of the ladder', () => {
    const state = rich();
    climb(state, 'reach');

    expect(climb(state, 'reach').ok).toBe(false);
  });

  it('says why it refused a maxed ladder', () => {
    const state = rich();
    climb(state, 'reach');
    const result = climb(state, 'reach');

    expect(result.ok === false && result.reason).toBe('rung-maxed');
  });

  it('prices the next rung', () => {
    const state = rich();
    climb(state, 'weight');

    expect(climbCost(state, fixture, 'weight')?.eq(4000)).toBe(true);
  });

  it('prices nothing at the top', () => {
    const state = rich();
    climb(state, 'reach');

    expect(climbCost(state, fixture, 'reach')).toBeNull();
  });

  it('answers the predicate against the purse', () => {
    expect(canClimb(createState(fixture), fixture, 'weight')).toBe(false);
  });
});

describe('keeping a rung', () => {
  it('refuses with nothing earned to keep', () => {
    const state = rich();

    expect(keep(state, 'weight').ok).toBe(false);
  });

  it('says why it refused an unearned rung', () => {
    const state = rich();
    const result = keep(state, 'weight');

    expect(result.ok === false && result.reason).toBe('nothing-to-keep');
  });

  it('raises the floor once the rung is earned', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.smiteKept.weight).toBe(1);
  });

  it('spends the souls', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.souls.eq(95)).toBe(true);
  });

  it('records the souls as spent', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');

    expect(state.soulsSpent.eq(5)).toBe(true);
  });

  it('refuses when the souls are short', () => {
    const state = rich();
    state.souls = new Decimal(0);
    climb(state, 'weight');

    expect(keep(state, 'weight').ok).toBe(false);
  });

  it('says why it refused short souls', () => {
    const state = rich();
    state.souls = new Decimal(0);
    climb(state, 'weight');
    const result = keep(state, 'weight');

    expect(result.ok === false && result.reason).toBe('insufficient-souls');
  });

  it('never overtakes what was earned with Evil', () => {
    const state = rich();
    climb(state, 'weight');
    keep(state, 'weight');
    keep(state, 'weight');

    expect(state.smiteKept.weight).toBe(1);
  });

  it('prices the next floor', () => {
    const state = rich();
    climb(state, 'weight');

    expect(keepCost(state, fixture, 'weight')?.eq(5)).toBe(true);
  });

  it('answers the predicate against what is earned', () => {
    expect(canKeep(rich(), fixture, 'weight')).toBe(false);
  });
});

describe('a reset and the ladders', () => {
  it('drops an unkept rung back to nothing', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteRungs.weight).toBe(0);
  });

  it('holds a kept rung', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    keep(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteRungs.weight).toBe(1);
  });

  it('holds the floor itself', () => {
    const state = rich();
    state.lifetimeEvil = new Decimal('1e30');
    climb(state, 'weight');
    keep(state, 'weight');
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteKept.weight).toBe(1);
  });

  it('never refunds a spent soul', () => {
    const spent = rich();
    const unspent = rich();
    spent.lifetimeEvil = new Decimal('1e30');
    unspent.lifetimeEvil = new Decimal('1e30');
    climb(spent, 'weight');
    keep(spent, 'weight');

    expect(prestigeGain(spent, fixture).eq(prestigeGain(unspent, fixture))).toBe(true);
  });
});

describe('the measure the shop ranks by', () => {
  it('reads a fresh state at the unupgraded average', () => {
    expect(smiteAverageMultiplier(createState(fixture), fixture, null)).toBeCloseTo(1.2, 5);
  });

  it('reports a gain for a rung not yet bought', () => {
    const state = createState(fixture);
    const now = smiteAverageMultiplier(state, fixture, null);

    expect(smiteAverageMultiplier(state, fixture, 'weight')).toBeGreaterThan(now);
  });

  it('reports no gain at the top of a ladder', () => {
    const state = rich();
    climb(state, 'reach');
    const now = smiteAverageMultiplier(state, fixture, null);

    expect(smiteAverageMultiplier(state, fixture, 'reach')).toBe(now);
  });
});
```

The `1.2` in the measure's first test is computed from the fixture, not guessed. Fixture: `reach` 48,000, `cooldownMs` 120,000, `cap` 3, `forgetting` 60,000, `weight` 2, `restraint` 0.5. So `uptime = 48000/120000 = 0.4`; `settled = 3 − 120000/60000 = 1`; `blow = max(1, 2 − 0.5 × 1) = 1.5`; `average = 0.4 × 1.5 + 0.6 = 1.2`.

- [ ] **Step 2: Run them and watch them fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/engine test
```

Expected: FAIL — `climbCost` is not exported and `'climb'` is not an intent kind.

- [ ] **Step 3: Widen the intent union**

In `packages/engine/src/types.ts`, add `SmiteUpgradeId` to the `@dm/content` type import, then add the two intents and the four failures:

```ts
export type Intent =
  | { kind: 'purchase'; tierId: TierId; quantity: number | 'max' }
  | { kind: 'smite' }
  | { kind: 'climb'; upgradeId: SmiteUpgradeId }
  | { kind: 'keep'; upgradeId: SmiteUpgradeId }
  | { kind: 'rouse'; tierId: TierId }
  | { kind: 'appoint'; overseerId: OverseerId }
  | { kind: 'prestige' }
  | { kind: 'record-achievements' }
  | { kind: 'record-unlocks' };
```

```ts
export type IntentFailure =
  | 'smite-cooling'
  | 'insufficient-resource'
  | 'insufficient-souls'
  | 'nothing-affordable'
  | 'no-souls-earned'
  | 'unknown-tier'
  | 'unknown-upgrade'
  | 'rung-maxed'
  | 'nothing-to-keep'
  | 'tier-not-owned'
  | 'already-running'
  | 'already-appointed'
  | 'unknown-overseer'
  | 'tier-not-met';
```

`'insufficient-souls'` is separate from `'insufficient-resource'` because souls are not in `state.resources` and the existing reason cannot honestly cover them.

- [ ] **Step 4: Add the prices, the predicates and the measure**

Append to `packages/engine/src/smite.ts`, and add `Decimal` to its imports (`import Decimal from 'break_eternity.js';`):

```ts
/** The rung a ladder would climb to next, or undefined at the top of it. */
function nextRung(state: GameState, content: Content, id: SmiteUpgradeId) {
  return ladder(content, id)?.rungs[state.smiteRungs[id]];
}

/** The rung a ladder's floor would rise to next, or undefined at the top of it. */
function nextFloor(state: GameState, content: Content, id: SmiteUpgradeId) {
  return ladder(content, id)?.rungs[state.smiteKept[id]];
}

/** Evil to climb one rung. Null at the top of the ladder. */
export function climbCost(state: GameState, content: Content, id: SmiteUpgradeId): Decimal | null {
  const rung = nextRung(state, content, id);
  return rung ? new Decimal(rung.evil) : null;
}

/** Souls to raise the floor one rung. Null at the top of the ladder. */
export function keepCost(state: GameState, content: Content, id: SmiteUpgradeId): Decimal | null {
  const rung = nextFloor(state, content, id);
  return rung ? new Decimal(rung.souls) : null;
}

export function canClimb(state: GameState, content: Content, id: SmiteUpgradeId): boolean {
  const cost = climbCost(state, content, id);
  return cost !== null && state.resources.evil.gte(cost);
}

/**
 * Whether the floor can rise.
 *
 * Souls can never advance a ladder: the rung has to have been climbed with Evil in this
 * run first. That is the whole of the "climb with Evil, keep with souls" rule, and it
 * lives here so no caller has to remember it.
 */
export function canKeep(state: GameState, content: Content, id: SmiteUpgradeId): boolean {
  if (state.smiteKept[id] >= state.smiteRungs[id]) return false;

  const cost = keepCost(state, content, id);
  return cost !== null && state.souls.gte(cost);
}

/**
 * The average production multiplier a player striking on every cooldown would hold.
 *
 * The shop ranks by the gain in this per Evil spent (spec §5.2). The cooldown's rhythm
 * is an assumption, and a stated one — a player who paces their blows instead gets a
 * different answer, and the panel does not know which they are. It is the assumption a
 * majority will match, and a defined number beats a hand-waved "best".
 *
 * Pass `bump` to ask what the figure would read with one more rung of that ladder. At
 * the top of a ladder `smiteValueAt` clamps, so a bump there reports no gain at all,
 * which is the honest answer.
 */
export function smiteAverageMultiplier(
  state: GameState,
  content: Content,
  bump: SmiteUpgradeId | null,
): number {
  const at = (id: SmiteUpgradeId): number =>
    smiteValueAt(content, id, state.smiteRungs[id] + (bump === id ? 1 : 0));

  const cooldownMs = content.smite.cooldownMs;
  const uptime = Math.min(1, at('reach') / cooldownMs);
  // Where Apathy settles for somebody striking on every cooldown: a point arrives with
  // each blow and `cooldownMs / bleedMs` of a point bleeds away between them.
  const settled = Math.max(0, content.smite.apathy.cap - cooldownMs / at('forgetting'));
  const blow = Math.max(1, at('weight') - at('restraint') * settled);

  return uptime * blow + (1 - uptime);
}
```

- [ ] **Step 5: Add the two intents**

In `packages/engine/src/intents.ts`, add the two cases to `apply`'s switch:

```ts
    case 'climb':
      return climbLadder(state, content, intent);
    case 'keep':
      return keepRung(state, content, intent);
```

and the two functions:

```ts
/**
 * Buy the next rung of one ladder with Evil.
 *
 * Named `climbLadder` rather than `climb` only because `smite.ts` already exports
 * `climbCost` and a bare `climb` beside it reads as its pair when it is not.
 */
function climbLadder(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'climb' }>,
): IntentResult {
  const upgrade = content.smite.upgrades.find((entry) => entry.id === intent.upgradeId);
  if (!upgrade) return { ok: false, intent, reason: 'unknown-upgrade' };

  const rung = state.smiteRungs[intent.upgradeId];
  const next = upgrade.rungs[rung];
  if (!next) return { ok: false, intent, reason: 'rung-maxed' };

  const cost = new Decimal(next.evil);
  const budget = state.resources.evil;
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources.evil = budget.sub(cost);
  state.smiteRungs[intent.upgradeId] = rung + 1;

  return { ok: true, intent, detail: `Climbed ${upgrade.name} to ${rung + 1}` };
}

/**
 * Spend souls to make a rung survive the next reset.
 *
 * The rung must already be climbed. Souls buy permanence and never progress, so the
 * floor can only ever follow where Evil has already been.
 *
 * The souls go onto `soulsSpent` as well as off `souls`, because `prestigeGain` is
 * `soulsEarned − souls` and without the record every Keep would refund itself on the
 * next reset.
 */
function keepRung(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'keep' }>,
): IntentResult {
  const upgrade = content.smite.upgrades.find((entry) => entry.id === intent.upgradeId);
  if (!upgrade) return { ok: false, intent, reason: 'unknown-upgrade' };

  const kept = state.smiteKept[intent.upgradeId];
  if (kept >= state.smiteRungs[intent.upgradeId]) {
    return { ok: false, intent, reason: 'nothing-to-keep' };
  }

  const next = upgrade.rungs[kept];
  if (!next) return { ok: false, intent, reason: 'rung-maxed' };

  const cost = new Decimal(next.souls);
  if (cost.gt(state.souls)) return { ok: false, intent, reason: 'insufficient-souls' };

  state.souls = state.souls.sub(cost);
  state.soulsSpent = state.soulsSpent.add(cost);
  state.smiteKept[intent.upgradeId] = kept + 1;

  return { ok: true, intent, detail: `Kept ${upgrade.name} at ${kept + 1}` };
}
```

In `prestige`, carry the two ladder records and drop the rungs to their floor. Add to the `carried` object:

```ts
    smiteKept: { ...state.smiteKept },
    soulsSpent: state.soulsSpent,
```

and after `state.overseers = fresh.overseers;`:

```ts
  // Evil-bought rungs go; soul-bought floors stay, and the run restarts standing on
  // them. `kept <= rung` holds by construction, so this is the whole of the reset.
  state.smiteKept = carried.smiteKept;
  state.smiteRungs = { ...carried.smiteKept };
  state.soulsSpent = carried.soulsSpent;
```

- [ ] **Step 6: Subtract the spend from the payout**

In `packages/engine/src/selectors.ts`, change `prestigeGain`:

```ts
/**
 * Souls this run would yield if cashed in now, above what the player already holds.
 *
 * Souls already spent count as held. `soulsEarned` reads `lifetimeEvil`, which a spend
 * does not touch, so without this term a soul spent on a Keep would come straight back
 * at the next reset and permanence would cost nothing at all.
 */
export function prestigeGain(state: GameState, content: Content): Decimal {
  return Decimal.max(0, soulsEarned(state, content).sub(state.souls).sub(state.soulsSpent));
}
```

- [ ] **Step 7: Export the new surface**

In `packages/engine/src/index.ts`, extend the `./smite.ts` export:

```ts
export {
  smiteValueAt,
  smiteWeight,
  smiteDurationMs,
  smiteBleedMs,
  smiteStep,
  nextBlowMultiplier,
  smiteAverageMultiplier,
  climbCost,
  keepCost,
  canClimb,
  canKeep,
} from './smite.ts';
```

- [ ] **Step 8: Run the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/engine
git commit -m "Climb the ladders with Evil and keep the rungs with souls"
```

---

## Task 6: The writing

**Spec:** §2.6, §6.

**Files:**
- Modify: `packages/content/src/copy.ts`
- Modify: `packages/content/src/index.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Test: `packages/content/test/copy.test.ts`

**Interfaces:**
- Consumes: `SmiteUpgradeId` (Task 1).
- Produces: `WrathCopy`, `Copy.wrath`, and four additions to `SmiteCopy` — `apathy: string`, `bands: readonly [string, string, string]`, `blow: (multiplier: string) => string`.

- [ ] **Step 1: Write the failing test**

Append to `packages/content/test/copy.test.ts`:

```ts
describe('the wrath panel copy', () => {
  it('names every ladder', () => {
    for (const id of SMITE_UPGRADE_IDS) {
      expect(v1Copy.wrath.names[id]).toBeTruthy();
    }
  });

  it('notes every ladder', () => {
    for (const id of SMITE_UPGRADE_IDS) {
      expect(v1Copy.wrath.notes[id]).toBeTruthy();
    }
  });

  it('gives every ladder a different name', () => {
    const names = SMITE_UPGRADE_IDS.map((id) => v1Copy.wrath.names[id]);

    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every ladder a different note', () => {
    const notes = SMITE_UPGRADE_IDS.map((id) => v1Copy.wrath.notes[id]);

    expect(new Set(notes).size).toBe(notes.length);
  });

  it('substitutes into the rung line', () => {
    expect(v1Copy.wrath.rung({ at: '2', of: '4' })).toContain('2');
  });

  it('substitutes into the step line', () => {
    expect(v1Copy.wrath.step({ now: '×2.00', next: '×2.25' })).toContain('×2.25');
  });

  it('substitutes into the climb price', () => {
    expect(v1Copy.wrath.climbCost('2,500')).toContain('2,500');
  });

  it('substitutes into the keep price', () => {
    expect(v1Copy.wrath.keepCost('8')).toContain('8');
  });
});

describe('the apathy copy', () => {
  it('names the gauge', () => {
    expect(v1Copy.smite.apathy).toBeTruthy();
  });

  it('carries a line for each third of the gauge', () => {
    expect(v1Copy.smite.bands).toHaveLength(3);
  });

  it('says something different in each band', () => {
    expect(new Set(v1Copy.smite.bands).size).toBe(3);
  });

  it('substitutes into the next-blow line', () => {
    expect(v1Copy.smite.blow('×1.75')).toContain('×1.75');
  });
});
```

Add `SMITE_UPGRADE_IDS` to that file's imports from `../src/ids.ts`.

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm --filter @dm/content test
```

Expected: FAIL — `wrath` does not exist on `Copy`.

- [ ] **Step 3: Add the copy types**

In `packages/content/src/copy.ts`, add `SmiteUpgradeId` to the import at the top, then add to `SmiteCopy`, after `results`:

```ts
  /**
   * What the gauge under the button is called.
   *
   * **Apathy**, and the word is the joke played straight: the realm does not fear you
   * less, it simply cannot be bothered any more. The Dark Lord's real enemy turns out
   * to be being ignored.
   */
  readonly apathy: string;
  /**
   * Where the realm stands, in thirds of the cap. Empty, middling, full.
   *
   * Three, and the length is pinned by the type, so a fourth band cannot be added
   * without the code that picks one being made to say what it means.
   */
  readonly bands: readonly [string, string, string];
  /** What the next blow is worth, printed at the gauge's end. `multiplier` is formatted. */
  readonly blow: (multiplier: string) => string;
```

and after `SmiteCopy`, the new interface:

```ts
/**
 * The shop. Four ladders, climbed with Evil and locked with souls.
 *
 * `names` and `notes` are keyed by id, so a ladder without copy fails typecheck rather
 * than shipping blank. Numbers arrive formatted — the web owns `formatNumber` and this
 * file owns the words around it.
 */
export interface WrathCopy {
  readonly title: string;
  readonly names: Readonly<Record<SmiteUpgradeId, string>>;
  /** One line saying what the ladder does, in voice. */
  readonly notes: Readonly<Record<SmiteUpgradeId, string>>;
  /** "Rung 2 of 4". Both arrive formatted. */
  readonly rung: (args: { readonly at: string; readonly of: string }) => string;
  /** What the ladder reads now and what the next rung would read. Both formatted. */
  readonly step: (args: { readonly now: string; readonly next: string }) => string;
  /** The Evil action. */
  readonly climb: string;
  readonly climbCost: (cost: string) => string;
  /** The souls action, beside it at secondary weight. */
  readonly keep: string;
  readonly keepCost: (cost: string) => string;
  /** Standing for a ladder at the top of itself. */
  readonly maxed: string;
  /** Standing for a ladder whose rung is already permanent. */
  readonly held: string;
  /** Said, never shown, on the row the panel lifted. */
  readonly lifted: string;
}
```

Add `wrath: WrathCopy;` to the `Copy` interface, after `smite`, and `WrathCopy` to the type export in `packages/content/src/index.ts`.

- [ ] **Step 4: Write the words**

In `packages/content/src/v1/copy.ts`, add to the `smite` block:

```ts
    apathy: 'Apathy',
    bands: [
      'The realm flinches.',
      'The realm has seen worse.',
      'The realm has stopped looking.',
    ],
    blow: (multiplier) => `Next ${multiplier}`,
```

and a new top-level `wrath` block:

```ts
  wrath: {
    title: 'Wrath',
    names: {
      reach: 'Reach',
      weight: 'Weight',
      forgetting: 'Forgetting',
      restraint: 'Restraint',
    },
    notes: {
      reach: 'A blow that holds longer. The realm has more time to regret it.',
      weight: 'A heavier blow. Nothing subtle, and nothing that needs to be.',
      forgetting: 'The realm forgets your last blow sooner, and fears the next one more.',
      restraint: 'Each measure of Apathy takes less off a blow. Discipline, of a sort.',
    },
    rung: ({ at, of }) => `Rung ${at} of ${of}`,
    step: ({ now, next }) => `${now} → ${next}`,
    climb: 'Climb',
    climbCost: (cost) => `${cost} Evil`,
    keep: 'Keep',
    keepCost: (cost) => `${cost} souls`,
    maxed: 'Mastered',
    held: 'Held',
    lifted: 'best available',
  },
```

- [ ] **Step 5: Run the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
pnpm check
```

Expected: PASS. `copy.test.ts` has an `every string` block that walks the whole copy object; if it reports stray whitespace or an empty string, fix the entry rather than the test.

- [ ] **Step 6: Commit**

```bash
git add packages/content
git commit -m "Name the Apathy gauge and write the Wrath panel"
```

---

## Task 7: The Apathy token and the gauge

**Spec:** §5.1.

**Files:**
- Modify: `apps/web/src/ui/tokens.css`
- Modify: `apps/web/src/ui/tokens.test.ts`
- Create: `apps/web/src/ui/stage/ApathyBar.tsx`, `apps/web/src/ui/stage/ApathyBar.css`
- Create: `apps/web/src/ui/stage/ApathyBar.test.tsx`
- Modify: `apps/web/src/ui/stage/EvilNode.tsx`

**Interfaces:**
- Consumes: `nextBlowMultiplier` (Task 4); `SmiteCopy.apathy`, `.bands`, `.blow` (Task 6); `EvilNode`'s `state` prop (Task 3).
- Produces: `ApathyBar` with props `{ apathy: number; cap: number; blow: number; copy: Pick<SmiteCopy, 'apathy' | 'bands' | 'blow'> }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/ui/stage/ApathyBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApathyBar } from './ApathyBar.tsx';

const copy = {
  apathy: 'Apathy',
  bands: ['flinches', 'seen worse', 'stopped looking'] as const,
  blow: (multiplier: string) => `Next ${multiplier}`,
};

describe('the apathy gauge', () => {
  it('shows at rest', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img', { name: /Apathy/ })).toBeInTheDocument();
  });

  it('reports an empty gauge as empty', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('0');
  });

  it('reports a full gauge as full', () => {
    render(<ApathyBar apathy={3} cap={3} blow={1} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('1');
  });

  it('names the lowest band at rest', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img', { name: /flinches/ })).toBeInTheDocument();
  });

  it('names the highest band at the cap', () => {
    render(<ApathyBar apathy={3} cap={3} blow={1} copy={copy} />);

    expect(screen.getByRole('img', { name: /stopped looking/ })).toBeInTheDocument();
  });

  it('prints what the next blow is worth', () => {
    render(<ApathyBar apathy={1} cap={3} blow={1.75} copy={copy} />);

    expect(screen.getByText('Next ×1.75')).toBeInTheDocument();
  });

  it('survives a cap of nothing without dividing by it', () => {
    render(<ApathyBar apathy={0} cap={0} blow={2} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('0');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/stage/ApathyBar.test.tsx
```

Expected: FAIL — cannot resolve `./ApathyBar.tsx`.

- [ ] **Step 3: Add the tokens**

In `apps/web/src/ui/tokens.css`, add a primitive beside the other tones:

```css
  /* Apathy. A cold grey-violet: not gold, because gold means act and the stage's one
     action is the verb this gauge works against; not ember, because ember is Evil
     itself. Measured 5.19:1 against --surface and 143° of hue from gold. */
  --raw-ash-400: #8a7f9c;
```

and, in the semantic block beside `--tone-resource`:

```css
  /* What the realm's patience is drawn in. Tone rides with the data — this gauge is
     the only thing that carries it, and nothing else may borrow it. */
  --tone-apathy: var(--raw-ash-400);
  --tone-apathy-well: var(--raw-ink-850);
```

Then add three assertions to `apps/web/src/ui/tokens.test.ts`. That file already defines `contrast(foregroundName, backgroundName)` and `hueDistance(oneName, otherName)`, both of which take token **names** and resolve them from the stylesheet — use those; do not add a helper.

Add `'--tone-apathy'` to the existing list in `it('holds every enumerated tone at AA against --surface')`, so the list reads:

```ts
    for (const name of ['--tone-positive', '--tone-danger', '--tone-resource', '--tone-apathy']) {
```

Add one test to the `contrast` describe, beside `'separates a swept meter fill from the well it runs over'`:

```ts
  it('separates the apathy fill from the well it runs over', () => {
    expect(contrast('--tone-apathy', '--tone-apathy-well')).toBeGreaterThanOrEqual(3);
  });
```

And one to the `nothing crowds the accent` describe, because this gauge works against the verb the accent belongs to and must not look like it:

```ts
  it('keeps apathy clear of gold', () => {
    expect(hueDistance('--tone-apathy', '--accent')).toBeGreaterThanOrEqual(45);
  });
```

`--tone-apathy-well` is deliberately not added to any enumerated tone list: it is a dark ground, not a tone, and every one of those lists is a hardcoded set rather than a prefix match, so it will not be swept in.

- [ ] **Step 4: Write the gauge**

Create `apps/web/src/ui/stage/ApathyBar.css`:

```css
/*
 * The realm's patience, under the verb. See ApathyBar.tsx.
 *
 * One component token: the track is a hairline drawn to a fixed height rather than a
 * laid-out region, and no step on the space scale is the right thickness for a rule
 * that has to read as a gauge and not as a border.
 */

.apathy {
  --apathy-track: 4px;

  display: flex;
  align-items: center;
  gap: var(--space-2);
  /* The same fixed width the report line below it holds, so the gauge, the report and
     the button are one column and none of them can drag the chain sideways. */
  inline-size: 11rem;
}

.apathy__track {
  flex: 1;
  block-size: var(--apathy-track);
  background: var(--tone-apathy-well);
  border-radius: var(--apathy-track);
  overflow: hidden;
}

.apathy__fill {
  block-size: 100%;
  inline-size: calc(var(--apathy-share) * 100%);
  background: var(--tone-apathy);
  transition: inline-size var(--duration-base) linear;
}

/*
 * Reduced motion is designed, not stripped: the fill jumps to its width instead of
 * easing to it. Nothing goes missing — the gauge still reads, it just stops sliding.
 */
@media (prefers-reduced-motion: reduce) {
  .apathy__fill {
    transition: none;
  }
}

/* What the next blow is worth. The one number on this column, because the verb on the
   button is width-locked and a number there would drag the chain three times a minute. */
.apathy__blow {
  flex: none;
  font-family: var(--font-numeric);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ink-dim);
}

@media (width <= 52rem) {
  .apathy {
    inline-size: 9rem;
  }
}
```

Create `apps/web/src/ui/stage/ApathyBar.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { SmiteCopy } from '@dm/content';
import './ApathyBar.css';

interface ApathyBarProps {
  /** How tired the realm is, 0 to `cap`. */
  apathy: number;
  cap: number;
  /** What the next blow would multiply by. */
  blow: number;
  copy: Pick<SmiteCopy, 'apathy' | 'bands' | 'blow'>;
}

/**
 * The realm's patience, and what is left of the next blow.
 *
 * **Always mounted and empty at rest**, so nothing moves when it fills — the same rule
 * the report line beneath it already follows. A gauge that appeared on the first blow
 * would shove the whole chain down once a session.
 *
 * It is a `meter` in spirit but an `img` in the accessibility tree, deliberately: the
 * useful thing to announce is not "1 of 3" but which of three sentences the realm is
 * currently living in, and a label carries that where a value cannot.
 *
 * The number beside it is what the *next* blow is worth. That is the actionable figure
 * and it belongs next to the thing that causes it; the verb on the button stays
 * width-locked and numberless, because a label that changes length drags the chain.
 */
export function ApathyBar({ apathy, cap, blow, copy }: ApathyBarProps): ReactNode {
  const share = cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;

  return (
    <div className="apathy">
      <div
        className="apathy__track"
        role="img"
        aria-label={`${copy.apathy}. ${band(share, copy.bands)}`}
        style={{ ['--apathy-share' as string]: share }}
      >
        <div className="apathy__fill" />
      </div>

      <span className="apathy__blow">{copy.blow(`×${blow.toFixed(2)}`)}</span>
    </div>
  );
}

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

- [ ] **Step 5: Mount it on the node**

In `apps/web/src/ui/stage/EvilNode.tsx`, add `nextBlowMultiplier` to the `@dm/engine` import and place the gauge between the button and the report:

```tsx
      <ApathyBar
        apathy={state.smiteApathy}
        cap={content.smite.apathy.cap}
        blow={nextBlowMultiplier(state, content)}
        copy={copy}
      />

      {/* Held open whether or not there is a report, so a blow never moves the chain. */}
      <p className="evil-node__report">{report}</p>
```

with `import { ApathyBar } from './ApathyBar.tsx';` at the top.

- [ ] **Step 6: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/stage/ApathyBar.test.tsx
cd ../.. && pnpm check
```

Expected: PASS. `EvilNode.test.tsx` and `ChainStage.test.tsx` may need the new copy fields in their fixtures; add them rather than loosening the types.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "Draw the realm's Apathy under the verb"
```

---

## Task 8: The plan's third category

**Spec:** §5.2.

**Files:**
- Modify: `apps/web/src/ui/rail/railPlan.ts`
- Modify: `apps/web/src/ui/rail/useRailPlan.ts`
- Modify: `apps/web/src/ui/rail/railPlan.test.ts`

**Interfaces:**
- Consumes: `smiteAverageMultiplier`, `climbCost` (Task 5).
- Produces: `RailClimb`, `RailOptionKind` gains `'climb'`, `RailBest.climb`, `HeldKeys.climb`, and `spendEmphasis`'s `key` widens to `TierId | OverseerId | SmiteUpgradeId`.

- [ ] **Step 1: Write the failing tests**

First update the two existing fixtures at the top of `apps/web/src/ui/rail/railPlan.test.ts`, or nothing in the file will typecheck:

```ts
const none: HeldKeys = { purchase: null, appoint: null, climb: null };
```

That file already has a module-level `state` reset by `beforeEach`, a `plan(quantity?, isUnlocked?, held?)` helper that closes over it, and `purchases`/`appointments` filters. Add the matching filter beside those two:

```ts
function climbs(from: RailPlan): RailClimb[] {
  return from.options.filter((option): option is RailClimb => option.kind === 'climb');
}
```

Then append, using those helpers rather than a second set:

```ts
describe('the wrath ladders on the plan', () => {
  it('offers every ladder that has a rung left', () => {
    state.resources.evil = new Decimal('1e9');

    expect(climbs(plan())).toHaveLength(4);
  });

  it('drops a ladder at the top of itself', () => {
    const reach = CURRENT.smite.upgrades.find((upgrade) => upgrade.id === 'reach');
    state.resources.evil = new Decimal('1e9');
    state.smiteRungs.reach = reach?.rungs.length ?? 0;

    expect(climbs(plan()).some((option) => option.upgradeId === 'reach')).toBe(false);
  });

  it('lifts one ladder once one is affordable', () => {
    state.resources.evil = new Decimal('1e9');

    expect(plan().best.climb).not.toBeNull();
  });

  it('lifts nothing it cannot afford', () => {
    expect(plan().best.climb).toBeNull();
  });

  it('names something to save toward instead', () => {
    expect(plan().saving.climb).not.toBeNull();
  });

  it('leaves the muster its own accent', () => {
    state.resources.evil = new Decimal('1e9');

    expect(plan().best.purchase).not.toBeNull();
  });

  it('keeps its choice against a close challenger', () => {
    state.resources.evil = new Decimal('1e9');
    const held = plan().best.climb?.upgradeId ?? null;

    expect(plan(1, all, { purchase: null, appoint: null, climb: held }).best.climb?.upgradeId).toBe(
      held,
    );
  });
});
```

Add `RailClimb` to that file's import from `./railPlan.ts`.

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/rail/railPlan.test.ts
```

Expected: FAIL — `climb` does not exist on `RailBest`.

- [ ] **Step 3: Restructure the option types**

In `apps/web/src/ui/rail/railPlan.ts`, move `tierId` off the shared shape and onto the two kinds that have one:

```ts
/** The three things a panel can offer. All are spends, so all are ranked. */
export type RailOptionKind = 'purchase' | 'appoint' | 'climb';

interface RailOptionShape {
  cost: Decimal;
  affordable: boolean;
  /**
   * What this spend returns.
   *
   * **The unit differs by kind and that is deliberate.** A purchase and an appointment
   * are measured in Evil over the horizon; a climb is measured in the average
   * production multiplier it adds. The two are never compared — each panel picks from
   * its own kind and the deck shows one panel at a time — so putting them on one axis
   * would mean inventing an exchange rate nobody could defend.
   */
  gain: Decimal;
  /** Gain per unit of cost. The ranking, within one kind. */
  score: Decimal;
}

export interface RailPurchase extends RailOptionShape {
  kind: 'purchase';
  tierId: TierId;
  /** Units this press buys. `'max'` is already resolved here. */
  count: number;
}

export interface RailAppointment extends RailOptionShape {
  kind: 'appoint';
  tierId: TierId;
  overseerId: OverseerId;
}

export interface RailClimb extends RailOptionShape {
  kind: 'climb';
  upgradeId: SmiteUpgradeId;
  /** The rung this press buys, 1-based, so the row can print "Rung 2 of 4". */
  rung: number;
}

export type RailOption = RailPurchase | RailAppointment | RailClimb;
```

Add `SmiteUpgradeId` to the `@dm/content` type import, and `climbCost`, `smiteAverageMultiplier` to the `@dm/engine` import.

Widen the two record types:

```ts
export interface RailBest {
  /** The muster's, or null when nothing there is affordable. */
  purchase: RailPurchase | null;
  /** The miscreants', or null when nothing there is affordable. */
  appoint: RailAppointment | null;
  /** The wrath panel's, or null when nothing there is affordable. */
  climb: RailClimb | null;
}

export interface HeldKeys {
  purchase: TierId | null;
  appoint: OverseerId | null;
  climb: SmiteUpgradeId | null;
}
```

- [ ] **Step 4: Rewrite `spendEmphasis`**

Replace it, because `option.tierId` no longer exists on every kind:

```ts
/** The key a panel identifies one of its own rows by. */
function keyOf(option: RailOption): TierId | OverseerId | SmiteUpgradeId {
  switch (option.kind) {
    case 'purchase':
      return option.tierId;
    case 'appoint':
      return option.overseerId;
    case 'climb':
      return option.upgradeId;
  }
}

/**
 * Whether one row of one panel is the row the plan lifted.
 *
 * Every panel asks the same question of the same plan and each answers for itself.
 * Keyed on the thing a panel can only ever lift one of — a tier for the muster, a post
 * for the miscreants, a ladder for the wrath panel.
 */
export function spendEmphasis(
  plan: RailPlan,
  kind: RailOptionKind,
  key: TierId | OverseerId | SmiteUpgradeId,
): SpendEmphasis {
  const matches = (option: RailOption | null): boolean =>
    option !== null && option.kind === kind && keyOf(option) === key;

  if (matches(plan.best[kind])) return 'best';
  if (matches(plan.saving[kind])) return 'saving';
  return 'none';
}
```

`plan.best[kind]` works because `RailBest`'s three keys are now exactly the three `RailOptionKind` values. Keeping those names in step is the point — if a fourth kind ever arrives, this line stops compiling until `RailBest` gains its field.

- [ ] **Step 5: Build and rank the climbs**

Add the builder:

```ts
interface ClimbInput {
  state: GameState;
  content: Content;
}

/**
 * The next rung of each ladder, priced by what it does to the average blow.
 *
 * Ranked by the gain in `smiteAverageMultiplier` per Evil spent (spec §5.2). That
 * measure assumes a player striking on every cooldown, which is an assumption and a
 * stated one — somebody who paces their blows would rank these differently, and the
 * panel cannot know which they are.
 *
 * A ladder at its top produces nothing at all rather than a zero-scoring row, so the
 * panel simply stops offering it.
 */
function climbOptions({ state, content }: ClimbInput): RailClimb[] {
  const options: RailClimb[] = [];
  const now = smiteAverageMultiplier(state, content, null);

  for (const upgrade of content.smite.upgrades) {
    const cost = climbCost(state, content, upgrade.id);
    if (cost === null || cost.lte(0)) continue;

    const after = smiteAverageMultiplier(state, content, upgrade.id);
    const gain = new Decimal(Math.max(0, after - now));

    options.push({
      kind: 'climb',
      upgradeId: upgrade.id,
      rung: state.smiteRungs[upgrade.id] + 1,
      cost,
      affordable: state.resources.evil.gte(cost),
      gain,
      score: gain.div(cost),
    });
  }

  return options;
}
```

and wire it into `railPlan`, after the tier loop:

```ts
  options.push(...climbOptions({ state, content }));

  const purchases = options.filter((option): option is RailPurchase => option.kind === 'purchase');
  const appointments = options.filter(
    (option): option is RailAppointment => option.kind === 'appoint',
  );
  const climbs = options.filter((option): option is RailClimb => option.kind === 'climb');

  const bestPurchase = sticky(
    purchases.filter((option) => option.affordable),
    held.purchase,
    (option) => option.tierId,
  );
  const bestAppoint = sticky(
    appointments.filter((option) => option.affordable),
    held.appoint,
    (option) => option.overseerId,
  );
  const bestClimb = sticky(
    climbs.filter((option) => option.affordable),
    held.climb,
    (option) => option.upgradeId,
  );

  return {
    options,
    best: { purchase: bestPurchase, appoint: bestAppoint, climb: bestClimb },
    saving: {
      purchase: bestPurchase ? null : pick(worthwhile(purchases)),
      appoint: bestAppoint ? null : pick(worthwhile(appointments)),
      climb: bestClimb ? null : pick(worthwhile(climbs)),
    },
  };
```

`sticky`'s generic is `<T extends RailOption, K extends string>`, which already accepts a `SmiteUpgradeId`. No change to it.

- [ ] **Step 6: Give the hook a third memory**

In `apps/web/src/ui/rail/useRailPlan.ts`:

```ts
  const held = useRef<HeldKeys>({ purchase: null, appoint: null, climb: null });
```

```ts
    held.current = {
      purchase: plan.best.purchase?.tierId ?? held.current.purchase,
      appoint: plan.best.appoint?.overseerId ?? held.current.appoint,
      climb: plan.best.climb?.upgradeId ?? held.current.climb,
    };
```

- [ ] **Step 7: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/rail/railPlan.test.ts
cd ../.. && pnpm check
```

Expected: PASS. Any test that builds a `HeldKeys` or `RailBest` literal now needs the third field.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "Rank the wrath ladders beside the other spends"
```

---

## Task 9: The Wrath panel

**Spec:** §3.1, §3.3, §5.2.

**Files:**
- Create: `apps/web/src/ui/wrath/Wrath.tsx`, `apps/web/src/ui/wrath/Wrath.css`
- Create: `apps/web/src/ui/wrath/Wrath.test.tsx`

**Interfaces:**
- Consumes: `RailPlan`, `spendEmphasis`, `RailClimb` (Task 8); `climbCost`, `keepCost`, `canKeep`, `smiteValueAt` (Tasks 3, 5); `WrathCopy` (Task 6).
- Produces: `Wrath` with props `{ content: Content; state: GameState; plan: RailPlan; onClimb: (id: SmiteUpgradeId) => void; onKeep: (id: SmiteUpgradeId) => void; copy: WrathCopy }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/ui/wrath/Wrath.test.tsx`:

```tsx
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { railPlan } from '../rail/railPlan.ts';
import { Wrath } from './Wrath.tsx';

function rich(): GameState {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal('1e9');
  state.souls = new Decimal(100);
  return state;
}

function show(state: GameState, onClimb = vi.fn(), onKeep = vi.fn()) {
  const plan = railPlan({
    state,
    content: CURRENT,
    quantity: 1,
    isUnlocked: () => true,
    held: { purchase: null, appoint: null, climb: null },
  });

  render(
    <Wrath
      content={CURRENT}
      state={state}
      plan={plan}
      onClimb={onClimb}
      onKeep={onKeep}
      copy={CURRENT_COPY.wrath}
    />,
  );

  return { onClimb, onKeep };
}

describe('the wrath panel', () => {
  it('shows a row for every ladder', () => {
    show(rich());

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('names every ladder', () => {
    show(rich());

    expect(screen.getByText(CURRENT_COPY.wrath.names.weight)).toBeInTheDocument();
  });

  it('climbs when the Evil action is pressed', async () => {
    const { onClimb } = show(rich());
    await userEvent.click(screen.getAllByRole('button', { name: /Climb/ })[0]!);

    expect(onClimb).toHaveBeenCalledTimes(1);
  });

  it('will not climb on an empty purse', () => {
    show(createState(CURRENT));

    expect(screen.getAllByRole('button', { name: /Climb/ })[0]!).toBeDisabled();
  });

  it('will not keep a rung that was never climbed', () => {
    show(rich());

    expect(screen.getAllByRole('button', { name: /Keep/ })[0]!).toBeDisabled();
  });

  it('keeps a rung once it is climbed and paid for', async () => {
    const state = rich();
    state.smiteRungs.weight = 1;
    const { onKeep } = show(state);

    const keeps = screen.getAllByRole('button', { name: /Keep/ });
    await userEvent.click(keeps.find((button) => !button.hasAttribute('disabled'))!);

    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('lifts exactly one row', () => {
    show(rich());

    expect(screen.getAllByText(CURRENT_COPY.wrath.lifted)).toHaveLength(1);
  });

  it('says a mastered ladder is mastered', () => {
    const state = rich();
    for (const upgrade of CURRENT.smite.upgrades) {
      state.smiteRungs[upgrade.id] = upgrade.rungs.length;
    }
    show(state);

    expect(screen.getAllByText(CURRENT_COPY.wrath.maxed)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/wrath/Wrath.test.tsx
```

Expected: FAIL — cannot resolve `./Wrath.tsx`.

- [ ] **Step 3: Write the stylesheet**

Create `apps/web/src/ui/wrath/Wrath.css`:

```css
/*
 * The shop. See Wrath.tsx.
 *
 * One component token: every ladder holds a name, a note, a reading and two actions, so
 * the row has a height and the panel does not discover it from whichever note wrapped.
 * Four rows, always four, which fixes the panel's height for the whole game.
 */

.wrath {
  --wrath-row: 7rem;

  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.wrath__rung {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-block-size: var(--wrath-row);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-panel);
  border: 1px solid var(--line);
  border-inline-start: 3px solid var(--line);
  border-radius: var(--space-2);
}

/*
 * The one spend to make in this panel.
 *
 * The same weight the miscreants use, and for the same reason: a row is four lines tall
 * and a gold slab that size stops being a control and starts being a banner. The edge
 * doubles and the name goes bold, so a viewer who cannot see the gold reads the state
 * from weight rather than from colour alone.
 */
.wrath__rung--best {
  background: var(--accent-well);
  border-color: var(--accent);
  border-inline-start-color: var(--accent);
  border-inline-start-width: 6px;
}

.wrath__rung--best .wrath__name {
  font-weight: 600;
}

/* Nothing is affordable, so nothing acts. A structural mark and no gold at all. */
.wrath__rung--saving {
  border-inline-start-color: var(--line-strong);
}

.wrath__body {
  display: grid;
  gap: var(--space-1);
  flex: 1;
  min-inline-size: 0;
}

.wrath__name {
  font-weight: 600;
}

.wrath__note {
  font-size: var(--text-sm);
  color: var(--ink-dim);
}

.wrath__rung--best .wrath__note {
  color: var(--ink-muted);
}

/* What the ladder reads now, and what the next rung would read. */
.wrath__step {
  font-family: var(--font-numeric);
  font-size: var(--text-xs);
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.wrath__standing {
  display: grid;
  justify-items: end;
  gap: var(--space-1);
  flex: none;
}

.wrath__at {
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.wrath__actions {
  display: flex;
  gap: var(--space-2);
  flex: none;
}

.wrath__price {
  display: block;
  font-family: var(--font-numeric);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

/* Said, never shown. The row's own weight carries the same fact by looking. */
.wrath__lifted {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * On a phone the standing and the actions come off the end and sit under the name, so
 * the row never pushes the page sideways (ui-sensibility §9).
 */
@media (width <= 52rem) {
  .wrath__rung {
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
  }

  .wrath__standing,
  .wrath__actions {
    justify-items: start;
    flex: 1 1 100%;
  }
}
```

- [ ] **Step 4: Write the panel**

Create `apps/web/src/ui/wrath/Wrath.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { Content, SmiteUnit, SmiteUpgradeDef, SmiteUpgradeId, WrathCopy } from '@dm/content';
import { canKeep, climbCost, keepCost, smiteValueAt, type GameState } from '@dm/engine';
import { formatNumber } from '../format.ts';
import { spendEmphasis, type RailPlan } from '../rail/railPlan.ts';
import '../controls.css';
import './Wrath.css';

interface WrathProps {
  content: Content;
  /** Read-only here, as everywhere outside the engine. */
  state: GameState;
  /** Ranked spends. Only the climbs are read. */
  plan: RailPlan;
  onClimb: (upgradeId: SmiteUpgradeId) => void;
  onKeep: (upgradeId: SmiteUpgradeId) => void;
  copy: WrathCopy;
}

/**
 * Four ladders, climbed with Evil and locked with souls.
 *
 * **Every ladder shows, always, at every rung.** Four rows fix the panel's height for
 * the whole game, so nothing here moves — the same argument the miscreants panel makes
 * about its wall of empty posts.
 *
 * **Climb is the row's action; Keep sits beside it at secondary weight.** One accent per
 * region, and this panel spends it on the best climb. Keep can never lift: it is a
 * second-order decision about a rung you already own, and a panel with eight equal
 * buttons is the thing the interface rules exist to prevent.
 *
 * Souls can never advance a ladder. `canKeep` refuses a rung that has not been climbed
 * with Evil in this run, so the rule lives in the engine and this panel only draws it.
 */
export function Wrath({ content, state, plan, onClimb, onKeep, copy }: WrathProps): ReactNode {
  return (
    <ul className="wrath">
      {content.smite.upgrades.map((upgrade) => (
        <Rung
          key={upgrade.id}
          upgrade={upgrade}
          state={state}
          content={content}
          emphasis={spendEmphasis(plan, 'climb', upgrade.id)}
          onClimb={() => onClimb(upgrade.id)}
          onKeep={() => onKeep(upgrade.id)}
          copy={copy}
        />
      ))}
    </ul>
  );
}

interface RungProps {
  upgrade: SmiteUpgradeDef;
  state: GameState;
  content: Content;
  emphasis: ReturnType<typeof spendEmphasis>;
  onClimb: () => void;
  onKeep: () => void;
  copy: WrathCopy;
}

function Rung({
  upgrade,
  state,
  content,
  emphasis,
  onClimb,
  onKeep,
  copy,
}: RungProps): ReactNode {
  const rung = state.smiteRungs[upgrade.id];
  const top = upgrade.rungs.length;
  const climb = climbCost(state, content, upgrade.id);
  const keep = keepCost(state, content, upgrade.id);
  const keepable = canKeep(state, content, upgrade.id);

  const now = reads(smiteValueAt(content, upgrade.id, rung), upgrade.unit);
  const next = reads(smiteValueAt(content, upgrade.id, rung + 1), upgrade.unit);

  return (
    <li className={`wrath__rung wrath__rung--${emphasis}`}>
      <span className="wrath__body">
        <span className="wrath__name">{copy.names[upgrade.id]}</span>
        <span className="wrath__note">{copy.notes[upgrade.id]}</span>
        <span className="wrath__step">
          {climb === null ? now : copy.step({ now, next })}
        </span>
      </span>

      <span className="wrath__standing">
        <span className="wrath__at">
          {climb === null ? copy.maxed : copy.rung({ at: String(rung), of: String(top) })}
        </span>
        {state.smiteKept[upgrade.id] >= rung && rung > 0 && (
          <span className="wrath__at">{copy.held}</span>
        )}
      </span>

      <span className="wrath__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={climb === null || state.resources.evil.lt(climb)}
          onClick={onClimb}
        >
          {copy.climb}
          <span className="wrath__price">
            {climb === null ? copy.maxed : copy.climbCost(formatNumber(climb))}
          </span>
        </button>

        <button
          type="button"
          className="button button--quiet"
          disabled={!keepable}
          onClick={onKeep}
        >
          {copy.keep}
          <span className="wrath__price">
            {keep === null ? copy.maxed : copy.keepCost(formatNumber(keep))}
          </span>
        </button>
      </span>

      {emphasis === 'best' && <span className="wrath__lifted">{copy.lifted}</span>}
    </li>
  );
}

/**
 * A ladder's value in its own units.
 *
 * The unit is data on the content, not a guess made here from the id. Three formats
 * because three is what the four ladders need: two of them are durations, one is a
 * multiplier and one is a bare amount subtracted from a multiplier.
 *
 * `formatNumber` is not used and should not be: it is the shared formatter for
 * `Decimal` magnitudes, and every one of these is a small display number with a unit.
 * The Evil and soul prices on this row do go through it.
 */
function reads(value: number, unit: SmiteUnit): string {
  switch (unit) {
    case 'seconds':
      return `${Math.round(value / 1000)}s`;
    case 'multiplier':
      return `×${value.toFixed(2)}`;
    case 'amount':
      return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
}
```

Check that `button--primary` and `button--quiet` exist in `apps/web/src/ui/controls.css`. If the primary modifier has a different name there, use whatever the muster's buy button uses — do not add a new one.

- [ ] **Step 5: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/wrath/Wrath.test.tsx
cd ../.. && pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "Build the Wrath panel"
```

---

## Task 10: The deck swap and the ledger's move

**Spec:** §5.3.

**Files:**
- Modify: `apps/web/src/ui/DeckGlyph.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.css`
- Modify: `apps/web/src/App.test.tsx` if one exists; otherwise `apps/web/src/ui/Deck.test.tsx`

**Interfaces:**
- Consumes: `Wrath` (Task 9); `WrathCopy` (Task 6).
- Produces: `DeckGlyphKind` becomes `'muster' | 'miscreants' | 'deeds' | 'wrath'`.

- [ ] **Step 1: Write the failing test**

There is no `apps/web/src/App.test.tsx` today — create it. Two things it must get right, both of which will otherwise produce a confusing red:

- **`App` renders `BootScreen` until `session.ready`,** which is set after the save has actually been read. Every assertion below therefore has to be `await screen.findBy…` / `await screen.findAllBy…`, not `getBy…`. A synchronous `getAllByRole('tab')` finds nothing and fails on an empty boot frame.
- **`Sheet` uses the platform `<dialog>` and calls `showModal`,** which jsdom does not implement. Copy whatever shim `apps/web/src/ui/Sheet.test.tsx` already sets up rather than inventing one.

```tsx
describe('the deck and the records', () => {
  it('shows four tabs', async () => {
    render(<App />);

    expect(await screen.findAllByRole('tab')).toHaveLength(4);
  });

  it('carries a wrath tab', async () => {
    render(<App />);

    expect(await screen.findByRole('tab', { name: CURRENT_COPY.wrath.title })).toBeInTheDocument();
  });

  it('carries no ledger tab', async () => {
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByRole('tab', { name: CURRENT_COPY.ledger.title })).toBeNull();
  });

  it('reaches the ledger from the footer', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }),
    ).toBeInTheDocument();
  });

  it('opens the ledger when the footer button is pressed', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/App.test.tsx
```

Expected: FAIL — there is no wrath tab.

- [ ] **Step 3: Swap the glyph**

In `apps/web/src/ui/DeckGlyph.tsx`, change the union and replace the `'ledger'` case. Update the doc comment's list of four marks in the same edit.

```ts
export type DeckGlyphKind = 'muster' | 'miscreants' | 'deeds' | 'wrath';
```

```tsx
    case 'wrath':
      return (
        <g fill="currentColor">
          <path d="M24 2 L28 16 L42 12 L32 23 L44 30 L29 30 L31 45 L24 34 L17 45 L19 30 L4 30 L16 23 L6 12 L20 16 Z" />
        </g>
      );
```

A burst, which is what a blow looks like and is readable by outline alone at 20px. Change the doc comment's fourth sentence to name it: the deeds are a star, the wrath is a burst — and note that the two must stay distinguishable at tab size, the star being regular and the burst being ragged.

**`shape()` still returns `ReactElement`, never `ReactNode`.** That is the exhaustiveness check: `ReactNode` includes `undefined`, so a missing case would compile and the tab would draw nothing.

- [ ] **Step 4: Rewire the app**

In `apps/web/src/App.tsx`:

Add the imports:

```ts
import { useCallback, useEffect, useState } from 'react';
import { Sheet } from './ui/Sheet.tsx';
import { Wrath } from './ui/wrath/Wrath.tsx';
```

Add the reveal state and its stable closer, beside the other hooks:

```ts
  // The ledger is a record lifted over the game, not a panel of it. `Sheet` listens on
  // the dialog's own `close` event, so the closer has to be stable or the listener is
  // torn down and rebuilt every render.
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const closeLedger = useCallback(() => setLedgerOpen(false), []);
```

Replace the fourth tab. Delete the `ledger` entry from `tabs` and put this in its place:

```ts
    {
      id: 'wrath',
      title: copy.wrath.title,
      glyph: 'wrath',
      trailing: `${climbed}/${rungs2}`,
      panel: (
        <Wrath
          content={content}
          state={state}
          plan={plan}
          copy={copy.wrath}
          onClimb={(upgradeId) => {
            const result = dispatch({ kind: 'climb', upgradeId });
            if (result.ok) sound.play('purchase');
          }}
          onKeep={(upgradeId) => {
            const result = dispatch({ kind: 'keep', upgradeId });
            if (result.ok) sound.play('unlock');
          }}
        />
      ),
    },
```

with the two counts computed beside the existing `met`/`posts`/`filled` lines. Name them so they do not collide with the existing `rungs`:

```ts
  const ladders = content.smite.upgrades.reduce((total, upgrade) => total + upgrade.rungs.length, 0);
  const climbed = content.smite.upgrades.reduce(
    (total, upgrade) => total + state.smiteRungs[upgrade.id],
    0,
  );
```

and the tab's `trailing` becomes `` `${climbed}/${ladders}` ``.

Add the footer and the sheet, between `</main>` and `<DevBar …/>`:

```tsx
        <footer className="shell__foot">
          {/* One control, so no landmark around it. The old footer wrapped two in a
              `nav` labelled "Records"; a landmark holding a single named button adds a
              stop to traverse and says nothing the button does not. */}
          <button
            type="button"
            className="button button--quiet"
            aria-haspopup="dialog"
            onClick={() => setLedgerOpen(true)}
          >
            {copy.ledger.title}
          </button>
        </footer>

        <Sheet
          open={ledgerOpen}
          label={copy.ledger.title}
          closeLabel={copy.close}
          onClose={closeLedger}
        >
          <Ledger
            state={state}
            content={content}
            copy={copy.ledger}
            errors={copy.errors}
            soundEnabled={sound.enabled}
            onToggleSound={sound.toggle}
            onExport={session.exportBlob}
            onImport={session.importBlob}
            onAbdicate={session.abdicate}
          />
        </Sheet>
```

Update `App`'s doc comment: the deck now holds muster, miscreants, deeds and wrath, and the ledger is reached from the footer because a record that takes over the screen should be opened from there rather than from a tab beside the things you spend on.

- [ ] **Step 5: Write the footer styles back**

In `apps/web/src/App.css`, after `.shell__refusal`:

```css
/*
 * The records live in the footer, not in the deck.
 *
 * The deck holds the things a player spends on, and four is what its tube fits. The
 * ledger is a record rather than a spend, it takes over the screen when it opens, and
 * the footer is where a thing that does that should be reached from.
 */
.shell__foot {
  display: flex;
  justify-content: center;
  margin-block-start: var(--space-8);
  padding-block-start: var(--space-4);
  border-block-start: 1px solid var(--line);
}

.shell__records {
  display: flex;
  gap: var(--space-2);
}
```

and inside the existing `@media (width <= 52rem)` block:

```css
  .shell__foot {
    margin-block-start: var(--space-6);
  }
```

- [ ] **Step 6: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/App.test.tsx
cd ../.. && pnpm check
```

Expected: PASS. `Ledger.test.tsx` mounts `Ledger` directly and should be untouched.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "Give Wrath the fourth deck slot and return the ledger to the footer"
```

---

## Task 11: The buy chip's padding

**Spec:** §5.4.

**Files:**
- Modify: `apps/web/src/ui/rail/QuantityChip.css`
- Test: `apps/web/src/ui/rail/QuantityChip.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Independent of every other task. `box-sizing: border-box` is global, so padding alone would squeeze the text rather than give it room — the width has to grow by exactly what the padding takes.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/ui/rail/QuantityChip.test.tsx`:

```ts
describe('the chip stylesheet', () => {
  const styles = readFileSync(new URL('./QuantityChip.css', import.meta.url), 'utf8');

  it('holds the text box at four characters', () => {
    expect(styles).toContain('calc(4ch + 2 * var(--space-2))');
  });

  it('gives the face room on both sides', () => {
    expect(styles).toContain('padding-inline: var(--space-2)');
  });
});
```

with `import { readFileSync } from 'node:fs';` at the top. Reading the stylesheet is unusual, and it is the only way to assert this: jsdom computes no layout, so `getBoundingClientRect` returns zero and a rendered assertion would pass against any value at all. Leave a one-line comment in the test saying so — this is the case the no-comments-in-tests rule exempts.

- [ ] **Step 2: Run it and watch it fail**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/rail/QuantityChip.test.tsx
```

Expected: FAIL — the stylesheet holds `inline-size: 4ch` and `padding: 0`.

- [ ] **Step 3: Give the chip its air**

In `apps/web/src/ui/rail/QuantityChip.css`, replace the width and padding declarations in `.quantity-chip`:

```css
  /* Four characters at the widest — ×100 and ×MAX — so the chip cannot change width as
     it cycles. `box-sizing` is `border-box` globally, so the width has to grow by
     exactly what the padding takes or the padding would squeeze the face instead of
     giving it room. */
  padding-inline: var(--space-2);
  padding-block: 0;
  inline-size: calc(4ch + 2 * var(--space-2));
```

- [ ] **Step 4: Run the tests and the full check**

```bash
export PATH="$HOME/Library/Application Support/Herd/config/nvm/versions/node/v22.16.0/bin:$PATH"
cd apps/web && npx vitest run src/ui/rail/QuantityChip.test.tsx
cd ../.. && pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "Give the buy chip a little room"
```

---

## Self-Review

**1. Spec coverage.**

| Spec section | Task |
| --- | --- |
| §2.1 Apathy shape | 4 |
| §2.2 seed numbers | 3 (content), 4 (apathy block) |
| §2.3 payoff curve | 5 — `smiteAverageMultiplier` reproduces the hammer column |
| §2.4 flat cooldown | 3 — `SmiteDef.cooldownMs`, and a content test pins it ≥ the shortest blow |
| §2.5 prestige, offline, harness | 4 (prestige, bleed in `step`); harness untouched by design |
| §2.6 the name | 6 |
| §3.1 four ladders | 3 |
| §3.2 the flip | 5 — the measure that shows it |
| §3.3 climb with Evil, keep with souls | 5 |
| §3.4 prices | 3 |
| §4.1 content shape | 1, 3 |
| §4.2 state | 2 |
| §4.3 intents | 5 |
| §4.4 selectors | 3, 4, 5 |
| §4.5 save | 2 |
| §5.1 Apathy readout | 7 |
| §5.2 the Wrath panel | 8, 9 |
| §5.3 deck and ledger | 10 |
| §5.4 buy chip | 11 |
| §6 copy | 6 |
| §7 testing | every task's Step 1 |

Spec §7's eleven engine tests all appear: 1–6 in Task 4, 7–9 in Task 5, 10 in Task 2, 11 in Task 3 (the clamp) — its assertion lives with the `smitePhase` change and should be added there if the reviewer finds it missing.

**2. Placeholder scan.** No TBD, no "handle edge cases", no "similar to Task N". Every code step carries the code. Three steps say "match the file's existing helpers" rather than inventing a second set — that is a real instruction, not a placeholder, and the files named all have those helpers today.

**3. Type consistency.** `SmiteUpgradeId` is used identically in every task. `smiteValueAt(content, id, rung)` takes content first because it does not read state; every other selector takes `(state, content, …)`. `RailBest`'s three keys match `RailOptionKind`'s three values exactly, which `spendEmphasis`'s `plan.best[kind]` depends on. `HeldKeys.climb` is `SmiteUpgradeId | null`, matching `RailClimb.upgradeId`.

**One gap found and closed while reviewing:** the spec never says what happens to spent souls, and `prestigeGain` would have refunded them. `soulsSpent` is added in Task 2 and wired in Task 5, with a test in Task 5 that a spent soul never comes back.
