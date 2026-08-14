# Dread Majesty

An incremental game. Fortresses raise Dark Legions, Legions take ground that becomes
Warrens, Warrens breed Minions, Minions generate Evil.

Generators produce other generators, so production compounds inside a single elapsed
interval. That cascade is the game, and making it visible is the point of the
interface.

Play it at [dreadmajesty.netlify.app](https://dreadmajesty.netlify.app). Web first and
free. Steam via Tauri if it finds an audience.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # typecheck + lint + test
pnpm build      # production bundle
pnpm harness    # headless balance run
```

Node 22 or newer.

## Layout

```
packages/engine/    pure TypeScript. no DOM, no React, no I/O. the game.
packages/content/   balance numbers, copy, art slots.
apps/web/           React + Vite. renders engine state, sends intents.
```

Dependencies flow one way: web → engine → content types.

## How it works

**The engine has no DOM, no React and no I/O.** Time and seeds enter as arguments at
the boundary. That single rule buys most of what follows.

**The simulation is deterministic and fixed-timestep.** Elapsed milliseconds are banked
and spent in whole slices, so a cycle finishing depends on how much time passed, never
on how the browser scheduled frames. Coming back after four hours runs the same `step`
the same number of times as sitting there for four hours would have. There is no second
code path for offline, no aggregate shortcut, no closed form.

Each slice reads from a snapshot and writes into a delta, committed at the end. Nothing
produced within a slice affects anything else within it, which is why tier order does
not matter and why there is no tie-break rule to get wrong.

**Every resource and generator count is a `Decimal`** (`break_eternity.js`), never a JS
number. The game reaches 1e30 in a week of play and past 1e300 eventually.

**Saves are versioned with a migration chain.** Ten versions so far, each a pure
function from one blob shape to the next, applied in sequence. A shipped entry is never
edited — a mistake gets another step appended, because there is no way to tell which
saves already passed through the old one. Version 10 exists for exactly that reason.

**Balance is measured, not guessed.** `pnpm harness` runs the real engine headless for
seven simulated days and reports when each tier arrives, when each tier goes obsolete,
what the growth exponent is, and whether the prestige loop converges or runs away. Every
number in `packages/content` was fitted against it. The harness is a script and never
gates CI — it is a measuring instrument, not a test.

Because the engine is pure, its tests are plain assertions against fixtures, never
against shipping content. A balance change cannot fail an engine test.

## How it was built

Roughly 157 commits over six days, agent-assisted throughout. That is what the log says
and it is worth saying plainly rather than dressing up as months of craft.

What is mine is the architecture, the scoping, and the quality gates: the layering and
its one-way dependency rule, the five engine constraints above, the decision to measure
balance instead of guessing, what went in each milestone and what got cut, and the
standard every change had to clear before it landed. The specs in
`docs/superpowers/specs/` are the record of those decisions and why each went the way it
did.

The gates are real and they caught real things. `pnpm check` is typecheck, lint and the
full test suite, and it runs before every commit. Beyond that, the interesting failures
were the ones only measurement found:
a prestige curve that looked balanced and diverged to ×634 after two resets, and its
replacement, which was correct in every figure but had lost its zero and paid 213 souls
for thirty-four Evil. Neither was visible by reading the code. The harness found the
first and a playtest found the second.

## Where things stand

**M1 through M4 have had a first pass.** The game is playable end to end.

The engine is complete and tested: fixed-timestep simulation, an exact cost curve and
max-buy, purchases, manual cycles and Overseers, milestone and prestige multipliers,
achievements, unlock latching, offline catch-up, and versioned saves.

**A tier does not run until somebody makes it run.** Every tier starts manual: you
rouse it from its node on the chain, it runs one cycle, pays out and stops. Appointing
that tier's Overseer, for Evil, automates it for good. That is the opening loop, and
it is bought off tier by tier.

`apps/web` is the designed interface, not a shell: the live chain diagram, the buy
rail with exactly one accented spend, the prestige panel, the deeds wall, the ledger,
and the offline-return screen. Saves go to IndexedDB and export as a pasteable blob.
Sound is synthesized in code and muted until asked for.

A first run is walked one action at a time. A line at the foot of the screen names the
next thing to do and holds back every other control until it is done, then clears and
leaves the player alone until the next moment worth teaching. Six moments are gated that
way. A seventh line gates nothing and simply remarks on the five Minions the first Warren
delivered without being asked, which is the whole cascade in one sentence. It is
skippable at the first prompt and never returns.

The first time you smite, something else starts talking. It wants you to do it again
immediately, which is the wrong move, and it argues better the longer you refuse.

There is a dev workbench at the foot of the page — jump to any point of progression,
set any resource, appoint or dismiss every Overseer, simulate an absence. It is
stripped from production builds and it deliberately looks nothing like the game.

Every player-facing string lives in `packages/content/src/v1/copy.ts`. Adding an
achievement without copy fails typecheck.

**Economy tuning is ongoing.** The numbers have had several measured passes and the
current ones are the best answer so far, not a finished one: Warrens at 11 minutes,
Dark Legions at 41 minutes, Fortresses at 1h23m, Thrones at 2h30m, first prestige at
42 minutes. Expect them to move. They want real players more than they want another
harness run. Re-run `pnpm harness` after touching any number in `packages/content`.

Not done: real art — every slot renders a generated SVG fallback.

## Reading order

1. `docs/superpowers/specs/2026-08-03-dread-majesty-design.md` — the design, the
   decisions, and why each one went the way it did.
2. `CLAUDE.md` — how to write code here.
3. `docs/reference/` — the earlier planning documents. Still good on game design and
   house style. Their server-authoritative architecture is superseded; the spec says
   where and why.
