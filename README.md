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

**M0.** The engine core is real and tested: fixed-timestep simulation, cost curve,
purchases, milestone and prestige multipliers, offline catch-up, saves. The worked
example from the original design docs is asserted number for number.

`apps/web` is a shell, deliberately. It proves the loop runs end to end and nothing
more. The chain diagram and buy rail described in the spec are M2 work and should
replace it wholesale.

**Balance has had one tuned pass**, measured with `pnpm harness` rather than guessed.
Warrens at 26 minutes, Dark Legions at 58, Fortresses at 2h53m, first prestige at
2h46m. The first draft reached every tier in 23 minutes, so this is a real change, but
it is a first pass and wants real players. Re-run the harness after touching any
number in `packages/content`.

## Reading order

1. `docs/superpowers/specs/2026-08-03-dread-majesty-design.md` — the design, the
   decisions, and why each one went the way it did.
2. `CLAUDE.md` — how to write code here.
3. `docs/reference/` — the earlier planning documents. Still good on game design and
   Laravel house style. Their server-authoritative architecture is superseded; the
   spec says where and why.
