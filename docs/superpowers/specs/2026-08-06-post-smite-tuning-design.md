# Post-Smite Tuning — Design Spec

**Date:** 2026-08-06
**Status:** approved, not yet implemented
**Follows:** `2026-08-04-smite-as-a-system-design.md`, whose §8 deferred exactly this.

---

## 1. Why

Smite shipped and got played. Three complaints came back, and measurement turned two
of them into different problems than they looked like.

- **The gold recommends the wrong thing.** Not "arguably" — measurably. A player who
  follows it ends a two-hour run with less than half the Evil of a player who buys the
  biggest thing they can afford, on the same one-purchase-per-second budget.
- **The shop has no teeth.** Half a minute of income buys every smite upgrade in the
  game.
- **The rail lies about which count it is charging for**, which is what produced the
  reported "I had to buy 818 Minions before Warrens were worth it".

Plus a batch of interface work that had accumulated behind the smite branch.

**Everything here is measured.** Every number in §3 and §4 comes off the engine, and
the tables say which run produced them.

---

## 2. What is not in this spec

- **Re-fitting the generator economy.** Income runs 3.8e6/sec at 30m and 2.0e11/sec at
  2h — four decades in ninety minutes — and that steepness is a real complaint. It is
  also a much larger job: every figure in the retune spec's §5 table is written against
  the current curves, and moving them means re-running the harness per change. The
  decision is to give the shop teeth first, play it, and let that say whether the cliff
  still reads as a problem. See §8.
- **An unlock term in the ranking.** Cut deliberately; see §3.3.
- **The guided tour.** Spec D, and the reason this batch is being cleared first.
- **Any change to soul prices.** See §4.3 — the conclusion is that they are already
  right, and the reasoning is the interesting part.

---

## 3. The ranking

### 3.1 The horizon

`railPlan.HORIZON_SECONDS` moves from **600 to 7200**.

Every purchase is scored on Evil returned over the horizon. A Minion pays in four
seconds. A Warren pays through Minions, so its return over a window grows with the
window squared over two; a Legion, cubed over six. Ten minutes is short enough that the
immediate payer wins nearly always.

Measured. Three simulated players, each making **one purchase per second** for two
hours, differing only in what they buy:

| policy | 30m | 1h | 2h |
| --- | --- | --- | --- |
| follows the gold, H=600 | 1.28e9 | 1.49e10 | 5.49e13 |
| buys the biggest affordable tier | 1.73e9 | 1.97e10 | 1.15e14 |

Sweeping the horizon against the first policy:

| H | 30m | 1h | 2h |
| --- | --- | --- | --- |
| 600s | 1.28e9 | 1.49e10 | 5.49e13 |
| 1800s | 1.55e9 | 1.74e10 | 7.38e13 |
| 4800s | 1.70e9 | 1.98e10 | 1.15e14 |
| 7200s | 1.71e9 | 1.95e10 | 1.15e14 |
| 86400s | 1.72e9 | 2.00e10 | 1.15e14 |

It climbs to about 4800s and then flat-lines. **A plateau, not a peak** — the setting is
not delicate, which is the property that matters, because nobody will re-measure this
before shipping a content change.

7200 rather than 4800 because it is the one with a reason a comment can carry: **judge a
purchase over the length of a run, not the length of a sitting.** First prestige worth
taking lands near 1h47m.

The existing comment on the constant already retracts its ten-minute justification as
unmeasured and says the number "stands only because nothing has shown it wrong". Something
has now shown it wrong. The replacement comment must carry the table above, or a pointer
to this section, so the next person to touch it inherits the measurement rather than the
guess.

### 3.2 Which count the price follows

Generator prices key on `gens[id].purchased`. The count on the row, and the milestone
multiplier, key on `gens[id].owned`. Warrens breed Minions, which raise `owned` and never
touch `purchased`.

So the ranking flips to Warren at **405 bought Minions**, while the player reads 818 on
screen. The rail was arithmetically consistent throughout; the number being read was not
the number being priced.

**The row already prints both.** `rail__bought` renders `copy.rail.bought` — "406 bought"
— whenever `purchased < owned`. What is missing is the tie between that line and the
price beside it. So this is a copy and labelling change, not a new readout:

- `copy.rail.bought` says that the price follows this count, not the held count.
- The buy button's spoken label (`buyLabel`) names which unit is being bought, so the
  connection survives for anyone reading by ear.

**No engine change.** Pricing on units bought is correct and standard, and every cost
curve in the content was fitted against it. Moving to `owned` would close the gap and
also invalidate the whole retune table, which §2 puts out of scope.

### 3.3 The unlock term, cut

`railPlan`'s header lists "it cannot value an unlock" among its stated blind spots: the
first unit of a new tier opens a rung of the chain, which is worth more than its
production for a long while afterwards. Adding a term for it was in the original scope.

**It is cut.** The sweep in §3.1 shows the horizon change alone brings the gold level with
"buy the biggest thing you can afford". An explicit unlock bonus on top would double-count
the same effect, and the failure would be silent — a rail that over-recommends new tiers
looks exactly like a rail that values them correctly.

The blind spot stays documented and unfixed, which is honest. If play after this batch
still shows new tiers arriving unremarked, that is the evidence to revisit it with.

---

## 4. The shop

### 4.1 The disease, stated once

Best play, measured over three hours:

| t | lifetime Evil | Evil/sec |
| --- | --- | --- |
| 15m | 2.03e7 | 3.71e5 |
| 30m | 1.73e9 | 3.82e6 |
| 45m | 6.71e9 | 7.77e6 |
| 60m | 1.84e10 | 2.25e7 |
| 90m | 2.41e11 | 6.05e8 |
| 120m | 7.93e13 | 2.00e11 |
| 150m | 2.03e15 | 3.14e12 |

Lifetime Evil spans **×3.9 million** between 15m and 2h.

The smite ladder spans ×1,728 — four rungs at ×12 each. **It is roughly 2,000× too
shallow to cover the run it lives in.** That is why a flat price rise buys minutes and no
more: multiply every rung by a thousand and the ladder still only covers a slice of the
curve, just a later slice.

Generator prices do not have this problem, because they climb geometrically with the
count bought. The shop is the only part of the economy priced in constants, and it is the
only part that feels broken. **The fix is slope, not level** — though the level moves too,
and §4.2 says why.

### 4.2 The smite ladders

Rung ratio **×12 → ×200**. Per-ladder offsets stay at **1 : 2 : 4 : 6** (Reach cheapest,
so the first thing bought is still the one that teaches the system — smite spec §3.4).
Reach rung 1 is set so it lands near 17 minutes.

| Ladder | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Reach | 3e6 | 6e8 | 1.2e11 | 2.4e13 |
| Weight | 6e6 | 1.2e9 | 2.4e11 | 4.8e13 |
| Forgetting | 1.2e7 | 2.4e9 | 4.8e11 | 9.6e13 |
| Restraint | 1.8e7 | 3.6e9 | 7.2e11 | 1.44e14 |

Rung values (what each rung *does*) are untouched. Only prices move.

Both the level and the slope change, and they fix different things. **The level** — Reach
rung 1 from 5e3 to 3e6 — is what stops rung 1 being free the moment it appears. **The
slope** is what stops the whole tree costing 32 seconds of income.

Where this lands, read against the curve in §4.1:

- Rung 1 near **17m**. The shop still opens inside the first run, which smite spec §3.4
  asks for.
- Rung 2 near **75m**.
- Rung 3 at the **very end of run one**, as a stretch.
- Rung 4 **past it**.

Whole-tree cost moves from **32 seconds of income at 30m to about 26 minutes at 2h**.

`climbGrowth` stays at **3**. It is doing a different job — re-pricing the ladder for the
next run — and nothing measured suggests it is wrong.

**A limit worth writing down rather than discovering later.** No finite ladder priced in
Evil stays meaningful against an exponential curve. Four rungs can be a real decision
*during the window they are designed for*, and that is all they can be. `climbGrowth`
re-prices them for run two; souls are the only permanent route. This is a property of the
shape, not a number anyone can tune.

### 4.3 Souls, unchanged — and why that is the interesting part

Keep prices stay at **8 / 20 / 50 / 120** souls per rung, flat by rung, on every ladder.

The question this spec was asked was whether steepening the climb recalibrates them. It
does not, and the reason is worth stating because it reverses an earlier reading.

Keep looked like poor value under the old prices, and it was: 8 souls costs about 8.4% of
production for ever, and it saved 5,000 Evil. **The error was thinking Keep buys you Evil.
It buys you time.** A kept rung is in your hands from the first second of a run instead of
minute 75. Once a rung takes 75 minutes to climb, 8 souls to start holding it is a real
trade against a run that is decided in its first hour.

So the reprice is what makes Keep worth buying, without Keep's price moving at all.

Keeping stays sequential — `canKeep` requires `smiteKept[id] < smiteRungs[id]`, and the
floor rises one rung at a time — so carrying a ladder to rung 2 costs 28 souls. A first
reset pays 40–50, which buys one ladder held at rung 2 and another at rung 1. That is a
choice, which is the point.

### 4.4 The Overseers

Within a tier, the three posts move from **×1 / ×4 / ×16** of the automator's price to
**×1 / ×20 / ×200**.

The automator's own price stays at **0.4× the next tier's base cost**. Its times are good
— each tier's automator still comes within reach before the tier above does, which is the
trade the design spec §5.6 wants weighed — and it is the load-bearing post. Only `quicken`
and `swell` move, which is what play reported.

| Tier | automate | quicken | swell |
| --- | --- | --- | --- |
| Minion | 1200 | 2.4e4 | 2.4e5 |
| Warren | 2.4e7 | 4.8e8 | 4.8e9 |
| Dark Legion | 2.4e8 | 4.8e9 | 4.8e10 |
| Fortress | 6.4e11 | 1.28e13 | 1.28e14 |
| Throne | 1.6e15 | 3.2e16 | 3.2e17 |

The Throne has no tier above to price against, so it extrapolates the same ratio, exactly
as the current file does.

This moves the Warren's Mistress and Broodkeeper from roughly 47m and 67m to roughly 75m
and 100m, spreading them across run one instead of clustering them in its first hour.

The Fortress and Throne rows are deliberately beyond a first run. They already were.

---

## 5. Interface

### 5.1 The Apathy arc

`ApathyTicks` becomes **`ApathyArc`**: `CYCLE_SEGMENTS` segments curved around the Evil
medallion, drawn as a custom SVG, replacing the row of spans beneath the strike control.
The rename is not cosmetic — the naming rule is that a component is named for what it
shows, and a file called `Ticks` drawing an arc is the kind of drift nobody fixes later.
Its test file and stylesheet move with it.

Two things this must not become. It must not go **inside the tap target** — the strike
control is the stage's one accented thing and already carries a live number, and on a
phone a finger covers the gauge at the moment it moves. And it must not hang **beside**
the button, which is centered and pinned; a widget on one edge either pushes the medallion
off-center or eats the tap target on a narrow screen. The arc is inside the control's
visual boundary and outside the part anybody presses, which is what makes it the answer.

Everything the current component's doc establishes survives and must stay true of the arc:

- **A share of the cap, never a count of it.** Raising `apathy.cap` from 3 to 6 stays a
  content edit that moves nothing here.
- **Upward bound.** `Math.ceil(share * CYCLE_SEGMENTS)`, deliberately the opposite of the
  flooring `quantise` does for cycle rings, and for the reason already written down: a
  ring reports elapsed progress and must not overclaim; this reports where a level stands,
  so a segment owns the band beneath it. Flooring made the top segment unreachable in
  practice.
- **Always mounted and empty at rest**, so nothing moves when it fills.
- **It prints no number.** The label carries which of the three bands the realm is in.
- **No reduced-motion case.** Segments are discrete; there is no sweep to strip. The arc
  must not introduce one.

### 5.2 Prestige, findable

Two changes, and only the second one addresses what actually happened in play.

**A placeholder holds the slot.** Before `isPrestigeWorthShowing` returns true, a card of
the same size sits where the panel will, reading **"Inflict further suffering."** — the
same shape as every other locked state in the game, which says what to go and do rather
than what is missing. This follows the rule the interface already keeps everywhere else —
placeholders in place, sized to the content, nothing rebuilding to show it arrived — and it
stops the panel shoving the page down once a session.

**The panel announces itself when souls are first owed.** This is the real fix. The
reported failure was at a point well past the reveal threshold, with the panel already
rendering: it sits below a deck with a tall floor height, which on a phone is a long
scroll past the fold. A panel nobody scrolls to is not on screen.

The marker shows exactly while **`prestigeGain(state, content) > 0` and
`state.stats.prestiges === 0`**. That condition is derived wholly from state the game
already holds, which matters more than it looks: the obvious alternative is a
"dismissed" flag, and a flag has to be persisted or it comes back on every reload, and
persisting it means a save migration for a piece of interface chrome. Deriving it costs
nothing and cannot desynchronise. It also scopes the fix to the player who actually has
the problem — after a first reset, nobody needs telling where the button is.

The announcement is **not the accent**. The stage and the open deck panel each already
carry one, and §3 of the interface rules gives a region one.

### 5.3 Deck tabs

A shut tab holding something affordable gets a **small neutral dot**.

**Never the accent.** `Deck.tsx` states the rule and the reason: the accent is spent on
doing, never on going, and tabs are navigation. A dot in a neutral-bright tone says
"something here" without claiming to be the thing worth pressing.

The dot reads off the existing `RailPlan` — a panel has something affordable exactly when
its entry in `plan.best` is non-null — so nothing new has to be computed. The mapping is
muster → `best.purchase`, miscreants → `best.appoint`, malice → `best.climb`. **The deeds
tab never carries a dot**, and that is right rather than an omission: deeds are a record,
not a spend, and there is nothing there to press.

### 5.4 Prestige copy

The kept line currently reads "Your souls, your deeds, and everything you have unlocked."
It is wrong in two ways that matter, and both cost the player real power without warning:

- **Overseers do not survive a reset.** Design spec §3.4 reversed the old rule
  deliberately, because a roster is power rather than a record.
- **Smite rungs climbed with Evil do not survive.** Only rungs bought with souls do.

Neither appears in the copy, and "everything you have unlocked" reads as covering both.

Both lines are rewritten. The kept line names souls, deeds, which tiers you have seen, and
the ranks you paid souls to keep. The taken line names the Overseers and the unkept ranks
out loud, alongside the Evil, the generators and the milestones it already names.
`confirmBody` carries the same correction — it repeats the claim verbatim.

### 5.5 The rail row loses "Appointed"

The `rail__flag--overseen` badge comes off `TierRow`.

`TierRow`'s doc comment currently argues *for* it — "what is left on the row is one word
saying whether anybody holds this one". That paragraph is rewritten rather than left
contradicting the code. Removing the badge also removes the row's only use of
`isAppointed`, so the import goes with it.

### 5.6 The rail bar shows milestone progress

The row's `Meter` currently sweeps **cycle** progress, and a separate line beneath it
prints "12 more Minions for ×2 at 800". The bar takes over the milestone job and the
printed line goes.

**Nothing is lost by dropping the cycle sweep.** `CycleRing` on the stage already draws
cycle progress for every tier, so the row was showing it twice.

**The figures move rather than disappear.** Remaining, multiplier and threshold go into the
bar's accessible label and its hover title, so nothing becomes unreachable by ear or to
anybody who wants the exact number.

This needs one engine change. `MilestoneProgress` returns `next`, `multiplier`, `owned`
and `remaining`, but no previous threshold — so there is no span to fill against, and a
bar drawn from zero would read half full the instant a band opened. It gains:

```ts
/** The threshold last passed, or 0 before the first. The bar's floor. */
previous: number;
```

The bar then fills `(owned − previous) / (next − previous)`. Both terms are computed as
`Decimal` and only the resulting fraction is converted, because owned counts run past
`Number.MAX_SAFE_INTEGER` and the ratio never does. Past the last threshold, `next` is
null and the bar reads full.

---

## 6. Engine and content shape

**Engine.** One change: `MilestoneProgress.previous`, per §5.6. No other selector, intent
or state field moves. No save version bump — nothing serialised changes.

**Content.** Numbers only, in `packages/content/src/v1/generators.ts`:

- Sixteen `SmiteRungDef.evil` values (§4.2).
- Ten Overseer `cost` values — `quicken` and `swell` on all five tiers (§4.4).

`SmiteDef.climbGrowth`, every `SmiteRungDef.souls`, every automator cost, every generator
`baseCost`, `costRate`, `yield` and `cycleMs`, and the whole milestone ladder are
**untouched**.

**Copy.** `packages/content/src/v1/copy.ts` — the prestige kept/taken/confirm lines
(§5.4), `rail.bought` (§3.2), and whatever the milestone bar's label needs (§5.6).
`overseer.filled` stays in the copy module even though §5.5 stops rendering it; the
miscreants panel still uses it.

**Web.** `railPlan.HORIZON_SECONDS`, `ApathyTicks` → arc, `TierRow`, `Deck`, the prestige
panel and its placeholder.

The dependency direction is unchanged throughout: nothing here has the engine reaching for
content data, and nothing has the harness reaching for `railPlan`.

---

## 7. Testing

**Engine.** `milestoneProgress` returns `previous` — 0 before the first threshold, the last
passed threshold after, and correct across a tail rung where thresholds double. Fixtures
only; no shipping content.

**Content.** The existing ordering assertions extend to the new prices: smite rung prices
ascend within every ladder, and within a tier `automate < quicken < swell`. These stay
`Number(...)` comparisons — `packages/content` has no dependencies and must keep none.

**Web.**

- The horizon change moves a large number of existing expectations. They are updated to
  the new answers, not deleted. Any test that has to be *deleted* to go green is a finding
  to raise, not a step to take.
- One test pins the ranking outcome that motivated the change: at a state with Warrens
  affordable, `plan.best.purchase` is not the Minion row.
- The arc: `CYCLE_SEGMENTS` segments, upward-bound lighting, the top segment held just
  under the cap, mounted and empty at rest, no reduced-motion divergence.
- The milestone bar: fills within the band, reads full past the last threshold, and
  carries the figures in its label.
- The tab dot never carries the accent class.
- Token parity stays as it is.

**Harness.** `pnpm harness` after the content change, to confirm the generator times and
obsolescence points are unmoved. They should be: §4 touches no generator number. **If any
of them move, something was edited that this spec did not authorise.** The Overseer
reach-times in the file's header comment *will* move for `quicken` and `swell`, and that
comment is updated with the harness's new output rather than left stale.

The 120-second golden stays the anchor. If it fails, everything else waits.

---

## 8. What this leaves open

- **The generator economy's steepness.** Four decades of income in ninety minutes is the
  complaint underneath "I put my phone down for ten minutes and could buy six
  Fortresses". Deferred by decision, not by oversight. The evidence to revisit it with is
  play after the shop has teeth.
- **The ranking's remaining blind spots**, unchanged and still listed in `railPlan`'s
  header: it holds every other tier still, ignores cycle phase, is greedy rather than
  optimal, and cannot value an unlock (§3.3).
- **Soul-bought second Overseers**, still carried from the smite spec's §8.
- **Design spec §5.4 is stale** — it quotes `SCALE = 5e14` and a first soul near three
  hours, against a shipping `1.14e14` and 45 minutes. Not touched here because this spec
  changes no soul number, but it will mislead the next person who reads it.
