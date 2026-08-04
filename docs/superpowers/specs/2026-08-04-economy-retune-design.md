# Economy Retune — Design Spec

**Date:** 2026-08-04
**Status:** approved, ready for planning
**Amends:** `2026-08-03-dread-majesty-design.md` §4.7, §5.2, §5.4, §5.6, §7

---

## 1. Why

The first playable build showed four faults, all in the numbers rather than the code.

1. **Cost keys off holdings, so produced units price their own tier out of the game.**
   `cost(n) = base × rate^owned`, and `owned` counts units the cascade made. At 500
   Minions the next Minion costs about 9×10¹⁸ Evil. The bottom rail row is decoration
   by minute thirty.
2. **The run is too long to show anybody.** First Fortress at 2h 37m. The audience for
   this build is people who have never played the genre and will give it an evening.
3. **A reset is not worth taking.** Ten souls, ×1.2, and about 66 minutes of nothing to
   buy the first Warren back.
4. **An Overseer is a convenience fee, not a purchase.** It automates and nothing else,
   so appointing one never feels like power.

This spec fixes all four and adds a fifth tier. It changes no engine rule — the five
rules in `CLAUDE.md` all hold, and the 120-second golden of §4.3 must pass untouched.

**It is the first of four.** B is Smite as a system, C is stage and rail polish, D is
the guided tour. A comes first because B and D both describe the loop this spec
changes.

---

## 2. Cost keys off purchases

`TierState` gains `purchased: Decimal`.

| Reads `purchased` | Reads `owned` |
| --- | --- |
| `costOfNth`, `nextCost`, `bulkCost`, `maxAffordable` | production, milestones, the chain display, achievements |

A purchase raises both. A cascade raises only `owned`. Nothing else moves — the cost
formula, the per-tier `costRate` and the tuned curve all keep meaning exactly what they
meant, and the tier below stays buyable for the whole run.

**Why not lifetime or run Evil.** Pricing off a resource throws away the per-tier
`costRate`, which §5.2 calls the main brake on the cascade. Every tier would then move
together and the rail would stop being a choice.

`purchased` is a `Decimal` like every other count, per rule 5.

---

## 3. Overseers become a roster

### 3.1 Shape

`TierDef.overseerCost: string` becomes `TierDef.overseers: readonly OverseerDef[]`.

```ts
type OverseerEffect =
  | { kind: 'automate' }
  | { kind: 'quicken'; factor: number }  // effective cycle = cycleMs / factor
  | { kind: 'swell'; factor: number };   // effective yield = yield × factor

interface OverseerDef {
  readonly id: OverseerId;
  readonly name: string;
  readonly cost: string;
  readonly effect: OverseerEffect;
}
```

Three per tier, in this order: one who automates, one who quickens, one who swells.
Fifteen across five tiers. Cost climbs within a tier.

`OverseerId` joins `ids.ts` as a union of literals with an `isOverseerId` guard and an
`OVERSEER_IDS` list, exactly as `TierId` is done. A typo must fail typecheck.

`OverseerDef` carries `name` because `TierDef` already carries `name` and `plural`, and
the engine reads neither. Longer flavour stays in `copy.ts`.

### 3.2 State

`GameState.overseers` becomes `Record<TierId, readonly OverseerId[]>` — the posts
filled, in content order.

- `isAppointed(state, tierId)` means the automator is in post. Every existing caller
  keeps working.
- `appoint` takes an `overseerId`, not a `tierId`. It refuses a post already filled, a
  post the player cannot pay for, and a post over a tier whose `unlocked` flag is
  false.
- Appointments within a tier may be taken in any order. Quickening a tier nobody
  automates still quickens it; the player just has to keep rousing it.

### 3.3 Effects in `step`

```
effective cycle = tier.cycleMs / product of quicken factors
effective yield = tier.yield × product of swell factors
```

Both derived per tier per slice from the appointed list. Factors are content numbers,
converted to `Decimal` at the point of arithmetic; `cycleMs` stays a plain number,
because it is time and not a resource.

**Factors are ×2 and must keep every effective cycle a whole number of seconds.** The
harness runs 1s slices and depends on it (§5.7).

### 3.4 A reset takes them all

`overseers` comes out of `prestige`'s `carried` object. Fifteen appointments to
rebuild every run, fast once souls are paying.

This reverses §5.6, which kept them on the AdVenture Capitalist precedent. The
precedent held while an Overseer only automated: nobody wants to re-buy convenience.
It stops holding now that an Overseer is power. Losing one costs output, so re-earning
it is the spine of a run rather than a tax at the start of one.

---

## 4. A fifth tier, and the cliff

**Thrones** produce Fortresses. The chain becomes:

```
Thrones → Fortresses → Dark Legions → Warrens → Minions → Evil
```

A choir of angels used with a straight face, and a seat of power that raises keeps.
Everything below keeps its role, its name and its place.

The retune also aims at the 30m→1h jump §5.2 flags as a rough edge — about 1,100× as
the first Dark Legion lands. Generous yields and purchase-based costs leave more room
to soften it than the first pass had.

**The target, restated, because the old one measured the wrong thing.** This section
first asked for no single stretch between adjacent harness checkpoints worth more than
about 100×, and it has twice been read as decades per hour without the section being
amended — a target everyone privately agreed to ignore, carried in §5.2 with a ✗ against
it. The raw ratio is not a measure of the game. The checkpoints are spaced from fifteen
minutes to four days apart, so a raw ratio mostly reports **the spacing**: 1h→2h shows
9.1e3 across one hour and 3d→7d shows 110× across ninety-six, and the calmer-looking
number is the faster-growing hour by a factor of sixty.

**The metric is growth normalised by interval length — decades per hour.** Take
`log10(end ÷ start)` and divide by the hours between the two readings. That is
comparable across every row of the table, and it is what "the game accelerates too
sharply here" actually means. Target: **no stretch above about 5 decades per hour after
the first quarter hour.** Inside the first quarter hour there is no target yet — see
below, where the number that would have to justify one is measured for the first time.

That threshold is read off a build judged to read well, so it is a description promoted
to a target rather than a figure derived from anything. Worth saying out loud, because it
is exactly what went wrong with the 100× it replaces. What would falsify it is the first
build that clears it and still feels wrong.

Measured against the shipping content:

| Stretch | Evil/s raw | Evil/s dec/hr | Lifetime dec/hr |
| --- | ---: | ---: | ---: |
| 0→5m | 6× | 9.34 | — |
| 5m→15m | 5.0e4 | **28.17** | **26.59** |
| 15m→30m | 10.2× | 4.04 | 7.59 |
| 30m→1h | 5.8× | 1.53 | 2.05 |
| 1h→2h | 9.1e3 | 3.96 | 3.64 |
| 2h→4h | 1.2e4 | 2.04 | 2.26 |
| 4h→8h | 6.3e4 | 1.20 | 1.26 |
| 8h→12h | 72× | 0.46 | 0.55 |
| 12h→1d | 426× | 0.22 | 0.25 |
| 1d→3d | 1.7e3 | 0.07 | 0.08 |
| 3d→7d | 110× | 0.02 | 0.03 |

Lifetime Evil has no 0→5m row because it starts at zero and a ratio from zero is not a
number.

Read this way the 4h→8h stretch §5.2 used to flag at 6.3e4 is the fifth calmest hour of
the run, and the steepest by a wide margin is the opening — **not evenly, either.** The
first five minutes run at 9.34 and the next ten at 28.17, so the acceleration sits in the
5m→15m stretch: the Taskmaster lands at 9m 57s, the first Warren at 10m 53s, and the
Minion count crosses three milestone rungs in between. **None of that was measured until
this run**, because 15m was the instrument's floor. That is why §5.7's harness now
carries a 5m checkpoint, and it is why the opening has a reading here rather than a
target: 28 decades an hour may be exactly right for the stretch where a player is meant
to feel the ground move, and nobody has yet played it and said.

**One caveat, and it matters.** Evil per second is a rate. On **lifetime Evil** — the
total the player actually watches climb — the ordering after the opening is different:
it peaks at 15m→30m at 7.59 decades an hour against 3.64 at 1h→2h, so the target of 5 is
cleared on the rate and missed on the total. Both readings are real and neither replaces
the other. A claim about the cliff has to say which one it is measuring.

---

## 5. Numbers

### 5.1 Yields go up, cycles and costs come down

A Warren breeds — it should pour out Minions, not hand over one. It yields five, and
that is the shape this section was written for: raise what a unit hands over, and let
the cycle length and the cost curve stop it detonating. With §2 in place the cost curve
finally works.

**Above the Warren the rule reversed, and §5.8 is why.** A Dark Legion now takes one
Warren's worth of ground every ten minutes, a Fortress raises one Legion a half hour and
a Throne one Fortress an hour and a half. Only the Warren still yields several.

That is not a retreat from the paragraph above; it is the same paragraph applied to a
constraint that did not exist when it was written. The obsolescence point of a tier is a
*count* of the tier above it (§5.8.1), so what one unit of the producer hands over sets
how few of them it takes to retire the tier below. Generous yields at the top meant two
Warrens retiring the Minion and four Dark Legions retiring the Warren — the tier above
killing the tier below on its opening units, which §5.8 forbids. Cutting the yield and
buying the throughput back through the cost curve keeps the chain's pace and moves the
crossing to where the rule wants it: 42 Warrens, 33 Legions, 39 Fortresses, 44 Thrones.

The Warren keeps its five because nothing retires the Minion too early once the Minion's
own curve is flat, so the count is bought there rather than here.

### 5.2 Targets

Tuned and measured. "Measured" is what `pnpm harness` reports for the shipping content;
"Before" is the same harness against the placeholder numbers at `37f645b`; "First fit"
is the retune as it stood before §5.8's obsolescence rule was measured and the numbers
were refitted around it.

| | Target | Before | First fit | Measured |
| --- | ---: | ---: | ---: | ---: |
| First Warren | ~12m | 26m 33s | 11m 53s | **10m 53s** |
| First Dark Legion | ~35m | 54m 21s | 33m 53s | **39m 35s** |
| First Fortress | ~1h 10m | 1h 54m 29s | 1h 08m 55s | **1h 14m 37s** |
| First Throne | ~2h | 3h 55m 29s | 2h 00m 05s | **2h 03m 09s** |
| First prestige | ~45m | 1h 36m 49s | 45m 03s | **41m 11s** |
| Souls at first reset | 40–50 | ~10 | 40–50 at 1h 30m | **40–50 at 1h 47m** |
| Steepest stretch after 15m, Evil/s | under ~5 dec/hr | — | — | **4.04 dec/hr** |
| Steepest stretch after 15m, lifetime Evil | under ~5 dec/hr | — | — | **7.59 dec/hr** ✗ |
| Steepest stretch inside 15m, Evil/s | no target yet | — | — | 28.17 dec/hr |
| Largest raw jump between checkpoints | superseded, see §4 | 1.3e4 | 3.0e4 | 6.3e4 |

All five arrival times land, none further than a seventh from its target and all well
inside the fifth §5.2 allows. The souls row needs its reading stated: at the moment a
reset first becomes possible the gain is one soul by construction, and nobody would take
it. The 40–50 the row asks for arrives at about 1h 47m, and that is the first reset
worth taking. The two cannot be set apart — `k` and `scale` enter the formula only as
`scale/k²`, so fixing when the first soul lands fixes how many every later moment pays.

The five times moved by a few per cent between the first fit and the measured column,
and that is the price of §5.8. The obsolescence rule is fitted to counts of the tier
above, which meant flattening every cost curve and cutting what one unit of each
producer hands over; the base costs were then refitted to bring the arrival times back
inside their bands. The obsolescence points themselves are in §5.8 and in the note on
`v1` in `packages/content/src/v1/generators.ts`.

**The cliff rows now report what they measure, and one of them is still missed.** §4
restates the target in decades per hour, so the old raw-ratio row is kept only as
history: it mostly measured how far apart the checkpoints are, and the three builds under
it were never comparable in the first place. The two earlier builds have no entry against
the new metric because nobody recorded one, and inventing them from a raw 4h→8h ratio
would be the same mistake again.

On **Evil per second** the shipping build clears the target: the steepest stretch after
the opening quarter hour is 15m→30m at 4.04 decades an hour, and the 4h→8h stretch that
reads as 6.3e4 raw is the fifth calmest hour in the run at 1.20. On **lifetime Evil** it
does not: the same stretch measures 7.59, against a target of 5. Both readings are real
and they disagree about which build is steep, which is why §4 now says which one a claim
is measuring. **Left missed on the total, hit on the rate**, and not reconciled.

The opening row carries no verdict on purpose. The 5m checkpoint added to §5.7's harness
measured it for the first time, at 28.17 decades an hour across 5m→15m, and §4 explains
why that is a reading rather than a failure.

Some of that is the arithmetic of the rest of this table — the run has to climb from a
thousand Minions at 15m to a five-tier cascade by 2h. The rest is §5.8 charged directly:
flat cost curves mean counts climb where prices used to, and counts are what the
milestone ladder pays on. See the note on `v1` for the one lever left — the milestone
tail rung — and why it was not pulled.

**These were targets, not numbers.** `pnpm harness` set the numbers. Any figure in this
section that the harness contradicts is wrong, and the harness wins.

### 5.3 Souls arrive in bulk

`prestige.scale` retunes so the first reset worth taking pays 40–50 souls, which the
harness puts at about 1h 30m. `perSoul` stays at 0.02, so 45 souls reads as ×1.9.

Ten of something reads small whatever it multiplies by. Forty-five reads like a haul,
and it is the same multiplier.

**`k` and `scale` are one lever, not two.** Souls are `k·√(lifetime/scale)`, which is
`√(lifetime / (scale/k²))` — only the ratio has any effect, and `k` alone changes nothing
a player can see. Fixing when the first soul lands therefore fixes how many souls every
later moment pays. §5.2's first-prestige row and this one are the same setting read at two
moments: one soul at 45m, forty-five at 1h 30m.

### 5.4 The harness

Its policy gains the roster: appoint whatever post the last purchase left change for,
cheapest first, after the buying pass — the ordering §5.7 already fixes. It reports
when each of the fifteen first comes within reach.

The policy is the instrument's calibration. Changing it moves every number in §5.2, so
it is recorded here and changed deliberately.

---

## 6. Old saves are refused

This retune breaks every save written before it. `purchased` has no honest value to
migrate to, the roster has no equivalent, and the numbers underneath have all moved.

**Policy, standing rather than one-off:** `save.ts` gains
`MIN_SUPPORTED_SAVE_VERSION`. A save below it is refused with a typed
`ObsoleteSave` error, and the app says so plainly — *this save is from an early
development build and no longer loads* — rather than starting fresh in silence, which
is what `useGameSession` does today.

The migration machinery stays, and so does the test that a save passes through it. The
table itself is empty for now — the floor equals the current version, so every save
this build accepts is already current, and the version 1 to 4 migrations go with the
saves they served. The floor moves only when a change genuinely cannot be migrated, and
moving it is a decision somebody writes down.

This amends §4.7's "a save two versions old must load". That rule was written for a
shipped game. This one has two players on four devices, and pretending otherwise costs
real work to preserve nothing.

---

## 7. Interface changes this forces

Small, and all of them follow from the above. The wider polish is spec C.

- **Miscreants** lists three posts per tier instead of one, grouped by tier, each with
  its own name, cost, effect and note. `OverseerCopy.names` and `.notes` re-key from
  `TierId` to `OverseerId`.
- **The prestige panel** gains two readings: how long this run has lasted, and roughly
  how long until the next soul at the current rate. Both come from state the session
  already holds. Neither extrapolates a growth rate.
- **`railPlan`** already lifts the single best spend across purchases and appointments;
  it now weighs fifteen appointments rather than five.
- **Every tier row** shows the count it owns and, where they differ, the count it has
  bought — because that is now what sets the price and the player must be able to see
  it.

---

## 8. The dev jump bug

`apps/web/src/dev/jumps.ts:48`. `board()` writes `spec.owned?.[id] ?? 0` over every
tier, which wipes the free Minion `createState` grants. The "N souls banked" jumps pass
no `owned` map, so they land on 0 Minions and 0 Evil with nothing to rouse and nothing
producing — a board the game cannot leave.

A tier the spec does not name keeps whatever `createState` gave it. One line, and a
test that every jump in the list builds a state the player can act from.

---

## 9. Tests

**The 120-second golden must pass untouched.** It runs on fixture content with no
Overseers and one purchase, so nothing in this spec should reach it. If it moves, the
retune broke the simulation and everything stops until it does not.

New engine tests:

1. Cost reads `purchased`, not `owned`. Cascade a tier's count up and assert its next
   cost has not moved.
2. A purchase raises both counts; production raises only `owned`.
3. Quicken and swell compound within a tier, and one appointed without the automator
   still applies.
4. A quickened cycle stays a whole number of seconds for every tier in shipping
   content — a content test, guarding §5.7's harness.
5. `prestige` clears the roster and keeps souls, achievements, unlock flags and
   lifetime stats.
6. A save at `MIN_SUPPORTED_SAVE_VERSION - 1` throws `ObsoleteSave`; one at the floor
   loads.
7. Round-trip of a state holding a part-filled roster.

Web tests: every dev jump builds a state with something to do; the prestige panel's two
time readings; Miscreants renders a part-filled roster.

The harness stays a script and must never gate CI.

---

## 10. Not in this spec

- Smite decay, escalating cooldown, smite upgrades and the item shop. **Spec B.**
- Gold on an available smite, the thicker rail track, the Evil-toned pulse, ring
  completion pulses, segmented meters, the production rate line, the icon mechanism,
  tab chevrons, the surge layout shift. **Spec C.**
- The guided tour. **Spec D.**
- Soul-bought second Overseers (§10.4 of the main spec). The roster leaves room —
  `OverseerDef` could carry a soul cost — but nothing here spends souls.
