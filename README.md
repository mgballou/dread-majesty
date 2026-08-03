# Dread Majesty

An incremental game. Fortresses raise Dark Legions, Legions take ground that becomes
Warrens, Warrens breed Minions, Minions generate Evil.

Generators produce other generators, so production compounds inside a single elapsed
interval. That cascade is the game, and making it visible is the point of the
interface.

Web first and free. Steam via Tauri if it finds an audience.

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

## Where things stand

**M1 through M4 have had a first pass.** The game is playable end to end.

The engine is complete and tested: fixed-timestep simulation, an exact cost curve and
max-buy, purchases, manual cycles and Overseers, milestone and prestige multipliers,
achievements, unlock latching, offline catch-up, and versioned saves with a migration
chain. The worked example from the original design docs is asserted number for number.

**A tier does not run until somebody makes it run.** Every tier starts manual: you
rouse it from its node on the chain, it runs one cycle, pays out and stops. Appointing
that tier's Overseer, for Evil, automates it for good. That is the opening loop, and
it is bought off tier by tier.

`apps/web` is the designed interface, not a shell: the live chain diagram, the buy
rail with exactly one accented spend, the prestige panel, the deeds wall, the ledger,
and the offline-return screen. Saves go to IndexedDB and export as a pasteable blob.
Sound is synthesised in code and muted until asked for.

There is a dev workbench at the foot of the page — jump to any point of progression,
set any resource, appoint or dismiss every Overseer, simulate an absence. It is
stripped from production builds and it deliberately looks nothing like the game.

Every player-facing string lives in `packages/content/src/v1/copy.ts`. Adding an
achievement without copy fails typecheck.

**Balance has had two tuned passes**, measured with `pnpm harness` rather than
guessed. Warrens at 28 minutes, Dark Legions at 1h01m, Fortresses at 2h37m, first
prestige at 2h29m. It is still a first answer and wants real players. Re-run the
harness after touching any number in `packages/content`.

Not done: real art (every slot renders a generated SVG fallback), and everything in
M5 and M6.

## Reading order

1. `docs/superpowers/specs/2026-08-03-dread-majesty-design.md` — the design, the
   decisions, and why each one went the way it did.
2. `CLAUDE.md` — how to write code here.
3. `docs/reference/` — the earlier planning documents. Still good on game design and
   Laravel house style. Their server-authoritative architecture is superseded; the
   spec says where and why.
