# Dread Majesty — Design Spec

**Date:** 2026-08-03
**Status:** approved, ready for implementation
**Audience:** the agent or developer building M1 onward

---

## 1. What this is

An incremental/idle game. The player is a dark lord building a cascading production
chain: Fortresses raise Dark Legions, Legions take ground that becomes Slums, Slums
breed Minions, Minions generate Evil. Evil buys more of everything.

The genre reference points are AdVenture Capitalist, AdVenture Communist and Idle
Miner Tycoon. The mechanical distinction from AdCap — and the thing this game must
make visible — is that **generators produce other generators**, so production
compounds within a single elapsed interval.

**Tone: false grimdark.** Gothic trappings played straight — spires, black forests,
rites, ledgers of atrocity. The protagonist earnestly wants to conquer and rule. The
comedy is the gap between that earnestness and everything around it. The art is
straight-faced gothic; the writing and the numbers carry the joke. Never winking in
two places at once.

**v1 ships free on the web**, no account, no login wall, posted to
r/incremental_games. Steam via Tauri is the monetization step, conditional on
traction. Mobile is possible and unplanned.

---

## 2. Decisions already made

These were settled during design. Reopen them only with a reason, not a preference.

| Decision | Choice | Why |
| --- | --- | --- |
| Simulation authority | Client | Single-player game. Nobody is harmed by a cheater. Server authority costs a round trip per purchase against a 100ms feel budget, and duplicates an engine the client needs anyway. |
| Backend in v1 | None | Nothing needs one yet. The game must stay fully playable with the meta-plane absent or down — permanently, not just in v1. |
| Simulation model | Fixed timestep, 100ms | One code path for online and offline. See §4. |
| Big numbers | `break_eternity.js` | Built for this genre. `decimal.js` is arbitrary-precision and slow. |
| Persistence | IndexedDB + export/import blob | localStorage caps at 5MB and blocks the main thread. The export blob is also the bug-report format. |
| Prestige | Damned Souls, flat multiplier | Proven, cheap to balance, trivial to explain. Deepen later. |
| Main screen | Live chain diagram + buy rail | Shows the cascade, which is the game's actual novelty. See §6. |
| Theme | Forced dark, single theme | Correct for a gothic game; sanctioned by `architectural-sensibility.md` §9.5. |
| Language | TypeScript everywhere | The engine must run on the client. A PHP engine would be a second implementation. |

**A note on the reference docs.** `docs/reference/` holds the earlier planning
documents. They contain the game design, the worked example in §4.1 and a good
Laravel house style — all still useful. Their *architecture* is superseded: they
specify a server-authoritative Laravel engine, which §2 above reverses.
`architectural-sensibility.md` remains normative for the eventual Laravel meta-plane
(§9) and for nothing else. `ui-sensibility.md` remains normative in full.

---

## 3. Repository shape

```
dread-majesty/
├── packages/
│   ├── engine/     pure TypeScript. no DOM, no React, no I/O. the game.
│   └── content/    balance numbers and copy, versioned and validated.
└── apps/
    └── web/        React + Vite. renders engine state, sends intents.
```

`content` is separate from `engine` because rules and numbers change on different
clocks. Content is retuned constantly; the engine is touched rarely. **Engine tests
run against fixture content in `packages/engine/test/fixtures/`, never against
shipping content**, so a balance change can never break an engine test.

Dependency direction is one way: `web → engine → content-types`. The engine imports
content **types and the id vocabulary** (`TierId`, `isTierId`, `TIER_IDS`); it never
imports **balance data** — `v1` and `CURRENT` are barred by an ESLint rule. Content
is passed in as an argument. The engine has no dependency it could not run under Node
with no DOM.

---

## 4. The engine

### 4.1 The core loop

Advance the clock in fixed slices. Each slice, every tier accrues fractional cycle
progress; whole completions fire and the remainder carries. **Read from a snapshot
taken at slice start, write into a delta buffer, commit at the end of the slice.**

```ts
function step(state: GameState, content: Content, dtMs: number): StepReport {
  const owned = snapshotCounts(state);   // read from this
  const delta = emptyDelta();            // write into this

  for (const tier of content.tiers) {
    const g = state.gens[tier.id];
    if (g.owned.eq(0)) continue;

    g.progress += dtMs / tier.cycleMs;
    const completions = Math.floor(g.progress);
    if (completions === 0) continue;
    g.progress -= completions;

    credit(delta, tier.produces,
      owned[tier.id].mul(tier.yield).mul(completions).mul(multiplier(state, tier)));
  }

  commit(state, delta);
  return report;
}
```

Read-snapshot / write-delta means **nothing produced within a slice can affect
anything else within that same slice**. Tier iteration order therefore does not
matter, and there is no tie-break rule to define, document or get wrong.

> **This corrects the reference docs.** `project_init.md` §10 specifies
> higher-tier-first ordering, which contradicts its own worked example: at t=120s
> both a Slum and the Minion tier complete, and higher-tier-first would pay 205
> minions rather than the 105 the example states. The example is right — those
> minions did not exist during the shift that just ended. Snapshot semantics produce
> the example's answer and remove the question.

### 4.2 Timing semantics, stated exactly

- **One timer per tier, not per unit.** All minions share the minion tier's cycle. A
  minion created mid-cycle joins the running cycle; it does not start its own.
- **Payout reads the count at completion, not at cycle start.** A generator that
  arrives at any point before the moment of payout is paid a **full share** for that
  cycle. This matches AdVenture Capitalist, and the "buy just before a payout"
  micro-decision it creates is desirable — keep it.
- **The only exclusion is same-slice.** A generator arriving in the same 100ms slice
  that computes a payout waits for the next cycle. That is the entire imprecision:
  ≤100ms live, ≤1s in coarsened offline batches.
- **Do not prorate by time-in-shift.** More code, illegible to a player watching
  numbers move, unlike every game in the genre, and it deletes the only micro-decision
  the buy loop has.

### 4.3 The worked example, which is the golden test

1 Slum, 5 Minions, 120 seconds. Minion cycle 24s yielding 15 Evil each; Slum cycle
60s yielding 100 Minions.

```
t=24s   5 minions   →       75 Evil
t=48s   5 minions   →       75 Evil
t=60s   1 slum      →      100 Minions   (owned becomes 105)
t=72s   105 minions →    1,575 Evil
t=96s   105 minions →    1,575 Evil
t=120s  105 minions →    1,575 Evil      and 1 slum → 100 Minions (owned becomes 205)
        ─────────────────────────────
        total              4,875 Evil, 205 Minions
```

Assert this number for number. It fails loudly against every mistake in this area.

### 4.4 Purity and mutation, stated honestly

`step` **mutates the state object in place.** It is deterministic and free of side
effects beyond its state argument, but it is not immutable. Allocating a fresh nested
state 36,000 times to catch up an hour offline is real garbage for no gain.

The rules that make this safe:

- `step` and `apply` are the **only** functions permitted to mutate `GameState`.
  Everything else — every selector, every React component — treats it as read-only.
- **No `Date.now()`, no `Math.random()`, no I/O inside the engine.** Time and seeds
  enter as arguments at the boundary. This is what makes every test a plain assertion
  and leaves server-side replay verification available later at no cost.
- `cloneState(state)` exists for tests and for optimistic what-if calculations.

### 4.5 Public surface

```ts
createState(content: Content): GameState
step(state: GameState, content: Content, dtMs: number): StepReport
apply(state: GameState, content: Content, intent: Intent): IntentResult
catchUp(state: GameState, content: Content, elapsedMs: number): OfflineReport
```

Plus selectors, all pure and read-only: `nextCost`, `bulkCost`, `maxAffordable`,
`canAfford`, `productionPerSecond`, `prestigeGain`, `milestoneProgress`.

Intents: `{ kind: 'purchase', tierId, quantity }` where quantity is `1 | 10 | 100 |
'max'`; `{ kind: 'smite' }`; `{ kind: 'prestige' }`.

### 4.6 Offline catch-up

`catchUp` runs the same `step` in a loop. No second implementation exists, so online
and offline agree by construction rather than by test.

- Elapsed time is clamped to the offline cap (**4 hours** at launch, raisable by
  upgrades — this is also the later monetization hook).
- If wall clock moved backwards, elapsed is clamped to zero.
- Beyond one hour of elapsed time, coarsen the step to 1s. The drift this introduces
  is bounded by one slice per cascade and is well under 0.1% over such intervals.
- `OfflineReport` carries totals per resource and per tier for the return summary
  screen. It does **not** carry a per-event list; that is what made the old design
  allocate millions of objects.

### 4.7 Saves

Versioned JSON, one migration function per version step, applied in a chain. A save
two versions old must load. Serialise `Decimal` values as their string form.

`exportSave()` and `importSave(blob)` produce and accept a base64 string a player can
paste. Round-tripping a save must be lossless — assert it.

---

## 5. Game design

### 5.1 The chain

| Tier | Produces | Notes |
| --- | --- | --- |
| Fortresses | Dark Legions | |
| Dark Legions | Slums | |
| Slums | Minions | |
| Minions | Evil | |

Naming note, unresolved and low-stakes: *Slums* is modern-urban and sits oddly
between *Legions* and *Minions*. **Warrens** is the same idea in the right register.
Either is fine; pick one and be consistent.

### 5.2 Seeded numbers — explicitly unbalanced

These exist so the game runs. They are not balanced and must not be treated as
balanced. `packages/content/src/v1/generators.ts` holds them.

| Tier | Yield | Cycle | Base cost | Cost rate |
| --- | ---: | ---: | ---: | ---: |
| Minion | 15 Evil | 24s | 90 | 1.089 |
| Slum | 100 Minions | 60s | 1,500 | 1.100 |
| Dark Legion | 10 Slums | 150s | 25,000 | 1.112 |
| Fortress | 5 Legions | 360s | 400,000 | 1.125 |

Minion values come from the reference docs. Legion and Fortress values are unset in
every reference doc and are invented here.

**Cost rate varies per tier deliberately.** The reference docs use 1.089 for
everything, which makes every tier feel identical. AdCap varies it per business for
exactly this reason.

`cost(n) = floor(baseCost × rate^n)`. Bulk cost sums the individual next-costs.
A closed form may replace the loop only if it is tested against the loop.

### 5.3 Milestones

Owned-count milestones at 25, 50, 100, 200, 300, 400 each double that tier's output.
**This is what actually drives the buy loop** — without it the rail is arithmetic. The
next milestone and its distance must be visible on every rail row.

### 5.4 Prestige — Damned Souls

`souls = floor(K × sqrt(lifetimeEvil / SCALE))`, seeded `K = 150`, `SCALE = 1e11`.
Each soul adds +2% to a global production multiplier, additively.

- **Reset clears:** Evil, generator counts, cycle progress, milestone multipliers.
- **Reset keeps:** souls, soul-purchased upgrades, achievements, unlock flags,
  lifetime statistics.

Target: first prestige within a few hours. `K` and `SCALE` are for the harness to
tune, not for anyone to guess at.

### 5.5 Smite

The tap verb. Yields Evil worth roughly 3 seconds of current production, floor 1. It
matters for the first ten minutes and then does not, which is the intent. It is never
an upgradeable path.

### 5.6 Balance harness

`packages/engine/scripts/harness.ts`. Runs the engine headless with a scripted buying
policy and reports time-to-first-prestige and time-to-first-of-each-tier. Roughly
forty lines, and it turns balance from guessing into measuring. Build it in M1, not
M4 — it is what tells you the seeded numbers are wrong.

---

## 6. Interface

`ui-sensibility.md` is normative. Three things it forces that the genre normally gets
wrong:

**Stage — the chain, alive.** Five nodes: Fortresses, Legions, Slums, Minions, Evil.
Each carries a count and a ring sweeping its cycle. On completion the ring snaps and
motes travel down the link to the next node. When a Slum fires you *see* a hundred
minions pour into the Minion node and the Minion ring quicken. No game in the genre
shows its own cascade. This one does, and it is the reason the diagram beats a list.

**Rail — one accent, always.** `ui-sensibility.md` §3 forbids five equal buttons; the
genre's scrolling list is nothing else. Every generator sits in the rail at secondary
weight, and **the single best available purchase is lifted out and accented**. One
primary action, always, and always the right one. The full list stays for players who
want to disagree. Buy quantity (×1 / ×10 / ×100 / max) is a sticky global toggle.

**Reduced motion needs real design here.** This game is motion. Rings jump instead of
sweeping, motes fade in place instead of travelling, numbers still roll. Nothing that
shows under normal motion may go missing (§8).

Also required:

- Tokens run three tiers with semantic names. One theme block, forced dark. The
  token-parity test from §4.2 stays — it costs nothing and pins the contract.
- Number formatting is one shared function. Standard notation to 1e6, then
  short-scale names, then scientific past the point names get silly. It is one of the
  most-read pieces of text in the game.
- The offline-return summary is a real screen, not a toast. It is the reward for
  coming back and it must name what happened per tier.
- **Placeholder art is a manifest, not a gap.** `content` maps each tier to an art
  slot, and every slot has a generated SVG fallback, so the game looks finished with
  zero image files. Adding real art later is copying files and editing one map.
  Nothing in the build may ever depend on the Draw Things lab being reachable — see
  `docs/reference/local-art-generation.md`.

---

## 7. Testing

Vitest. The engine carries the weight; the web app gets a thin layer.

Required engine tests:

1. **The 120-second golden** (§4.3), asserted number for number.
2. **`step(step(s, dt), dt)` equals `step(s, 2·dt)`** for any dt below the shortest
   cycle. This one property kills the whole compound-effect bug class.
3. **Offline equals online.** One batched hour equals 36,000 live steps, exactly at
   100ms and within the declared tolerance when coarsened.
4. **Order independence.** Shuffle tier iteration order, get identical state. Proves
   the snapshot actually holds.
5. **Cost curve goldens**, including bulk cost against the summed loop.
6. **Save round-trip and migration**, including a save two versions old.
7. **Offline cap clamping**, including a backwards wall clock.

Web tests: the token-parity test, the reduced-motion branch of each animated
primitive, and the number formatter across magnitudes.

The balance harness is a script, not a test. It must never gate CI.

---

## 8. Route

| Milestone | Content |
| --- | --- |
| **M0** | Monorepo, toolchain, CI green, private repo pushed. *Delivered with this spec.* |
| **M1** | Engine complete for Minions and Slums: fixed step, costs, purchase, save, offline, harness. Every test in §7. **No UI at all.** |
| **M2** | Chain diagram and rail, one screen, local save. First build anyone else can touch. |
| **M3** | Four tiers, milestone multipliers, prestige, achievements. |
| **M4** | Art slots, sound, offline summary, number formatting, the writing pass that carries the tone. |
| **M5** | Public web build. Posted to r/incremental_games. |
| **M6** | *Conditional on traction.* Tauri for Steam. Laravel meta-plane only if cloud save becomes a demand. |

**M1 before M2 is the one sequencing rule to defend hardest.** The engine is the whole
game, it is fully testable with no interface, and every hour spent on UI before it is
correct is an hour spent on a moving foundation.

---

## 9. The meta-plane, when it arrives

Not in v1. Recorded so M6 does not get redesigned from scratch.

Laravel + Filament, governed by `architectural-sensibility.md` in full. It owns
accounts, save-blob sync, balance-config publishing with audit, player inspection,
purchase receipts and analytics. **It never simulates.** The client remains the only
place the game runs.

Two things it adds cheaply once it exists: server time, which closes the clock-forward
hole in §4.6 with no engine change; and save verification by replay, which the
determinism rule in §4.4 already makes possible.

---

## 10. Open questions

Answer these during implementation. None blocks M1.

1. **Slums or Warrens** (§5.1). Pick one in M1 so no content is written twice.
2. **Legion and Fortress values** (§5.2) are invented. The harness decides them in M1.
3. **`K` and `SCALE` for souls** (§5.4). Same — the harness decides.
4. **Offline cap upgrade curve.** How far past 4 hours can it go, and at what cost?
5. **Achievements**: cosmetic, or do they grant multipliers? Cosmetic is simpler and
   AdCap grants multipliers. Decide before M3.
6. **Where does the writing live?** Copy belongs in `content`, but a tone this
   specific may want its own authoring pass rather than inline strings.
