# Dread Majesty

An incremental game. Fortresses raise Dark Legions, Legions take ground that becomes
Warrens, Warrens breed Minions, Minions generate Evil. Generators produce other
generators, so production compounds — that cascade is the game.

Tone is **false grimdark**: gothic trappings played straight, an earnest protagonist,
the comedy in the gap between the two. Art is never winking. Writing and numbers carry
the joke.

**Read `docs/superpowers/specs/2026-08-03-dread-majesty-design.md` before starting
work.** It holds the design, the decisions and their reasons. This file holds only how
to write code here.

---

## Commands

```bash
pnpm install
pnpm dev            # web app, localhost:5173
pnpm test           # vitest, all packages
pnpm test:watch
pnpm typecheck      # tsc --noEmit across the workspace
pnpm lint           # eslint + prettier check
pnpm fix            # eslint --fix + prettier --write
pnpm check          # typecheck + lint + test. run before every commit.
pnpm harness        # headless balance run
```

---

## Layout and dependency direction

```
packages/engine/    pure TypeScript. no DOM, no React, no I/O. the game.
packages/content/   balance numbers, copy, art slots. versioned and validated.
apps/web/           React + Vite. renders engine state, sends intents.
```

Dependencies flow one way: **web → engine → content types**.

The engine imports content **types and the id vocabulary** (`TierId`, `isTierId`,
`TIER_IDS`). It never imports **balance data** — `v1` and `CURRENT` are barred by
lint. Content arrives as a function argument. Anything that breaks this makes the
engine untestable against fixtures.

Engine tests run against `packages/engine/test/fixtures/`, **never against shipping
content**. A balance change must never be able to fail an engine test.

---

## The engine's five rules

These are load-bearing. Breaking any one of them costs more than it saves.

1. **No `Date.now()`, no `Math.random()`, no I/O inside `packages/engine`.** Time and
   seeds enter as arguments at the boundary. This is what makes every engine test a
   plain assertion and keeps replay verification available later for free.

2. **`step` and `apply` are the only functions permitted to mutate `GameState`.**
   They mutate in place, deliberately — allocating a fresh nested state 36,000 times
   to catch up an hour offline is real garbage for no gain. Everything else, every
   selector and every component, treats state as read-only. `cloneState` exists for
   tests and what-if calculations.

3. **Read from a snapshot, write into a delta, commit at slice end.** Nothing
   produced within a slice may affect anything else within that same slice. This is
   why tier iteration order does not matter and why there is no tie-break rule to get
   wrong. Any code that reads a live count mid-slice is a bug.

4. **One `step`, called from both paths.** Online calls it as frames arrive; offline
   calls it in a loop. Never write a second simulation for offline, an aggregate
   shortcut, or a closed form — unless it is tested against `step` and provably
   identical.

5. **Every resource and generator count is a `Decimal`** (`break_eternity.js`). Never
   a JS number, never a float, not even early on when the values are small. Mixed
   arithmetic is the bug you find six months later at 1e300.

---

## TypeScript

- `strict: true`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **No `any`.** `unknown` at boundaries, narrowed immediately. No `as` casts except
  where a type guard genuinely cannot express it, with a comment saying why.
- **Discriminated unions over string flags.** An intent is
  `{ kind: 'purchase', ... } | { kind: 'smite' }`, never `{ type: string }`.
- **`as const` for every content literal and id set.** Ids are unions of literals, not
  `string`. A typo in a tier id must fail typecheck, not at runtime.
- **Object parameters once a function takes three or more arguments**, so call sites
  read as named. Two or fewer stay positional.
- **Return a typed object or a value, never a tuple, never a loose record.**
- **No default exports.** Named exports only, so renames are mechanical.
- **No barrel file re-exports across packages** beyond each package's single
  `src/index.ts` public surface. Reaching into another package's internals is a
  layering break.
- Errors are typed classes with a static factory: `InsufficientEvil.forPurchase(...)`.
  Never `throw new Error('...')` with a hand-written string.

---

## Naming

| Concept                      | Pattern                                  | Example                                  |
| ---------------------------- | ---------------------------------------- | ---------------------------------------- |
| Engine mutator               | verb                                     | `step`, `apply`, `catchUp`               |
| Selector                     | `noun` or `verbNoun`, pure and read-only | `nextCost`, `productionPerSecond`        |
| Predicate                    | `canX` / `isX` / `hasX`                  | `canAfford`, `isUnlocked`                |
| Type                         | noun                                     | `GameState`, `Content`, `TierDef`        |
| Report returned by a mutator | `{X}Report`                              | `StepReport`, `OfflineReport`            |
| Content id                   | lowercase singular                       | `minion`, `warren`, `legion`, `fortress` |
| React component              | noun of what it shows                    | `ChainStage`, `BuyRail`, `TierNode`      |
| Hook                         | `use{Noun}`                              | `useGameLoop`, `useReducedMotion`        |
| Test file                    | mirrors the source path                  | `src/step.ts` → `test/step.test.ts`      |

---

## Testing

Vitest. Tests mirror source paths.

- **The 120-second golden in the spec §4.3 is the anchor test.** If it fails, stop and
  fix it before anything else. It catches essentially every mistake in the simulation.
- **Prefer a property to three examples.** `step(step(s,dt),dt) === step(s,2·dt)` is
  worth more than any number of hand-written cases.
- **Never mock the engine.** It is pure and fast. Build real state from fixtures.
- **No comments in tests** unless the test is genuinely unusual.
- One assertion per `expect`. No chained `.and()`.
- The balance harness is a script, not a test. It must never gate CI.

---

## Interface

`docs/ui-sensibility.md` is normative. Read it. The rules it forces that the
genre usually breaks:

- **One accent per screen.** The rail carries every generator at secondary weight and
  lifts exactly one — the best available purchase — to primary. Never five equal
  buttons.
- **Nothing rebuilds to show that it is loading.** Placeholders in place, sized to the
  content.
- **No screen decides what colour a state is.** Tone rides with the data.
- **No raw values outside the token definitions.** Semantic names only — `surface`,
  `line`, `accent`. Never `grey-800`, never `orange`.
- **Reduced motion is designed, not stripped.** This game is motion. Rings jump
  instead of sweeping, motes fade in place instead of travelling, numbers still roll.
  Nothing visible under normal motion may go missing under reduced motion.
- **Number formatting is one shared function**, used everywhere. It is among the
  most-read text in the game.

Forced dark, single theme. The token-parity test stays anyway — it costs nothing and
pins the contract.

Art is a manifest with generated SVG fallbacks. The build must never depend on the
Draw Things lab being reachable.

---

## Anti-patterns

- ❌ `Date.now()` anywhere under `packages/engine`.
- ❌ A second simulation path for offline, or an aggregate shortcut that skips the
  cascade.
- ❌ Reading a live count mid-slice instead of from the snapshot.
- ❌ A JS number holding a resource or generator count.
- ❌ Game logic in a React component, a hook, or an event handler. Components render
  state and dispatch intents. That is all they do.
- ❌ The engine importing the content package.
- ❌ An engine test that imports shipping content.
- ❌ `any`, a default export, or a stringly-typed id.
- ❌ Balance numbers hardcoded outside `packages/content`.
- ❌ Treating the seeded balance numbers as balanced. They are placeholders until the
  harness says otherwise.
- ❌ Building anything in `apps/web` before the M1 engine tests pass.

---

## Git

- Branch off `main`. Never commit to `main` directly.
- Commit messages: imperative, one line, no trailers, no AI attribution.
- Run `pnpm check` before every commit.
- PR descriptions follow the format in the global `CLAUDE.md`.
