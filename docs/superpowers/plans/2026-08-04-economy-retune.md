# Economy Retune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune the economy so cost tracks purchases rather than holdings, Overseers become a three-post roster per tier that a reset takes away, a fifth tier sits above Fortresses, and a whole run fits in an evening.

**Architecture:** Content gains an `OverseerId` vocabulary and a per-tier roster; the engine reads effective cycle and yield off that roster instead of straight off `TierDef`; `TierState` gains a `purchased` count that the cost curve keys on. Nothing about the fixed-step simulation changes. The 120-second golden must pass untouched at every commit.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `break_eternity.js`, Vitest, React 19 + Vite, pnpm workspaces.

## Global Constraints

Every one of these is already law in `CLAUDE.md` or the spec. They apply to every task below without being repeated.

- No `Date.now()`, no `Math.random()`, no I/O anywhere under `packages/engine`.
- `step` and `apply` are the only functions permitted to mutate `GameState`.
- Read from a snapshot, write into a delta, commit at slice end. Nothing produced in a slice affects anything else in that slice.
- One `step`, called from both the online and the offline path.
- Every resource and generator count is a `Decimal`. Never a JS number.
- No `any`, no default exports, no `as` casts without a comment saying why, no stringly-typed ids. `as const` for every content literal and id set.
- Object parameters once a function takes three or more arguments.
- Errors are typed classes with a static factory or a typed constructor. Never `throw new Error('...')`.
- The engine imports content **types and ids only**. `v1` and `CURRENT` are barred by lint.
- Engine tests import `packages/engine/test/fixtures/`, never shipping content.
- No comments in tests unless the test is genuinely unusual.
- No raw colour values outside `apps/web/src/ui/tokens.css`. Semantic token names only.
- Commit messages: imperative, one line, no trailers, no AI attribution.
- Run `pnpm check` before every commit.
- **The 120-second golden (`packages/engine/test/step.test.ts:20`) must pass at every commit.** If it moves, stop and fix it before anything else.

**Branch:** `economy-retune`, already created, already holding the spec commit.

**Spec:** `docs/superpowers/specs/2026-08-04-economy-retune-design.md`

---

## File Structure

**`packages/content/src/`**
| File | Change |
| --- | --- |
| `ids.ts` | `throne` joins `TIER_IDS`; new `OVERSEER_IDS`, `OverseerId`, `isOverseerId`; three throne achievement ids |
| `types.ts` | `OverseerEffect`, `OverseerDef`; `TierDef.overseers` replaces `TierDef.overseerCost` |
| `art.ts` | `tier/throne` slot; `'throne'` joins the shape union; `'tier-5'` joins the tone union |
| `copy.ts` | `OverseerCopy.names` and `.notes` re-key to `OverseerId`; `ErrorCopy.obsoleteSave` |
| `index.ts` | exports the new ids and types |
| `v1/generators.ts` | throne tier, fifteen `OverseerDef`s, the retuned numbers |
| `v1/achievements.ts` | three throne achievements |
| `v1/copy.ts` | fifteen overseer names and notes, throne copy, the obsolete-save line |

**`packages/engine/src/`**
| File | Change |
| --- | --- |
| `types.ts` | `TierState.purchased`; `GameState.overseers` becomes id arrays; `stats.runMs`; `appoint` intent takes `overseerId`; new failure reasons |
| `state.ts` | `SAVE_VERSION` 6, `MIN_SUPPORTED_SAVE_VERSION`, empty rosters, `purchased` |
| `cost.ts` | every cost function reads `purchased` |
| `roster.ts` | **new** — roster lookups and the effective-cycle/effective-yield maths |
| `step.ts` | reads effective cycle and yield; automation gate reads the roster |
| `intents.ts` | purchase raises `purchased`; `appoint` by overseer id; prestige clears the roster and `runMs` |
| `selectors.ts` | `isAppointed` via the automator; roster-aware production; `soulsEarned`, `msToNextSoul` |
| `save.ts` | roster and `purchased` in the blob; `ObsoleteSave`; the version floor |
| `index.ts` | exports the new surface |
| `scripts/harness.ts` | roster policy and roster reporting |

**`packages/engine/test/`** — `fixtures/content.ts` gains rosters; `fixtures/state.ts` appoints automators only; new tests mirror source paths.

**`apps/web/src/`**
| File | Change |
| --- | --- |
| `ui/tokens.css` + `ui/tokens.test.ts` | `--tone-tier-5`, and a mutual-separation test |
| `ui/art/TierArt.tsx` | the throne silhouette |
| `ui/rail/railPlan.ts` | one appointment option per open post |
| `ui/rail/Miscreants.tsx` + `.css` | three posts per tier, grouped |
| `ui/rail/PrestigePanel.tsx` + `.css` | run length and time to the next soul |
| `game/useGameSession.ts` | `runMs`, and a refused save surfaces instead of vanishing |
| `App.tsx` | the new appoint intent, and the refused-save banner |
| `dev/jumps.ts` | the wiped-Minion bug, and rosters |

---

## Task 1: Cost keys off purchases

**Files:**
- Modify: `packages/engine/src/types.ts:4-24` (`TierState`)
- Modify: `packages/engine/src/state.ts:16-61` (`createState`), `:64-98` (`cloneState`), `:14` (`SAVE_VERSION`)
- Modify: `packages/engine/src/cost.ts:14-18`, `:27-42`, `:72-92`, `:116-132`
- Modify: `packages/engine/src/intents.ts:33-56` (`purchase`)
- Modify: `packages/engine/src/save.ts:7-37`, `:39-74`, `:76-118`, `:129-165`
- Test: `packages/engine/test/cost.test.ts`, `packages/engine/test/save.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `TierState.purchased: Decimal`. `costOfNth(tier: TierDef, n: Decimal): Decimal` unchanged in signature but now called with `purchased`. `SAVE_VERSION = 6`. `SaveBlob['gens'][string].purchased?: string`.

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/test/cost.test.ts`:

```ts
it('does not move a tier price when the cascade raises its count', () => {
  const state = appointed(fixture);
  state.gens.minion.purchased = new Decimal(3);
  const before = nextCost(state, fixture, 'minion');

  state.gens.minion.owned = state.gens.minion.owned.add(5000);

  expect(nextCost(state, fixture, 'minion')?.toString()).toBe(before?.toString());
});

it('moves a tier price when the player buys', () => {
  const state = appointed(fixture);
  state.resources.evil = new Decimal('1e9');
  const before = nextCost(state, fixture, 'minion');

  apply(state, fixture, { kind: 'purchase', tierId: 'minion', quantity: 1 });

  expect(nextCost(state, fixture, 'minion')?.gt(before ?? 0)).toBe(true);
});

it('raises both counts on a purchase', () => {
  const state = appointed(fixture);
  state.resources.evil = new Decimal('1e9');

  apply(state, fixture, { kind: 'purchase', tierId: 'minion', quantity: 4 });

  expect(state.gens.minion.purchased.toString()).toBe('4');
});
```

Add whatever of `Decimal`, `apply`, `nextCost`, `fixture`, `appointed` the file does not already import.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/cost.test.ts`
Expected: FAIL — `purchased` is not a property of `TierState`, so typecheck rejects it.

- [ ] **Step 3: Add the field**

In `packages/engine/src/types.ts`, inside `TierState`, after `owned`:

```ts
  /**
   * Units the player has bought with their own Evil.
   *
   * The cost curve keys on this and never on `owned`. A tier that produces another
   * tier would otherwise price its own product out of the game: cost is
   * `base * rate^n`, and at 500 Minions produced the next Minion runs to about
   * 9e18 Evil. `owned` still drives production, milestones, achievements and the
   * chain display — everything the player is being rewarded for. See spec §2.
   *
   * The one free Minion `createState` grants does not count. A gift should not
   * raise your prices.
   */
  purchased: Decimal;
```

- [ ] **Step 4: Thread it through state**

In `packages/engine/src/state.ts`, set `SAVE_VERSION` to `6` and extend its comment with `6: adds purchased counts.`. In `createState`'s tier loop add `purchased: new Decimal(0),`. In `cloneState`'s tier loop add `purchased: new Decimal(g.purchased),`. Leave the free-Minion grant writing only `owned`.

- [ ] **Step 5: Point the cost curve at it**

In `packages/engine/src/cost.ts`, replace every read of `state.gens[tierId].owned` with `state.gens[tierId].purchased` — four sites: `nextCost` line 17, `bulkCost` line 35, `maxAffordable` lines 78 and 89 (the `owned` local). Rename the local in `maxAffordable` from `owned` to `purchased` so nothing reads ambiguously. `costOfNth` and `affordableCeiling` keep their parameter names; they take whatever they are handed.

Update the `costOfNth` doc comment's first line to:

```ts
/**
 * Cost of the nth unit of a tier, zero-indexed by units already **bought**.
 *
 * cost(n) = floor(baseCost * costRate^n)
 */
```

- [ ] **Step 6: Raise it on purchase**

In `packages/engine/src/intents.ts`, in `purchase`, after the line that raises `owned`:

```ts
  state.gens[tier.id].purchased = state.gens[tier.id].purchased.add(quantity);
```

- [ ] **Step 7: Carry it through the save**

In `packages/engine/src/save.ts`: add `purchased?: string;` to the `gens` record shape in `SaveBlob` with the comment `/** Added in save version 6. Optional because a version 5 blob does not carry it. */`. Write `purchased: gen.purchased.toString()` in `serialize`. Read `purchased: new Decimal(saved?.purchased ?? '0')` in `deserialize`. Add the migration:

```ts
  // 5 → 6: cost keys off purchases rather than holdings. An old blob cannot say how
  // many of each tier were bought, and guessing high would leave the player at prices
  // they never earned. Zero is the honest floor: it hands back the tiers the cascade
  // had priced out, which is the whole point of the change.
  5: (blob) => {
    const gens: SaveBlob['gens'] = {};
    for (const [id, gen] of Object.entries(blob.gens)) {
      gens[id] = { ...gen, purchased: '0' };
    }
    return { ...blob, saveVersion: 6, gens };
  },
```

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run packages/engine`
Expected: PASS, including the 120-second golden.

- [ ] **Step 9: Add the round-trip assertion**

Append to `packages/engine/test/save.test.ts`:

```ts
it('round-trips purchased counts', () => {
  const state = appointed(fixture);
  state.gens.minion.purchased = new Decimal('12345');

  const restored = deserialize(serialize(state, 0));

  expect(restored.gens.minion.purchased.toString()).toBe('12345');
});
```

- [ ] **Step 10: Run the full check and commit**

Run: `pnpm check`

```bash
git add packages/engine
git commit -m "Price a tier by what you bought, not what you hold"
```

---

## Task 2: Refuse saves below a version floor

**Files:**
- Modify: `packages/engine/src/state.ts` (add `MIN_SUPPORTED_SAVE_VERSION`)
- Modify: `packages/engine/src/save.ts:167-175` (`migrate`), `:203-215` (errors)
- Modify: `packages/engine/src/index.ts`
- Modify: `packages/content/src/copy.ts:275-286` (`ErrorCopy`), `packages/content/src/v1/copy.ts`
- Modify: `apps/web/src/game/useGameSession.ts:44-69`, `:123-147`
- Modify: `apps/web/src/App.tsx`
- Test: `packages/engine/test/save.test.ts`, `apps/web/src/game/useGameSession.test.ts`

**Interfaces:**
- Consumes: `SAVE_VERSION = 6` from Task 1.
- Produces: `MIN_SUPPORTED_SAVE_VERSION: number` from `state.ts`. `class ObsoleteSave extends Error` with `readonly fromVersion: number`. `Session.saveRefused: boolean` and `Session.dismissRefusal: () => void`.

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/test/save.test.ts`:

```ts
it('refuses a save below the supported floor', () => {
  const state = appointed(fixture);
  const blob = { ...serialize(state, 0), saveVersion: MIN_SUPPORTED_SAVE_VERSION - 1 };

  expect(() => deserialize(blob)).toThrow(ObsoleteSave);
});

it('loads a save at the supported floor', () => {
  const state = appointed(fixture);
  const blob = { ...serialize(state, 0), saveVersion: MIN_SUPPORTED_SAVE_VERSION };

  expect(deserialize(blob).saveVersion).toBe(SAVE_VERSION);
});

it('names the version it refused', () => {
  const state = appointed(fixture);
  const blob = { ...serialize(state, 0), saveVersion: 2 };

  expect(() => deserialize(blob)).toThrow(/version 2/);
});
```

Import `MIN_SUPPORTED_SAVE_VERSION`, `SAVE_VERSION` and `ObsoleteSave`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/save.test.ts`
Expected: FAIL — `MIN_SUPPORTED_SAVE_VERSION` and `ObsoleteSave` are not exported.

- [ ] **Step 3: Add the floor**

In `packages/engine/src/state.ts`, below `SAVE_VERSION`:

```ts
/**
 * The oldest save this build will load.
 *
 * A standing policy, not a one-off. Version 6 retuned the whole economy, added a
 * fifth tier and replaced one Overseer per tier with a roster of three; nothing in a
 * version 5 blob has an honest value to migrate to. Rather than invent one, the game
 * says so plainly and starts over.
 *
 * This qualifies spec §4.7's "a save two versions old must load". That rule was
 * written for a shipped game. The migration chain below the floor is still the thing
 * under test, and the floor moves only when a change genuinely cannot be migrated —
 * which is a decision somebody writes down, not a default.
 */
export const MIN_SUPPORTED_SAVE_VERSION = 6;
```

- [ ] **Step 4: Enforce it**

In `packages/engine/src/save.ts`, import `MIN_SUPPORTED_SAVE_VERSION` and make `migrate` check first:

```ts
export function migrate(blob: SaveBlob): SaveBlob {
  if (blob.saveVersion < MIN_SUPPORTED_SAVE_VERSION) throw new ObsoleteSave(blob.saveVersion);

  let current = blob;
  while (current.saveVersion < SAVE_VERSION) {
    const next = MIGRATIONS[current.saveVersion];
    if (!next) throw new UnmigratableSave(current.saveVersion);
    current = next(current);
  }
  return current;
}
```

Add the error class beside the others:

```ts
export class ObsoleteSave extends Error {
  constructor(readonly fromVersion: number) {
    super(`Save version ${fromVersion} is below the supported floor of ${MIN_SUPPORTED_SAVE_VERSION}`);
    this.name = 'ObsoleteSave';
  }
}
```

Export `ObsoleteSave` and `MIN_SUPPORTED_SAVE_VERSION` from `packages/engine/src/index.ts`.

- [ ] **Step 5: Empty the migration table**

The floor and `SAVE_VERSION` are both 6, so every entry in `MIGRATIONS` — including the `5:` one Task 1 added — is now unreachable. Empty the table and say why:

```ts
/**
 * One function per version step, applied in a chain.
 *
 * Empty, because `MIN_SUPPORTED_SAVE_VERSION` currently equals `SAVE_VERSION`: every
 * save this build accepts is already current. The machinery stays because version 7
 * will want it, and because the chain — not any single hop — is the thing under test.
 *
 * **Never edit an entry once it has shipped.** A migration that has run against saves
 * in the wild cannot be corrected in place; there is no way to tell which saves
 * already passed through the old version. Correcting a mistake means appending
 * another step.
 */
const MIGRATIONS: Record<number, (blob: SaveBlob) => SaveBlob> = {};
```

Delete the migration tests that exercised versions 1 through 4 — those blobs are refused now, and a test asserting they load is asserting the opposite of the policy. Keep the round-trip tests, which do not go near `migrate`. Add one in their place:

```ts
it('passes a current save through untouched', () => {
  const blob = serialize(appointed(fixture), 0);

  expect(migrate(blob)).toEqual(blob);
});
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run packages/engine/test/save.test.ts`
Expected: PASS.

- [ ] **Step 7: Say so in the interface**

Add to `ErrorCopy` in `packages/content/src/copy.ts`, after `unmigratableSave`:

```ts
  /** Shown when a save predates the supported floor and cannot be brought forward. */
  readonly obsoleteSave: string;
```

And in `packages/content/src/v1/copy.ts`, in the `errors` block:

```ts
    obsoleteSave: 'This save is from an early development build and no longer loads. Starting fresh.',
```

- [ ] **Step 8: Surface it in the session**

In `apps/web/src/game/useGameSession.ts`, add to the `Session` interface:

```ts
  /** True when the save on disk was refused for being too old. Cleared on dismissal. */
  saveRefused: boolean;
  dismissRefusal: () => void;
```

Add `const [saveRefused, setSaveRefused] = useState(false);` beside the other state, replace the swallowing `catch` with:

```ts
        } catch (error) {
          // A refused save is the one failure worth telling the player about: it is
          // ours, it is permanent, and starting fresh in silence looks like data loss.
          // Anything else is unreadable data nobody can be helped with here, and the
          // old blob stays on disk until the first autosave overwrites it.
          if (error instanceof ObsoleteSave) setSaveRefused(true);
        }
```

Import `ObsoleteSave` from `@dm/engine`. Add `const dismissRefusal = useCallback((): void => setSaveRefused(false), []);` and return both from the hook.

- [ ] **Step 9: Show it**

In `apps/web/src/App.tsx`, inside `shell__frame` and above `<Crown …>`:

```tsx
        {session.saveRefused && (
          <p className="shell__refusal" role="status">
            {copy.errors.obsoleteSave}
            <button type="button" className="button" onClick={session.dismissRefusal}>
              {copy.prestige.cancel}
            </button>
          </p>
        )}
```

Add to `apps/web/src/App.css`, using semantic tokens only:

```css
.shell__refusal {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line-strong);
  background: var(--surface-panel);
  color: var(--ink-muted);
  font-size: var(--text-sm);
}
```

`tokens.css` declares no radius scale — components set their own corner in pixels, and only colour is policed. Match whatever `Panel.css` uses, or leave the corner square.

- [ ] **Step 10: Test the session branch**

Append to `apps/web/src/game/useGameSession.test.ts`, following the mocking pattern the file already uses for `readSave`:

```ts
it('reports a refused save rather than starting fresh in silence', async () => {
  vi.mocked(readSave).mockResolvedValue({ ...validBlob, saveVersion: 1 });

  const { result } = renderHook(() => useGameSession(fixture));
  await waitFor(() => expect(result.current.ready).toBe(true));

  expect(result.current.saveRefused).toBe(true);
});
```

Build `validBlob` with `serialize(createState(fixture), 0)` if the file has no such helper already.

- [ ] **Step 11: Run the full check and commit**

Run: `pnpm check`

```bash
git add packages/engine packages/content apps/web
git commit -m "Refuse saves below a version floor and say so"
```

---

## Task 3: Thrones, the fifth tier

**Files:**
- Modify: `packages/content/src/ids.ts:1`, `:18-44`
- Modify: `packages/content/src/art.ts:16-18`, `:24-50`
- Modify: `packages/content/src/v1/generators.ts:99-152`
- Modify: `packages/content/src/v1/achievements.ts`
- Modify: `packages/content/src/v1/copy.ts`
- Modify: `apps/web/src/ui/tokens.css:42-49`, `:106-111`
- Modify: `apps/web/src/ui/tokens.test.ts:167-204`
- Modify: `apps/web/src/ui/art/TierArt.tsx:79-160`
- Test: `packages/content/test/generators.test.ts`, `apps/web/src/ui/tokens.test.ts`, `apps/web/src/ui/art/TierArt.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `'throne'` in `TIER_IDS` and `TierId`. Achievement ids `'throne-1' | 'throne-25' | 'throne-200'`. Art slot key `'tier/throne'`. Shape `'throne'`. Tone `'tier-5'`. CSS token `--tone-tier-5`.

- [ ] **Step 1: Write the failing test**

Append to `packages/content/test/generators.test.ts`:

```ts
it('runs the chain from Thrones down to Evil', () => {
  const order = v1.tiers.map((tier) => tier.id);

  expect(order).toEqual(['throne', 'fortress', 'legion', 'warren', 'minion']);
});

it('has Thrones produce Fortresses', () => {
  expect(v1.tiers.find((tier) => tier.id === 'throne')?.produces).toBe('fortress');
});
```

Append to `apps/web/src/ui/tokens.test.ts`, inside the `nothing crowds the accent` describe:

```ts
it('keeps every chain tone clear of every other chain tone', () => {
  const tones = ['--tone-tier-1', '--tone-tier-2', '--tone-tier-3', '--tone-tier-4', '--tone-tier-5'];

  for (const one of tones) {
    for (const other of tones) {
      if (one === other) continue;
      expect(hueDistance(one, other)).toBeGreaterThanOrEqual(30);
    }
  }
});
```

And add `'--tone-tier-5'` to the two existing arrays at `:174` and `:194`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/content apps/web/src/ui/tokens.test.ts`
Expected: FAIL — `'throne'` is not a `TierId`; `--tone-tier-5` is not declared.

- [ ] **Step 3: Add the id**

`packages/content/src/ids.ts` line 1 becomes:

```ts
export const TIER_IDS = ['minion', 'warren', 'legion', 'fortress', 'throne'] as const;
```

Add `'throne-1'`, `'throne-25'`, `'throne-200'` to `ACHIEVEMENT_IDS`, after the fortress entries.

- [ ] **Step 4: Add the tone**

In `apps/web/src/ui/tokens.css`, in the chain primitives block:

```css
  --raw-tyrian-400: #b25aa8;
```

and in the semantic block, after `--tone-tier-4`:

```css
  --tone-tier-5: var(--raw-tyrian-400);
```

Extend the chain comment at line 42 to say the top rung is Tyrian, the colour a throne is actually dyed. Measured: hue 307°, which is 98° from gold and 31° from both of its neighbours, and it reads 4.5:1 against `--surface`.

- [ ] **Step 5: Add the art slot**

In `packages/content/src/art.ts`, add `'throne'` to the `shape` union and `'tier-5'` to the `tone` union, then add the slot above `tier/fortress`:

```ts
  'tier/throne': {
    src: null,
    fallback: { shape: 'throne', tone: 'tier-5' },
    alt: 'A high black throne under a broken arch',
  },
```

- [ ] **Step 6: Draw the silhouette**

In `apps/web/src/ui/art/TierArt.tsx`, add a case to `shape`. It must be tellable from `spire` by outline alone: the fortress is a symmetrical cluster of towers filling the frame; the throne is one narrow seated shape, wide at the base, with a tall back and a broken arch over it.

```tsx
    case 'throne':
      return (
        <g fill="currentColor">
          <path d="M6 12 A18 18 0 0 1 42 12 L38 12 A14 14 0 0 0 10 12 Z" opacity="0.5" />
          <rect x="4" y="8" width="4" height="6" opacity="0.5" />
          <rect x="40" y="8" width="4" height="6" opacity="0.5" />
          <path d="M17 6 L31 6 L33 30 L15 30 Z" opacity="0.74" />
          <rect x="13" y="30" width="22" height="5" />
          <path d="M11 35 L37 35 L39 46 L9 46 Z" />
          <rect x="13" y="18" width="4" height="12" opacity="0.74" />
          <rect x="31" y="18" width="4" height="12" opacity="0.74" />
          <path d="M22 12 L24 8 L26 12 L24 16 Z" className="art__void" />
          <rect x="20" y="38" width="8" height="8" className="art__void" />
        </g>
      );
```

Extend the doc comment above `shape` to name what tells the throne apart: it is the only shape with a void at its foot and an arch above it, and the only one narrower at the top than the bottom.

- [ ] **Step 7: Add the tier**

In `packages/content/src/v1/generators.ts`, add above the `fortress` entry. **These are placeholders. Task 10 replaces every number in this file.**

```ts
    {
      id: 'throne',
      name: 'Throne',
      plural: 'Thrones',
      produces: 'fortress',
      yield: '1',
      cycleMs: 90 * MINUTE,
      costResource: 'evil',
      baseCost: '2e13',
      costRate: 1.26,
      overseerCost: '8e15',
      art: 'tier/throne',
    },
```

- [ ] **Step 8: Add the achievements and the copy**

In `packages/content/src/v1/achievements.ts`, follow the `fortress-1` / `fortress-25` / `fortress-200` lines exactly, substituting `throne` and matching the naming and prose of the ones above them.

In `packages/content/src/v1/copy.ts`, add `throne` entries to `overseer.names` (`'Steward of the High Seat'`) and `overseer.notes` (`'Keeps the seat warm, the arch propped, and the succession vague.'`), plus any other `Record<TierId, …>` the compiler flags.

- [ ] **Step 9: Run the tests**

Run: `pnpm check`
Expected: PASS. Fix every `Record<TierId, …>` the compiler names — that exhaustiveness is the reason ids are literal unions.

- [ ] **Step 10: Commit**

```bash
git add packages/content apps/web
git commit -m "Set Thrones above the Fortresses"
```

---

## Task 4: The Overseer roster in content

**Files:**
- Modify: `packages/content/src/ids.ts`
- Modify: `packages/content/src/types.ts:27-34`
- Modify: `packages/content/src/index.ts`
- Modify: `packages/content/src/copy.ts:186-219`
- Modify: `packages/content/src/v1/generators.ts`
- Modify: `packages/content/src/v1/copy.ts:262-273`
- Modify: `packages/engine/test/fixtures/content.ts`
- Test: `packages/content/test/generators.test.ts`

**Interfaces:**
- Consumes: `'throne'` in `TIER_IDS` from Task 3.
- Produces:
  - `OVERSEER_IDS` — fifteen ids of the form `<tier>-hand | <tier>-goad | <tier>-glut`.
  - `type OverseerId = (typeof OVERSEER_IDS)[number]`, `isOverseerId(id: string): id is OverseerId`.
  - `type OverseerEffect = { kind: 'automate' } | { kind: 'quicken'; factor: number } | { kind: 'swell'; factor: number }`.
  - `interface OverseerDef { readonly id: OverseerId; readonly name: string; readonly cost: string; readonly effect: OverseerEffect }`.
  - `TierDef.overseers: readonly OverseerDef[]`, replacing `TierDef.overseerCost`.
  - `OverseerCopy.names` and `.notes` become `Readonly<Record<OverseerId, string>>`.

- [ ] **Step 1: Write the failing test**

Append to `packages/content/test/generators.test.ts`:

```ts
it('gives every tier three posts', () => {
  for (const tier of v1.tiers) {
    expect(tier.overseers).toHaveLength(3);
  }
});

it('leads every roster with the post that automates', () => {
  for (const tier of v1.tiers) {
    expect(tier.overseers[0]?.effect.kind).toBe('automate');
  }
});

it('keeps every quickened cycle a whole number of seconds', () => {
  for (const tier of v1.tiers) {
    const factor = tier.overseers
      .filter((post) => post.effect.kind === 'quicken')
      .reduce((total, post) => total * (post.effect.kind === 'quicken' ? post.effect.factor : 1), 1);

    expect((tier.cycleMs / factor) % 1000).toBe(0);
  }
});

it('names every post exactly once across the whole chain', () => {
  const ids = v1.tiers.flatMap((tier) => tier.overseers.map((post) => post.id));

  expect(new Set(ids).size).toBe(ids.length);
});
```

The whole-seconds test guards the harness: it runs 1s slices and a sub-second cycle would make its completions inexact (spec §5.7).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/content`
Expected: FAIL — `overseers` is not a property of `TierDef`.

- [ ] **Step 3: Add the id vocabulary**

In `packages/content/src/ids.ts`, below `TIER_IDS`:

```ts
/**
 * Every post that can ever be filled, three per tier.
 *
 * `hand` takes the tier off the player's hands and runs it for ever. `goad` halves
 * the cycle. `glut` doubles the yield. Ids are permanent — a save records them — so
 * one may be added but never renamed or reused.
 */
export const OVERSEER_IDS = [
  'minion-hand',
  'minion-goad',
  'minion-glut',
  'warren-hand',
  'warren-goad',
  'warren-glut',
  'legion-hand',
  'legion-goad',
  'legion-glut',
  'fortress-hand',
  'fortress-goad',
  'fortress-glut',
  'throne-hand',
  'throne-goad',
  'throne-glut',
] as const;
export type OverseerId = (typeof OVERSEER_IDS)[number];

export function isOverseerId(id: string): id is OverseerId {
  return (OVERSEER_IDS as readonly string[]).includes(id);
}
```

Export all three from `packages/content/src/index.ts`.

- [ ] **Step 4: Add the definitions**

In `packages/content/src/types.ts`, replace the `overseerCost` field with:

```ts
  /**
   * The posts that can be filled over this tier. Content order is offer order.
   *
   * The first automates the tier; the rest raise what it produces. Three per tier,
   * and a reset takes all of them — an Overseer is power now, not convenience, so
   * losing one costs output and re-earning it is the spine of a run (spec §3).
   */
  readonly overseers: readonly OverseerDef[];
```

And above `TierDef`:

```ts
/**
 * What filling a post does to its tier.
 *
 * Declarative, for the same reason `AchievementCondition` is: a function cannot be
 * validated, cannot be authored by anyone who does not write TypeScript, and cannot
 * survive the round trip through JSON that the meta-plane will eventually make.
 * Adding a kind is a change in two places — here, and the engine's `roster.ts`,
 * which the compiler forces once the union grows.
 *
 * `factor` stays at 2 so every effective cycle remains a whole number of seconds.
 * The harness runs 1s slices and depends on it (spec §5.7); a content test pins it.
 */
export type OverseerEffect =
  | { readonly kind: 'automate' }
  | { readonly kind: 'quicken'; readonly factor: number }
  | { readonly kind: 'swell'; readonly factor: number };

export interface OverseerDef {
  readonly id: OverseerId;
  /** Display title, e.g. "Taskmaster of the Pits". The engine never reads it. */
  readonly name: string;
  /** Evil to fill the post. A string, for the reason at the top of this file. */
  readonly cost: string;
  readonly effect: OverseerEffect;
}
```

Import `OverseerId` at the top of the file.

- [ ] **Step 5: Fill the rosters**

In `packages/content/src/v1/generators.ts`, replace each tier's `overseerCost` line with an `overseers` array. **Placeholder costs — Task 10 replaces them.** The `hand` cost is the tier's old `overseerCost`; `goad` is four times that; `glut` is sixteen times. For Minions:

```ts
      overseers: [
        { id: 'minion-hand', name: 'Taskmaster of the Pits', cost: '1000', effect: { kind: 'automate' } },
        { id: 'minion-goad', name: 'Keeper of the Whip', cost: '4000', effect: { kind: 'quicken', factor: 2 } },
        { id: 'minion-glut', name: 'Reckoner of the Tally', cost: '16000', effect: { kind: 'swell', factor: 2 } },
      ],
```

Do the same for the rest, keeping the ×4 and ×16 rule against each tier's old `overseerCost` — `warren` from `800000`, `legion` from `2e9`, `fortress` from `5e12`, `throne` from `8e15`. Names come from the table in Step 6.

- [ ] **Step 6: Re-key the copy**

In `packages/content/src/copy.ts`, change `OverseerCopy.names` and `.notes` to `Readonly<Record<OverseerId, string>>` and import `OverseerId`. The four existing names move onto the `-hand` entries unchanged; the eleven new ones are below. Use the same string for `OverseerDef.name` in Step 5 as for `names` here.

| Id | Name | Note |
| --- | --- | --- |
| `minion-hand` | Taskmaster of the Pits | Walks the pits at all hours. Keeps a tally, a whistle, and no friends. |
| `minion-goad` | Keeper of the Whip | Believes deeply in punctuality. Has views on the value of a second. |
| `minion-glut` | Reckoner of the Tally | Found four more minions in a ledger nobody had read. They are working now. |
| `warren-hand` | Warden of the Warrens | Knows each door in the Warrens and which of them still shut. |
| `warren-goad` | Mistress of the Quickening | Halved the gestation and will not say how. The Warrens do not ask. |
| `warren-glut` | Broodkeeper | Two to a bunk was always going to be an underestimate. |
| `legion-hand` | Quartermaster of the Host | Moves the host, feeds it, and files the requisitions you never read. |
| `legion-goad` | Marshal of the Forced March | Has abolished the halt. Morale is described in the ledger as adequate. |
| `legion-glut` | Herald of the Levy | Every village yields twice what it says it has. He is very patient. |
| `fortress-hand` | Castellan of the Black Keep | Holds every key in the Keep and sleeps with them. The building goes on. |
| `fortress-goad` | Overseer of the Scaffold | Builds through the night by the light of the thing he is building. |
| `fortress-glut` | Master of the Quarry | Found more mountain. There was always more mountain. |
| `throne-hand` | Steward of the High Seat | Keeps the seat warm, the arch propped, and the succession vague. |
| `throne-goad` | Keeper of the Long Hour | Has adjusted the calendar. Nobody has noticed and nobody will. |
| `throne-glut` | Chancellor of Titles | Grants a dominion to anyone who asks twice. They keep asking. |

- [ ] **Step 7: Fix the fixture**

In `packages/engine/test/fixtures/content.ts`, replace each tier's `overseerCost` with a roster. Give the fixture the same shape as shipping content so nothing in the engine is exercised only by one of them:

```ts
      overseers: [
        { id: 'minion-hand', name: 'Fixture Taskmaster', cost: '400', effect: { kind: 'automate' } },
        { id: 'minion-goad', name: 'Fixture Goad', cost: '1600', effect: { kind: 'quicken', factor: 2 } },
        { id: 'minion-glut', name: 'Fixture Glut', cost: '6400', effect: { kind: 'swell', factor: 2 } },
      ],
```

and the warren equivalent with `warren-hand` at `600`, `warren-goad` at `2400`, `warren-glut` at `9600`.

- [ ] **Step 8: Run the check**

Run: `pnpm check`
Expected: content tests PASS. Engine and web still fail to typecheck — nothing yet reads `overseers`, and `overseerCost` has vanished from under `selectors.ts:112`, `railPlan.ts:213`, `Miscreants.tsx:74` and `jumps.ts:106`. That is Task 5 onward. **Commit only when `pnpm check` is green**, so leave those call sites compiling by having them read `tier.overseers[0]?.cost ?? '0'` for now, with the comment `// Roster-aware from Task 5.`

- [ ] **Step 9: Commit**

```bash
git add packages/content packages/engine apps/web
git commit -m "Give every tier a roster of three posts"
```

---

## Task 5: The roster in engine state

**Files:**
- Create: `packages/engine/src/roster.ts`
- Modify: `packages/engine/src/types.ts:49-72`, `:100-121`
- Modify: `packages/engine/src/state.ts`
- Modify: `packages/engine/src/intents.ts:99-124`
- Modify: `packages/engine/src/selectors.ts:90-123`
- Modify: `packages/engine/src/save.ts`
- Modify: `packages/engine/src/index.ts`
- Modify: `packages/engine/test/fixtures/state.ts`
- Test: `packages/engine/test/roster.test.ts` (create), `packages/engine/test/overseers.test.ts`

**Interfaces:**
- Consumes: `OverseerId`, `OverseerDef`, `TierDef.overseers` from Task 4.
- Produces, from `roster.ts`:
  - `findOverseer(content: Content, overseerId: OverseerId): { tier: TierDef; post: OverseerDef } | undefined`
  - `hasPost(state: GameState, tierId: TierId, overseerId: OverseerId): boolean`
  - `hasAutomator(state: GameState, content: Content, tierId: TierId): boolean`
  - `effectiveCycleMs(state: GameState, content: Content, tier: TierDef): number`
  - `effectiveYield(state: GameState, content: Content, tier: TierDef): Decimal`
- Also produces: `GameState.overseers: Record<TierId, readonly OverseerId[]>`; `Intent` variant `{ kind: 'appoint'; overseerId: OverseerId }`; `IntentFailure` gains `'unknown-overseer'` and `'tier-not-met'`; `overseerCost(content: Content, overseerId: OverseerId): Decimal | null`; `canAppoint(state, content, overseerId)`.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/test/roster.test.ts`:

```ts
import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/intents.ts';
import { effectiveCycleMs, effectiveYield, hasAutomator } from '../src/roster.ts';
import { createState } from '../src/state.ts';
import { fixture } from './fixtures/content.ts';

const minion = fixture.tiers.find((tier) => tier.id === 'minion');
if (!minion) throw new Error('fixture has no minion tier');

describe('an empty roster', () => {
  it('leaves the tier unautomated', () => {
    expect(hasAutomator(createState(fixture), fixture, 'minion')).toBe(false);
  });

  it('leaves the cycle alone', () => {
    expect(effectiveCycleMs(createState(fixture), fixture, minion)).toBe(minion.cycleMs);
  });

  it('leaves the yield alone', () => {
    expect(effectiveYield(createState(fixture), fixture, minion).toString()).toBe(minion.yield);
  });
});

describe('a filled roster', () => {
  it('automates the tier', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(hasAutomator(state, fixture, 'minion')).toBe(true);
  });

  it('halves the cycle', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-goad' });

    expect(effectiveCycleMs(state, fixture, minion)).toBe(minion.cycleMs / 2);
  });

  it('doubles the yield', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-glut' });

    expect(effectiveYield(state, fixture, minion).toString()).toBe('30');
  });
});

describe('appointing', () => {
  it('refuses a post already filled', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.minion = true;
    apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toHaveProperty('reason', 'already-appointed');
  });

  it('refuses a post over a tier the player has not met', () => {
    const state = createState(fixture);
    state.resources.evil = new Decimal('1e9');
    state.unlocked.warren = false;

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'warren-hand' });

    expect(result).toHaveProperty('reason', 'tier-not-met');
  });

  it('refuses a post it cannot pay for', () => {
    const state = createState(fixture);
    state.unlocked.minion = true;

    const result = apply(state, fixture, { kind: 'appoint', overseerId: 'minion-hand' });

    expect(result).toHaveProperty('reason', 'insufficient-resource');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/roster.test.ts`
Expected: FAIL — `packages/engine/src/roster.ts` does not exist.

- [ ] **Step 3: Change the state shape**

In `packages/engine/src/types.ts`, replace the `overseers` field:

```ts
  /**
   * The posts filled over each tier, in content order.
   *
   * Ids rather than flags, because a tier now has three posts and each does a
   * different thing. A tier is automated when its `automate` post is in this list —
   * `hasAutomator` is the only thing that should ever ask.
   *
   * **A reset clears every one of them.** Unlike achievements and unlock flags, an
   * appointment is power rather than a record of having seen something, so losing it
   * is what makes a run a run (spec §3.4). Written only by the `appoint` intent.
   */
  overseers: Record<TierId, readonly OverseerId[]>;
```

Import `OverseerId`. Change the `appoint` intent variant to `{ kind: 'appoint'; overseerId: OverseerId }` and add `'unknown-overseer'` and `'tier-not-met'` to `IntentFailure`.

In `state.ts`, `createState` builds `overseers[id] = []` and `cloneState` copies with `[...state.overseers[id]]`.

- [ ] **Step 4: Write the roster module**

Create `packages/engine/src/roster.ts`:

```ts
import Decimal from 'break_eternity.js';
import type { Content, OverseerDef, OverseerId, TierDef, TierId } from '@dm/content';
import type { GameState } from './types.ts';

/**
 * Who is watching what, and what that is worth.
 *
 * Every question about a tier's effective cycle or yield goes through here. `step`
 * calls both of the latter once per tier per slice — 36,000 times to catch up an
 * hour — so both walk a list of at most three and allocate nothing but the result.
 */
export function findOverseer(
  content: Content,
  overseerId: OverseerId,
): { tier: TierDef; post: OverseerDef } | undefined {
  for (const tier of content.tiers) {
    const post = tier.overseers.find((candidate) => candidate.id === overseerId);
    if (post) return { tier, post };
  }
  return undefined;
}

export function hasPost(state: GameState, tierId: TierId, overseerId: OverseerId): boolean {
  return state.overseers[tierId].includes(overseerId);
}

/** Whether this tier runs without being told. The only question `step` asks. */
export function hasAutomator(state: GameState, content: Content, tierId: TierId): boolean {
  const tier = content.tiers.find((candidate) => candidate.id === tierId);
  if (!tier) return false;

  return tier.overseers.some(
    (post) => post.effect.kind === 'automate' && hasPost(state, tierId, post.id),
  );
}

/**
 * The cycle this tier actually runs on.
 *
 * A whole number of milliseconds, and content guarantees a whole number of seconds
 * (see the content test in `packages/content/test/generators.test.ts`). `Math.round`
 * is belt and braces against a factor that does not divide evenly — a fractional
 * cycle would make completions inexact, which is the one thing `step` cannot have.
 */
export function effectiveCycleMs(state: GameState, content: Content, tier: TierDef): number {
  let factor = 1;
  for (const post of tier.overseers) {
    if (post.effect.kind !== 'quicken') continue;
    if (hasPost(state, tier.id, post.id)) factor *= post.effect.factor;
  }
  return Math.max(1, Math.round(tier.cycleMs / factor));
}

export function effectiveYield(state: GameState, content: Content, tier: TierDef): Decimal {
  let amount = new Decimal(tier.yield);
  for (const post of tier.overseers) {
    if (post.effect.kind !== 'swell') continue;
    if (hasPost(state, tier.id, post.id)) amount = amount.mul(post.effect.factor);
  }
  return amount;
}
```

- [ ] **Step 5: Rewrite `appoint`**

In `packages/engine/src/intents.ts`:

```ts
function appoint(
  state: GameState,
  content: Content,
  intent: Extract<Intent, { kind: 'appoint' }>,
): IntentResult {
  const found = findOverseer(content, intent.overseerId);
  if (!found) return { ok: false, intent, reason: 'unknown-overseer' };

  const { tier, post } = found;
  if (hasPost(state, tier.id, post.id)) return { ok: false, intent, reason: 'already-appointed' };
  if (!state.unlocked[tier.id]) return { ok: false, intent, reason: 'tier-not-met' };

  const cost = new Decimal(post.cost);
  const budget = state.resources[tier.costResource];
  if (cost.gt(budget)) return { ok: false, intent, reason: 'insufficient-resource' };

  state.resources[tier.costResource] = budget.sub(cost);
  state.overseers[tier.id] = tier.overseers
    .filter((candidate) => candidate.id === post.id || hasPost(state, tier.id, candidate.id))
    .map((candidate) => candidate.id);

  // A tier nobody automates still has a manual cycle to finish. Only the automator
  // makes `running` meaningless, so only the automator clears it.
  if (post.effect.kind === 'automate') state.gens[tier.id].running = false;

  return { ok: true, intent, detail: `Appointed the ${post.name}` };
}
```

Rebuilding the list in content order rather than pushing keeps two states that filled the same posts holding them in the same order — the same reason `record-achievements` rebuilds rather than appends.

- [ ] **Step 6: Update the selectors**

In `packages/engine/src/selectors.ts`:

```ts
/** Whether this tier has somebody automating it, and so runs without being told. */
export function isAppointed(state: GameState, content: Content, tierId: TierId): boolean {
  return hasAutomator(state, content, tierId);
}

export function isRousable(state: GameState, content: Content, tierId: TierId): boolean {
  if (hasAutomator(state, content, tierId)) return false;

  const gen = state.gens[tierId];
  return gen.owned.gt(0) && !gen.running;
}

/** What filling this post costs. Null for a post not in the content. */
export function overseerCost(content: Content, overseerId: OverseerId): Decimal | null {
  const found = findOverseer(content, overseerId);
  return found ? new Decimal(found.post.cost) : null;
}

/** Whether the player could fill this post right now. */
export function canAppoint(state: GameState, content: Content, overseerId: OverseerId): boolean {
  const found = findOverseer(content, overseerId);
  if (!found) return false;
  if (hasPost(state, found.tier.id, found.post.id)) return false;
  if (!state.unlocked[found.tier.id]) return false;

  return state.resources[found.tier.costResource].gte(new Decimal(found.post.cost));
}
```

Also point `overseenProductionPerSecond` at `hasAutomator(state, content, tier.id)` instead of `state.overseers[tier.id]`, and give both production selectors `effectiveCycleMs` and `effectiveYield` in place of `tier.cycleMs` and `tier.yield`.

- [ ] **Step 7: Carry the roster through the save**

In `packages/engine/src/save.ts`, change the blob field to `overseers?: Record<string, string[]>`, write `state.overseers[id]` as a plain array in `serialize`, and read it back filtered through `isOverseerId` in `deserialize` — unknown ids are dropped rather than trusted, exactly as `earnedAchievements` does:

```ts
  const overseers = {} as Record<TierId, readonly OverseerId[]>;
  for (const id of TIER_IDS) {
    overseers[id] = (migrated.overseers?.[id] ?? []).filter((post): post is OverseerId =>
      isOverseerId(post),
    );
  }
```

Export `findOverseer`, `hasPost`, `hasAutomator`, `effectiveCycleMs`, `effectiveYield` and `OverseerId` from `packages/engine/src/index.ts` — `railPlan.ts` and `Miscreants.tsx` need all of them in Tasks 11 and 12.

Add to `packages/engine/test/save.test.ts`:

```ts
it('round-trips a part-filled roster', () => {
  const state = appointed(fixture);
  state.overseers.minion = ['minion-hand', 'minion-glut'];

  const restored = deserialize(serialize(state, 0));

  expect(restored.overseers.minion).toEqual(['minion-hand', 'minion-glut']);
});

it('drops a post the running content no longer knows', () => {
  const state = appointed(fixture);
  const blob = serialize(state, 0);
  blob.overseers = { minion: ['minion-hand', 'not-a-post'] };

  expect(deserialize(blob).overseers.minion).toEqual(['minion-hand']);
});
```

- [ ] **Step 8: Fix the fixture helper**

`packages/engine/test/fixtures/state.ts` becomes:

```ts
import type { Content } from '@dm/content';
import { createState } from '../../src/state.ts';
import type { GameState } from '../../src/types.ts';

/**
 * A fresh state with every tier automated and nothing else filled.
 *
 * Only the `automate` post, deliberately. A quickened or swollen tier would move
 * every number in the worked example, and the example is the anchor test.
 */
export function appointed(content: Content): GameState {
  const state = createState(content);

  for (const tier of content.tiers) {
    const automator = tier.overseers.find((post) => post.effect.kind === 'automate');
    state.overseers[tier.id] = automator ? [automator.id] : [];
  }

  return state;
}
```

- [ ] **Step 9: Run the tests**

Run: `pnpm vitest run packages/engine`
Expected: PASS, including the 120-second golden. Every `isAppointed(state, tierId)` call site now needs `content` — the compiler names them all: `selectors.ts`, `railPlan.ts`, `Miscreants.tsx`, `App.tsx`, `harness.ts`. Fix them mechanically.

- [ ] **Step 10: Run the full check and commit**

Run: `pnpm check`

```bash
git add packages/engine apps/web
git commit -m "Hold Overseers as filled posts rather than a flag"
```

---

## Task 6: The roster drives production

**Files:**
- Modify: `packages/engine/src/step.ts:34-74`
- Test: `packages/engine/test/step.test.ts`

**Interfaces:**
- Consumes: `effectiveCycleMs`, `effectiveYield`, `hasAutomator` from Task 5.
- Produces: nothing new. `step` now honours the roster.

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/test/step.test.ts`:

```ts
it('pays twice as often when the tier is quickened', () => {
  const plain = appointed(fixture);
  plain.gens.minion.owned = new Decimal(5);
  step(plain, fixture, 24_000);

  const quick = appointed(fixture);
  quick.gens.minion.owned = new Decimal(5);
  quick.overseers.minion = [...quick.overseers.minion, 'minion-goad'];
  step(quick, fixture, 24_000);

  expect(quick.resources.evil.div(plain.resources.evil).toString()).toBe('2');
});

it('pays twice as much when the tier is swollen', () => {
  const plain = appointed(fixture);
  plain.gens.minion.owned = new Decimal(5);
  step(plain, fixture, 24_000);

  const fat = appointed(fixture);
  fat.gens.minion.owned = new Decimal(5);
  fat.overseers.minion = [...fat.overseers.minion, 'minion-glut'];
  step(fat, fixture, 24_000);

  expect(fat.resources.evil.div(plain.resources.evil).toString()).toBe('2');
});

it('compounds a quickened and a swollen tier', () => {
  const plain = appointed(fixture);
  plain.gens.minion.owned = new Decimal(5);
  step(plain, fixture, 24_000);

  const both = appointed(fixture);
  both.gens.minion.owned = new Decimal(5);
  both.overseers.minion = [...both.overseers.minion, 'minion-goad', 'minion-glut'];
  step(both, fixture, 24_000);

  expect(both.resources.evil.div(plain.resources.evil).toString()).toBe('4');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/step.test.ts`
Expected: FAIL — every ratio is `1`; `step` reads `tier.cycleMs` and `tier.yield` directly.

- [ ] **Step 3: Read the roster in `step`**

In `packages/engine/src/step.ts`, inside the tier loop:

```ts
    const gen = state.gens[tier.id];
    const automated = hasAutomator(state, content, tier.id);

    if (!automated && !gen.running) continue;

    const cycleMs = effectiveCycleMs(state, content, tier);

    gen.progressMs += dtMs;
    let cycles = Math.floor(gen.progressMs / cycleMs);

    if (automated) {
      if (cycles > 0) gen.progressMs -= cycles * cycleMs;
    } else if (cycles > 0) {
      cycles = 1;
      gen.progressMs = 0;
      gen.running = false;
    }

    const count = owned[tier.id];
    if (cycles <= 0 || count === undefined || count.lte(0)) continue;

    const amount = count
      .mul(effectiveYield(state, content, tier))
      .mul(cycles)
      .mul(tierMultiplier(state, content, count));
```

Import `effectiveCycleMs`, `effectiveYield` and `hasAutomator` from `./roster.ts`. Rename the `appointed` local to `automated` throughout so it does not read as the fixture helper.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/engine`
Expected: PASS, including the 120-second golden — the fixture helper fills only automators, so neither factor applies.

- [ ] **Step 5: Guard the step property**

Confirm the existing `step(step(s, dt), dt) === step(s, 2·dt)` property test still passes with a quickened tier. Add:

```ts
it('splits a slice the same way with a quickened tier', () => {
  const once = appointed(fixture);
  once.gens.minion.owned = new Decimal(5);
  once.overseers.minion = [...once.overseers.minion, 'minion-goad'];
  step(once, fixture, 24_000);

  const twice = appointed(fixture);
  twice.gens.minion.owned = new Decimal(5);
  twice.overseers.minion = [...twice.overseers.minion, 'minion-goad'];
  step(twice, fixture, 12_000);
  step(twice, fixture, 12_000);

  expect(twice.resources.evil.toString()).toBe(once.resources.evil.toString());
});
```

The fixture Minion runs a 24s cycle, so a goad makes it 12s: one 24,000ms slice pays two cycles and two 12,000ms slices pay one each. Both must total 150.

- [ ] **Step 6: Run the full check and commit**

Run: `pnpm check`

```bash
git add packages/engine
git commit -m "Let the roster set a tier's cycle and yield"
```

---

## Task 7: A reset takes the roster

**Files:**
- Modify: `packages/engine/src/types.ts` (`stats`)
- Modify: `packages/engine/src/state.ts` (`createState`, `cloneState`)
- Modify: `packages/engine/src/intents.ts:126-161` (`prestige`)
- Modify: `packages/engine/src/save.ts`
- Modify: `apps/web/src/game/useGameSession.ts:163-182`
- Test: `packages/engine/test/overseers.test.ts`

**Interfaces:**
- Consumes: the roster from Task 5.
- Produces: `GameState['stats'].runMs: number`, zeroed by `prestige`.

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/test/overseers.test.ts`:

```ts
it('clears every post on a reset', () => {
  const state = appointed(fixture);
  state.lifetimeEvil = new Decimal('1e14');

  apply(state, fixture, { kind: 'prestige' });

  expect(state.overseers.minion).toEqual([]);
});

it('keeps souls, trophies and unlock flags on a reset', () => {
  const state = appointed(fixture);
  state.lifetimeEvil = new Decimal('1e14');
  state.unlocked.warren = true;

  apply(state, fixture, { kind: 'prestige' });

  expect(state.unlocked.warren).toBe(true);
});

it('zeroes the run clock on a reset', () => {
  const state = appointed(fixture);
  state.lifetimeEvil = new Decimal('1e14');
  state.stats.runMs = 900_000;

  apply(state, fixture, { kind: 'prestige' });

  expect(state.stats.runMs).toBe(0);
});

it('leaves total play time alone on a reset', () => {
  const state = appointed(fixture);
  state.lifetimeEvil = new Decimal('1e14');
  state.stats.playTimeMs = 900_000;

  apply(state, fixture, { kind: 'prestige' });

  expect(state.stats.playTimeMs).toBe(900_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/overseers.test.ts`
Expected: FAIL — `runMs` is not a property of `stats`, and `prestige` still carries `overseers`.

- [ ] **Step 3: Add the run clock**

In `packages/engine/src/types.ts`, inside `stats`:

```ts
    /**
     * Play time since the last reset.
     *
     * Beside `playTimeMs` rather than derived from it, because a run's length is what
     * the prestige panel has to report and nothing else in the state records when the
     * run began. Advanced at the boundary alongside `playTimeMs`; zeroed by `prestige`.
     */
    runMs: number;
```

Set it to `0` in `createState`; `cloneState` already spreads `stats`. Add it to `SaveBlob['stats']` by way of `GameState['stats']`, which the blob already reuses — no save change beyond defaulting an absent value to `0` in `deserialize`:

```ts
    stats: { runMs: 0, ...migrated.stats },
```

- [ ] **Step 4: Drop the roster from prestige**

In `packages/engine/src/intents.ts`, remove `overseers: state.overseers` from `carried`, add `stats: { ...state.stats, prestiges: state.stats.prestiges + 1, runMs: 0 }`, delete the `state.overseers = carried.overseers;` line, and let `state.overseers = fresh.overseers;` take its place beside `state.gens = fresh.gens;`. Rewrite the comment:

```ts
  const carried = {
    souls: state.souls.add(gain),
    lifetimeEvil: state.lifetimeEvil,
    stats: { ...state.stats, prestiges: state.stats.prestiges + 1, runMs: 0 },
    // Spec §5.4: a reset keeps achievements and unlock flags. A player who has seen
    // the Throne row does not lose it for starting over.
    //
    // Overseers are **not** on that list any more. They were, on AdVenture Capitalist's
    // precedent, and that precedent held while an Overseer only automated — nobody
    // wants to re-buy convenience. An Overseer is power now: it quickens a cycle and
    // fattens a yield, so losing one costs output and re-earning it is what a run is
    // for. See the 2026-08-04 spec §3.4.
    earnedAchievements: state.earnedAchievements,
    unlocked: state.unlocked,
  };
```

- [ ] **Step 5: Advance the run clock**

In `apps/web/src/game/useGameSession.ts`, in the frame loop beside `state.stats.playTimeMs += …`:

```ts
        state.stats.runMs += slices * BASE_DT_MS;
```

- [ ] **Step 6: Run the tests**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/engine apps/web
git commit -m "Take the Overseers back at a reset"
```

---

## Task 8: Prestige readings

**Files:**
- Modify: `packages/engine/src/selectors.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/prestige.test.ts` (create)

**Interfaces:**
- Consumes: `overseenProductionPerSecond` and `prestigeGain`, both already exported.
- Produces:
  - `soulsEarned(state: GameState, content: Content): Decimal` — what the formula pays for the lifetime Evil on hand.
  - `msToNextSoul(state: GameState, content: Content): number | null` — milliseconds until one more soul, at the current automated rate. `null` when nothing is turning on its own, or when the answer is beyond a JS number. The `remaining <= 0` guard inside it is unreachable by construction — `soulsEarned` floors, so the target for one more soul is always above the lifetime Evil that produced it — and is kept only so a future change to the formula cannot make it divide by a negative.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/test/prestige.test.ts`:

```ts
import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { msToNextSoul, soulsEarned } from '../src/selectors.ts';
import { createState } from '../src/state.ts';
import { fixture } from './fixtures/content.ts';
import { appointed } from './fixtures/state.ts';

describe('soulsEarned', () => {
  it('pays nothing at zero lifetime Evil', () => {
    expect(soulsEarned(createState(fixture), fixture).toString()).toBe('0');
  });

  it('pays k souls at one whole scale of lifetime Evil', () => {
    const state = createState(fixture);
    state.lifetimeEvil = new Decimal(fixture.prestige.scale);

    expect(soulsEarned(state, fixture).toString()).toBe(String(fixture.prestige.k));
  });
});

describe('msToNextSoul', () => {
  it('reports nothing when nothing is running', () => {
    expect(msToNextSoul(createState(fixture), fixture)).toBeNull();
  });

  it('shortens as lifetime Evil climbs toward the next soul', () => {
    const early = appointed(fixture);
    early.gens.minion.owned = new Decimal(5);

    const late = appointed(fixture);
    late.gens.minion.owned = new Decimal(5);
    late.lifetimeEvil = new Decimal(fixture.prestige.scale).div(fixture.prestige.k ** 2).div(2);

    expect(msToNextSoul(late, fixture) ?? Infinity).toBeLessThan(msToNextSoul(early, fixture) ?? 0);
  });

  it('reports the gap divided by the rate', () => {
    const state = appointed(fixture);
    state.gens.minion.owned = new Decimal(1);
    state.lifetimeEvil = new Decimal(0);

    const rate = new Decimal(fixture.tiers[1]?.yield ?? '0').div(24);
    const target = new Decimal(fixture.prestige.scale).div(fixture.prestige.k ** 2);

    expect(msToNextSoul(state, fixture)).toBeCloseTo(target.div(rate).mul(1000).toNumber(), -3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/engine/test/prestige.test.ts`
Expected: FAIL — neither selector exists.

- [ ] **Step 3: Write the selectors**

Append to `packages/engine/src/selectors.ts`:

```ts
/** What the prestige formula pays for the lifetime Evil on hand, before subtracting held souls. */
export function soulsEarned(state: GameState, content: Content): Decimal {
  const { k, scale } = content.prestige;
  return state.lifetimeEvil.div(new Decimal(scale)).sqrt().mul(k).floor();
}

/**
 * Milliseconds to the next soul, at the rate the automated tiers are turning now.
 *
 * A straight-line estimate and honestly one: it holds every generator count still,
 * and in play the counts climb, so the real wait is always shorter. That is the
 * right way for it to be wrong — a figure that flattered the player would be worse
 * than one that undersells.
 *
 * Reads the automated rate rather than the potential one, because this answers "how
 * long if I walk away", and a tier nobody oversees produces nothing while you are
 * gone (spec §5.6). Null when nothing is turning, and null rather than `Infinity`
 * when the gap is too large for a JS number to carry.
 */
export function msToNextSoul(state: GameState, content: Content): number | null {
  const { k, scale } = content.prestige;
  const target = new Decimal(scale).mul(soulsEarned(state, content).add(1).div(k).pow(2));
  const remaining = target.sub(state.lifetimeEvil);
  if (remaining.lte(0)) return 0;

  const rate = overseenProductionPerSecond(state, content, 'evil');
  if (rate.lte(0)) return null;

  const ms = remaining.div(rate).mul(1000).toNumber();
  return Number.isFinite(ms) ? ms : null;
}
```

Refactor `prestigeGain` to call `soulsEarned` rather than repeat the formula.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/engine`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add both to `packages/engine/src/index.ts`.

Run: `pnpm check`

```bash
git add packages/engine
git commit -m "Report how long the next soul will take"
```

---

## Task 9: The harness fills the roster

**Files:**
- Modify: `packages/engine/scripts/harness.ts:22-99`, `:101-174`

**Interfaces:**
- Consumes: `canAppoint(state, content, overseerId)`, `isAppointed(state, content, tierId)`, `hasPost` from Task 5.
- Produces: nothing the app reads. The console table gains a row per post.

- [ ] **Step 1: Update the buying policy**

In `decide`, replace the appointment pass:

```ts
  // Cheapest post first, across the whole chain — so an early automator lands as soon
  // as it is within reach rather than waiting behind a Castellan. Buying still comes
  // first (see the header): a post may only ever be paid for out of the change.
  const posts = content.tiers
    .flatMap((tier) => tier.overseers)
    .sort((one, other) => (new Decimal(one.cost).gt(new Decimal(other.cost)) ? 1 : -1));

  for (const post of posts) {
    if (canAppoint(state, content, post.id)) {
      apply(state, content, { kind: 'appoint', overseerId: post.id });
    }
  }
```

Import `Decimal` as a value rather than a type at the top of the file, and import `canAppoint` and `hasPost`.

- [ ] **Step 2: Update the reporting**

Change `overseerAffordableAt` and `overseerAppointedAt` to key on `OverseerId`, walk `tier.overseers` where they walked `content.tiers`, and print the post's `name` where they printed `tier.plural`. Keep the `within reach` / `appointed` columns.

- [ ] **Step 3: Run it**

Run: `pnpm harness`
Expected: it completes and prints fifteen post rows. The tier times will be wrong — the numbers are still Task 3's and Task 4's placeholders. That is Task 10.

- [ ] **Step 4: Commit**

Run: `pnpm check`

```bash
git add packages/engine
git commit -m "Teach the harness to fill every post"
```

---

## Task 10: The balance pass

**Files:**
- Modify: `packages/content/src/v1/generators.ts` (every number, and the doc comment)
- Modify: `docs/superpowers/specs/2026-08-04-economy-retune-design.md` §5.2

**Interfaces:**
- Consumes: the harness from Task 9.
- Produces: shipping numbers. No code shape changes.

This task has no unit test, by design — the balance harness is a script and must never gate CI. Its deliverable is a recorded harness run.

**Targets, from spec §5.2. Accept ±20%.**

| | Target |
| --- | ---: |
| First Warren | ~12m |
| First Dark Legion | ~35m |
| First Fortress | ~1h 10m |
| First Throne | ~2h |
| First prestige | ~45m |
| Souls at first reset | 40–50 |
| Largest jump between adjacent checkpoints | under ~100× |

- [ ] **Step 1: Record the starting point**

Run: `pnpm harness > /tmp/harness-before.txt`
Read it. Note which targets it misses and by how much.

- [ ] **Step 2: Raise the yields**

Give every tier above Minions a yield of several rather than one — start at `'5'` for Warrens, `'4'` for Legions, `'3'` for Fortresses, `'3'` for Thrones. Leave the Minion tier's rate alone: 2.5 Evil every 4s is the opening pace and it reads well.

Run: `pnpm harness`. Everything will now be far too fast. That is expected and it is the point — the next two steps are the brake.

- [ ] **Step 3: Bring the costs and cycles back**

Raise `baseCost` and `costRate` per tier, and shorten `cycleMs`, until the first four rows of the target table land. Work top down: the Warren time first, then the Legion, then the Fortress, then the Throne. Each tier's `costRate` is the brake on that tier alone, so tune one at a time and re-run between changes.

**Every `cycleMs` must stay a whole number of seconds, and must still be one after being halved by a `goad`.** The content test from Task 4 fails otherwise.

- [ ] **Step 4: Soften the Legion cliff**

Read the checkpoint table for the largest ratio between adjacent rows. If it is above ~100×, lower the Legion's `costRate` and raise its `baseCost` to compensate — that flattens the step without moving where the tier lands.

- [ ] **Step 5: Retune the souls**

Adjust `prestige.k` and `prestige.scale` until the harness's souls column reads 40–50 at the first-prestige time. `perSoul` stays at `0.02`. The first soul lands at `scale / k²` lifetime Evil, which is the lever for *when*; `k` alone is the lever for *how many*.

- [ ] **Step 6: Price the posts**

Set each `hand` cost so it comes within reach shortly before the tier above does — the trade spec §5.6 wants the player weighing. Set `goad` and `glut` above it, in that order. Re-run and read the fifteen `within reach` times: no post should be unreachable inside the seven simulated days.

- [ ] **Step 7: Record the result**

Run: `pnpm harness > /tmp/harness-after.txt`

Rewrite the doc comment at the top of `packages/content/src/v1/generators.ts` with the new table, in the shape the existing one uses — times to each tier, first prestige, souls at 8h and 12h, and the fifteen post times. Say what moved and why, in the register the file already uses.

Update §5.2 of the spec with the same numbers, replacing the "Target" column with what the harness actually reported.

- [ ] **Step 8: Confirm nothing in the engine moved**

Run: `pnpm check`
Expected: PASS. Engine tests run on fixture content, so a balance change **cannot** fail one. If one does, the change reached somewhere it should not have and the fix is in the code, not the numbers.

- [ ] **Step 9: Commit**

```bash
git add packages/content docs
git commit -m "Retune the economy to fit an evening"
```

---

## Task 11: The rail ranks every open post

**Files:**
- Modify: `apps/web/src/ui/rail/railPlan.ts:33-70`, `:150-232`, `:296-310`
- Test: `apps/web/src/ui/rail/railPlan.test.ts`

**Interfaces:**
- Consumes: `effectiveCycleMs`, `effectiveYield`, `canAppoint`, `overseerCost`, `hasAutomator`, `hasPost` from Task 5.
- Produces: `RailAppointment` gains `overseerId: OverseerId`. `spendEmphasis(plan, kind, tierId)` becomes `spendEmphasis(plan: RailPlan, kind: RailOptionKind, key: TierId | OverseerId)`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/ui/rail/railPlan.test.ts`:

```ts
it('offers every unfilled post on a met tier', () => {
  const state = appointed(fixture);
  state.overseers.minion = [];
  state.unlocked.minion = true;

  const plan = railPlan({ state, content: fixture, quantity: 1, isUnlocked: () => true });
  const posts = plan.options.filter((option) => option.kind === 'appoint');

  expect(posts.map((post) => post.overseerId)).toEqual([
    'minion-hand',
    'minion-goad',
    'minion-glut',
  ]);
});

it('drops a post once it is filled', () => {
  const state = appointed(fixture);
  state.unlocked.minion = true;

  const plan = railPlan({ state, content: fixture, quantity: 1, isUnlocked: () => true });
  const ids = plan.options.filter((option) => option.kind === 'appoint').map((o) => o.overseerId);

  expect(ids).not.toContain('minion-hand');
});

it('values a goad on a tier that is already turning', () => {
  const state = appointed(fixture);
  state.gens.minion.owned = new Decimal(50);
  state.unlocked.minion = true;

  const plan = railPlan({ state, content: fixture, quantity: 1, isUnlocked: () => true });
  const goad = plan.options.find(
    (option) => option.kind === 'appoint' && option.overseerId === 'minion-goad',
  );

  expect(goad?.gain.gt(0)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/ui/rail/railPlan.test.ts`
Expected: FAIL — `overseerId` is not a property of `RailAppointment`.

- [ ] **Step 3: Widen the option type**

```ts
export interface RailAppointment extends RailOptionShape {
  kind: 'appoint';
  overseerId: OverseerId;
}
```

`RailOptionShape.tierId` stays: the appointment still belongs to a tier, and `Miscreants` groups by it.

- [ ] **Step 4: Rewrite the appointment option**

```ts
/**
 * Filling one post, priced by what the tier produces before and after.
 *
 * One measure for all three kinds. The automator is worth the tier's *whole* output,
 * because an unappointed tier stops dead after every cycle (spec §5.6); a goad or a
 * glut is worth the difference its factor makes to a tier that is running. That puts
 * the three on one axis, which is what lets §3's single accent land on the right one.
 *
 * A goad or a glut over a tier nobody automates is scored as though the tier ran
 * anyway. It is the same blind spot the header already owns for the automator: the
 * measure assumes an idle tier stays idle, which is what happens while the tab is
 * shut, and a player tapping perfectly loses nothing either way.
 */
function appointOptions({ state, content, tier }: AppointInput): RailAppointment[] {
  const options: RailAppointment[] = [];

  for (const post of tier.overseers) {
    if (hasPost(state, tier.id, post.id)) continue;

    const cost = new Decimal(post.cost);
    if (cost.lte(0)) continue;

    const owned = state.gens[tier.id].owned;
    const weighted = owned.mul(tierMultiplier(state, content, owned));
    const before =
      post.effect.kind === 'automate' && !hasAutomator(state, content, tier.id)
        ? new Decimal(0)
        : horizonEvil({ state, content, tier, weighted });

    const after = horizonEvil({
      state,
      content,
      tier,
      weighted,
      cycleMs: effectiveCycleMs(state, content, tier) / factorOf(post, 'quicken'),
      perCycle: effectiveYield(state, content, tier).mul(factorOf(post, 'swell')),
    });

    const gain = Decimal.max(0, after.sub(before));

    options.push({
      kind: 'appoint',
      tierId: tier.id,
      overseerId: post.id,
      cost,
      affordable: canAppoint(state, content, post.id),
      gain,
      score: gain.div(cost),
    });
  }

  return options;
}

/** What this post multiplies, if it is of the kind asked about. One otherwise. */
function factorOf(post: OverseerDef, kind: 'quicken' | 'swell'): number {
  return post.effect.kind === kind ? post.effect.factor : 1;
}
```

- [ ] **Step 5: Let `horizonEvil` take an override**

`HorizonInput` gains two optional fields, both defaulting to the tier's current effective figures:

```ts
interface HorizonInput {
  state: GameState;
  content: Content;
  tier: TierDef;
  /** Milestone-weighted units of `tier` that start turning. */
  weighted: Decimal;
  /** The cycle to price against. Defaults to what the tier runs on today. */
  cycleMs?: number;
  /** The per-unit yield to price against. Defaults to what the tier yields today. */
  perCycle?: Decimal;
}

function horizonEvil({ state, content, tier, weighted, cycleMs, perCycle }: HorizonInput): Decimal {
  const each = perCycle ?? effectiveYield(state, content, tier);
  const every = cycleMs ?? effectiveCycleMs(state, content, tier);
  const perSecond = weighted.mul(each).div(every / 1000);

  return perSecond
    .mul(evilPerUnit({ state, content, producible: tier.produces }))
    .mul(HORIZON_SECONDS)
    .div(depth(content, tier.id));
}
```

`exactOptionalPropertyTypes` is on, so these must be `?:` and the call sites must omit them rather than pass `undefined`.

Point `evilPerUnit` at `effectiveYield` and `effectiveCycleMs` too, so both halves of the sum price the same machine.

- [ ] **Step 6: Push the options into the plan**

In `railPlan`, replace the single `appointOption` call with `options.push(...appointOptions({ state, content, tier }))`.

- [ ] **Step 7: Widen `spendEmphasis`**

```ts
export function spendEmphasis(
  plan: RailPlan,
  kind: RailOptionKind,
  key: TierId | OverseerId,
): SpendEmphasis {
  const matches = (option: RailOption | null): boolean =>
    option !== null &&
    option.kind === kind &&
    (option.kind === 'appoint' ? option.overseerId === key : option.tierId === key);

  if (matches(plan.best)) return 'best';
  if (matches(plan.saving)) return 'saving';
  return 'none';
}
```

- [ ] **Step 8: Run the tests and commit**

Run: `pnpm check`

```bash
git add apps/web
git commit -m "Rank every open post against every purchase"
```

---

## Task 12: Miscreants renders the roster

**Files:**
- Modify: `apps/web/src/ui/rail/Miscreants.tsx`
- Modify: `apps/web/src/ui/rail/Miscreants.css`
- Modify: `apps/web/src/App.tsx:111-128`
- Test: `apps/web/src/ui/rail/Miscreants.test.tsx`

**Interfaces:**
- Consumes: `RailAppointment.overseerId` and the widened `spendEmphasis` from Task 11.
- Produces: `MiscreantsProps.onAppoint: (overseerId: OverseerId) => void`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/ui/rail/Miscreants.test.tsx`:

```ts
it('lists every post on every tier', () => {
  render(<Miscreants {...props()} />);

  expect(screen.getAllByRole('listitem')).toHaveLength(
    fixture.tiers.reduce((total, tier) => total + tier.overseers.length, 0),
  );
});

it('groups the posts under their tier', () => {
  render(<Miscreants {...props()} />);

  expect(screen.getByRole('group', { name: 'Minions' })).toBeInTheDocument();
});

it('reports which post was chosen', async () => {
  const onAppoint = vi.fn();
  render(<Miscreants {...props({ onAppoint })} />);

  await userEvent.click(screen.getByRole('button', { name: /Fixture Taskmaster/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Appoint' }));

  expect(onAppoint).toHaveBeenCalledWith('minion-hand');
});
```

Extend whatever `props()` helper the file already has; if it has none, build one so the three cases share a setup.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/ui/rail/Miscreants.test.tsx`
Expected: FAIL — one post per tier renders, and `onAppoint` is called with a tier id.

- [ ] **Step 3: Rework the component**

Replace `PostState` and the mapping:

```tsx
interface PostState {
  tier: TierDef;
  post: OverseerDef;
  filled: boolean;
  /** Null once filled, and for a rung the player has not reached. */
  offer: RailAppointment | null;
  price: Decimal;
  emphasis: SpendEmphasis;
}

interface TierPosts {
  tier: TierDef;
  posts: PostState[];
}
```

Build `offers` keyed on `overseerId` rather than `tierId`, then:

```tsx
  const groups: TierPosts[] = [...content.tiers].reverse().map((tier) => ({
    tier,
    posts: tier.overseers.map((post) => {
      const offer = offers.get(post.id) ?? null;

      return {
        tier,
        post,
        filled: hasPost(state, tier.id, post.id),
        offer,
        price: offer?.cost ?? new Decimal(post.cost),
        emphasis: spendEmphasis(plan, 'appoint', post.id),
      };
    }),
  }));
```

Render each group as a `<section role="group" aria-label={tier.plural}>` holding its own `<ul>`. Every post shows, filled or not, in reach or not — a wall of empty posts names what is still ahead and fixes the panel's height, which is why the existing doc comment argues for it. Keep that comment and extend it to say the grouping is by tier because a post's price only means anything beside the tier it watches.

`Post` reads `copy.overseer.names[post.post.id]` and `.notes[post.post.id]`.

- [ ] **Step 4: Group the styles**

The group label is a `Banner` at `as="h3" weight="secondary"` — the panel already sits inside a `Panel`, so a tier name is one level below its title. No new colour: the tier tone already rides on `[data-tier]`.

```css
.miscreants__group + .miscreants__group {
  margin-block-start: var(--space-4);
}

.miscreants__label {
  margin-block-end: var(--space-2);
}
```

Move the existing `.miscreants__posts` rules onto the inner `<ul>` unchanged — the list styling does not care that there are now three rows instead of one.

- [ ] **Step 5: Update the call site**

In `apps/web/src/App.tsx`, the Miscreants tab:

```tsx
          onAppoint={(overseerId) => {
            const result = dispatch({ kind: 'appoint', overseerId });
            if (result.ok) sound.play('unlock');
          }}
```

and its `trailing` becomes filled posts over total posts:

```tsx
  const posts = content.tiers.reduce((total, tier) => total + tier.overseers.length, 0);
  const filled = content.tiers.reduce((total, tier) => total + state.overseers[tier.id].length, 0);
```

- [ ] **Step 6: Run the tests and commit**

Run: `pnpm check`

```bash
git add apps/web
git commit -m "Show every post grouped under the tier it watches"
```

---

## Task 13: The prestige panel reports time

**Files:**
- Modify: `apps/web/src/ui/rail/PrestigePanel.tsx:39-96`
- Modify: `apps/web/src/ui/rail/PrestigePanel.css`
- Modify: `packages/content/src/copy.ts` (`PrestigeCopy`), `packages/content/src/v1/copy.ts`
- Test: `apps/web/src/ui/rail/PrestigePanel.test.tsx`

**Interfaces:**
- Consumes: `msToNextSoul` from Task 8, `state.stats.runMs` from Task 7, `formatDuration` from `apps/web/src/ui/format.ts`.
- Produces: `PrestigeCopy.runLength: string`, `PrestigeCopy.nextSoul: string`, `PrestigeCopy.nextSoulUnknown: string`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/ui/rail/PrestigePanel.test.tsx`:

```ts
it('reports how long this run has lasted', () => {
  const state = appointed(fixture);
  state.stats.runMs = 4_320_000;

  render(<PrestigePanel {...props({ state })} />);

  expect(screen.getByText('1h 12m')).toBeInTheDocument();
});

it('reports how long the next soul will take', () => {
  const state = appointed(fixture);
  state.gens.minion.owned = new Decimal(1000);

  render(<PrestigePanel {...props({ state })} />);

  expect(screen.getByText(/next soul/i)).toBeInTheDocument();
});

it('says nothing definite when nothing is running', () => {
  const state = createState(fixture);

  render(<PrestigePanel {...props({ state })} />);

  expect(screen.getByText(/nothing is turning/i)).toBeInTheDocument();
});
```

Check `formatDuration`'s exact output shape in `apps/web/src/ui/format.ts` before asserting `'1h 12m'`, and match it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/ui/rail/PrestigePanel.test.tsx`
Expected: FAIL — no such text renders.

- [ ] **Step 3: Add the copy**

In `packages/content/src/copy.ts`, inside `PrestigeCopy`:

```ts
  /** Term beside how long the current run has lasted. */
  readonly runLength: string;
  /** Term beside the estimated wait for one more soul. */
  readonly nextSoul: string;
  /** Said in place of an estimate when no tier is turning on its own. */
  readonly nextSoulUnknown: string;
```

In `packages/content/src/v1/copy.ts`:

```ts
    runLength: 'This reign',
    nextSoul: 'Next soul in',
    nextSoulUnknown: 'Nothing is turning on its own',
```

- [ ] **Step 4: Render them**

In `PrestigePanel.tsx`, extend the memo:

```tsx
  const { gain, multiplier, waitMs } = useMemo(
    () => ({
      gain: prestigeGain(state, content),
      multiplier: new Decimal(1).add(state.souls.mul(content.prestige.perSoul)),
      waitMs: msToNextSoul(state, content),
    }),
    [state, content, version],
  );
```

and add two figures to the `<dl>`, after `reckoning`:

```tsx
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.runLength}</dt>
          <dd className="prestige__value">{formatDuration(state.stats.runMs)}</dd>
        </div>
        <div className="prestige__figure">
          <dt className="prestige__term">{copy.nextSoul}</dt>
          <dd className="prestige__value">
            {waitMs === null ? copy.nextSoulUnknown : formatDuration(waitMs)}
          </dd>
        </div>
```

The figures grid already fixes its own column count, so nothing here moves the panel's height as the numbers change. If it does not, set `grid-template-columns` on `.prestige__figures` rather than letting the content decide — nothing may reflow while the game is running.

- [ ] **Step 5: Run the tests and commit**

Run: `pnpm check`

```bash
git add apps/web packages/content
git commit -m "Tell the player what this reign has cost in hours"
```

---

## Task 14: The dev jumps

**Files:**
- Modify: `apps/web/src/dev/jumps.ts:28-60`, `:91-153`
- Test: `apps/web/src/dev/jumps.test.ts`

**Interfaces:**
- Consumes: the roster from Task 5, `OverseerId` from Task 4.
- Produces: `Board.appointed` becomes `readonly OverseerId[]`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/dev/jumps.test.ts`:

```ts
it('leaves every jump somewhere the player can act from', () => {
  for (const jump of jumps(fixture, copy)) {
    const state = jump.build();
    const canDoSomething =
      state.resources.evil.gt(0) ||
      fixture.tiers.some((tier) => state.gens[tier.id].owned.gt(0));

    expect({ id: jump.id, canDoSomething }).toHaveProperty('canDoSomething', true);
  }
});

it('keeps the free Minion on a freshly reset board', () => {
  const banked = jumps(fixture, copy).find((jump) => jump.id === 'banked:10');

  expect(banked?.build().gens.minion.owned.toString()).toBe('1');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/dev/jumps.test.ts`
Expected: FAIL on `banked:10` — 0 Minions, 0 Evil, nothing to rouse.

- [ ] **Step 3: Fix the wipe**

In `board()`, a tier the spec does not name keeps what `createState` granted it:

```ts
  for (const id of TIER_IDS) {
    const count = spec.owned?.[id];
    // Only overwrite what the spec actually asked for. Writing `?? 0` over every tier
    // wiped the free Minion `createState` grants, and the "souls banked" jumps name no
    // counts at all — so they landed on a board with nothing owned, nothing running
    // and no Evil, which the game cannot be played out of.
    if (count !== undefined) state.gens[id].owned = new Decimal(count);
    state.unlocked[id] = state.gens[id].owned.gt(0);
  }
```

- [ ] **Step 4: Move the jumps onto the roster**

`Board.appointed` becomes `readonly OverseerId[]`, and `board()` sets:

```ts
  for (const tier of content.tiers) {
    state.overseers[tier.id] = tier.overseers
      .filter((post) => spec.appointed?.includes(post.id) ?? false)
      .map((post) => post.id);
  }
```

Everywhere the list built `ids` or `everyId` from tier ids, build it from `tier.overseers.map((post) => post.id)` instead. The `appoint:` group becomes one jump per post — label it with the post's `name` and `cost`, replacing the `copy.overseer.names[tier.id]` and `tier.overseerCost` reads.

- [ ] **Step 5: Add a jump for the new tier**

The `rungs.forEach` loop already walks `content.tiers`, so Thrones get their jumps for free. Confirm by reading the rendered list in the dev bar.

- [ ] **Step 6: Run the tests and commit**

Run: `pnpm check`

```bash
git add apps/web
git commit -m "Stop the dev jumps wiping the free Minion"
```

---

## Task 15: The muster shows what you bought

Spec §7's last bullet. Cost now keys off a count the player cannot see anywhere, and a price they cannot account for is a price they will assume is broken.

**Files:**
- Modify: `apps/web/src/ui/rail/TierRow.tsx`
- Modify: `apps/web/src/ui/rail/BuyRail.css`
- Modify: `packages/content/src/copy.ts` (`RailCopy`), `packages/content/src/v1/copy.ts`
- Test: `apps/web/src/ui/rail/BuyRail.test.tsx`

**Interfaces:**
- Consumes: `TierState.purchased` from Task 1.
- Produces: `RailCopy.bought: (count: string) => string`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/ui/rail/BuyRail.test.tsx`:

```ts
it('says how many of a tier were bought when the cascade has made more', () => {
  const state = appointed(fixture);
  state.gens.minion.purchased = new Decimal(12);
  state.gens.minion.owned = new Decimal(4000);

  render(<BuyRail {...props({ state })} />);

  expect(screen.getByText(/12 bought/)).toBeInTheDocument();
});

it('says nothing about purchases when every unit was bought', () => {
  const state = appointed(fixture);
  state.gens.minion.purchased = new Decimal(12);
  state.gens.minion.owned = new Decimal(12);

  render(<BuyRail {...props({ state })} />);

  expect(screen.queryByText(/bought/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/web/src/ui/rail/BuyRail.test.tsx`
Expected: FAIL — nothing renders the purchased count.

- [ ] **Step 3: Add the copy**

In `packages/content/src/copy.ts`, inside `RailCopy`:

```ts
  /**
   * Said beside the owned count when the two differ. `count` arrives formatted.
   *
   * Only when they differ. A row where every unit was bought would be saying the
   * same number twice, and the line is there to explain a price, not to decorate.
   */
  readonly bought: (count: string) => string;
```

In `packages/content/src/v1/copy.ts`, inside `rail`:

```ts
    bought: (count: string): string => `${count} bought`,
```

- [ ] **Step 4: Render it**

In `TierRow.tsx`, beside wherever the owned count is drawn:

```tsx
      {state.gens[tier.id].purchased.lt(state.gens[tier.id].owned) && (
        <span className="tier-row__bought">
          {copy.rail.bought(formatCount(state.gens[tier.id].purchased))}
        </span>
      )}
```

Use whichever of `formatCount` or `formatNumber` the row already uses for the owned figure, so the two read alike.

- [ ] **Step 5: Style it**

```css
.tier-row__bought {
  color: var(--ink-dim);
  font-size: var(--text-xs);
}
```

The row's height must not change when the line appears or disappears. If the row is a grid, give the cell a fixed row track; if it is a flex column, reserve the line with `min-block-size`. Nothing in the interface may reflow while the game is running.

- [ ] **Step 6: Run the tests and commit**

Run: `pnpm check`

```bash
git add apps/web packages/content
git commit -m "Say how many of a tier were bought where the price disagrees"
```

---

## Final: play it

- [ ] **Step 1: Run the whole check**

Run: `pnpm check`
Expected: PASS, including the 120-second golden.

- [ ] **Step 2: Run the harness once more**

Run: `pnpm harness`
Confirm the printed table still matches the doc comment Task 10 recorded. If it does not, one of Tasks 11–14 reached into the engine when it should not have.

- [ ] **Step 3: Play the opening**

Run: `pnpm dev`

Check by hand, in order:
- A fresh save opens with one Minion, nothing running, and Smite wearing the accent.
- Rousing the Minions pays out. Appointing the Taskmaster stops the rousing.
- Appointing the goad visibly halves the Minion ring's sweep.
- The Miscreants panel shows fifteen posts, grouped, with the accented one in the right group.
- The prestige panel shows a run length that climbs and a next-soul estimate that falls.
- A Minion row that the cascade has inflated says how many were bought, and its price matches that number rather than the holding.
- Taking a reset clears every post and leaves one Minion and a playable board.
- Every dev jump lands somewhere playable, including `banked:10`.

- [ ] **Step 4: Update the spec's route**

Add a line to `docs/superpowers/specs/2026-08-04-economy-retune-design.md` §10 recording that A is delivered, so B, C and D start from a stated position.
