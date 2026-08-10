# The Soul Curve

**Status:** built
**Supersedes:** §5.4 of `2026-08-03-dread-majesty-design.md` (the prestige formula only)

Prestige compounds without limit. After two resets a playtest run reached ×634 to
everything and the game stopped being a game. This spec re-denominates Damned Souls so
the loop settles instead of diverging.

---

## 1 The fault

Two measurements against shipping content, both from the balance harness.

**A global multiplier is a time dilation.** A favour of ×2.46 over a three-hour run
produced 3.47M souls. An unboosted run reaches 3.64M souls at eight hours. So ×2.46 to
everything bought 2.67× the time. That is what "to everything" means when it multiplies
all five tiers of a cascade: every stage runs faster, and the stages compound.

**Souls grow as the ninth power of time.** Lifetime Evil goes as roughly T¹⁸ — five
tiers compounding — and souls are its square root. Measured on an unboosted run: 1 soul
at 1h, 17 at 2h, 687 at 3h, 6,254 at 4h, 3.6M at 8h.

Together: souls ∝ favour⁸·⁷, and favour is linear in souls. **Each prestige raises the
soul count to about the ninth power.** Playing three-hour runs back to back on today's
numbers:

| Run | Favour | Souls after |
| --- | ------ | ----------- |
| 1   | ×1     | 687         |
| 2   | ×14.7  | 2.3×10¹⁰    |
| 3   | ×4.6×10⁸ | the simulator died |

This is not a generous multiplier. It is a divergent one — there is no soul count at
which it settles. The reported playtest (579 souls, then 31,020 from a run one third as
long) is the same curve, milder only because a phone game is played imperfectly and the
four-hour offline cap bounds it.

The original §5.4 says a first reset should be worth **×1.7 to ×5.5**. Shipping gives
×12 at the first reset and ×634 at the second. Run two was never modelled.

## 2 The dial

Souls are `k · lifetime^q`. Favour is `1 + c · souls^p`. **Only the product `q×p`
decides whether the loop converges** — the split between the two exponents changes what
the player reads, not how the game behaves. Today the product is `0.5 × 1 = 0.5`.

Measured, eight prestiges of three-hour runs at three settings:

| `q×p` | Favour over runs 1→8                         | Verdict            |
| ----- | -------------------------------------------- | ------------------ |
| 0.15  | 1 → 2.9 → 39 → diverged                      | still broken       |
| 0.08  | 1 → 2.3 → 5.6 → 12 → 20 → 25 …               | drifts, no ceiling |
| 0.055 | 1 → 2.2 → 3.8 → 5.2 → 6.3 → 6.7 → 7.0 → 7.1  | settles            |

**The product must fall to 0.055.** That part is arithmetic. Where the cut lands is the
design choice, and it lands entirely on `q`: souls become rare, and favour stays linear,
so `globalMultiplier` is untouched and the panel keeps saying that each soul adds a flat
share to everything.

A flat exponent means the soul count spans a narrow range — about tenfold across a whole
day, where today's spans millions. That is a property of the curve and cannot be tuned
away. What it does *not* do is force the printed number to be small: the count is scaled
by `k`, and §3 sets `k` so souls read in the hundreds and thousands. A game of this genre
whose prestige currency reads `2` reads as broken, whatever the arithmetic underneath.

## 2.1 Depth, and why `q` is not a constant

The number 0.055 is not a property of prestige. It is `1/a`, and `a` is a property of the
generator economy. Anything that changes how steeply the economy grows moves the
threshold, and `q` has to move with it.

Adding tiers is the obvious worry and turns out to be the smaller one. Measured, by
truncating the chain from the top — real games, no invented content:

| Tiers | `a` over 2h→4h |
| ----- | -------------- |
| 2     | 3.7            |
| 3     | 13.9           |
| 4     | 17.0           |
| 5     | 17.0           |

**`a` saturates.** The fifth tier adds nothing: a Throne making one Fortress every ninety
minutes cannot compound fast enough to steepen the curve it sits on. Deep tiers extend a
run in time rather than making it steeper, so a ten-tier chain does not imply `a = 36`.

What deeper content does do is raise the ceiling, and this curve rewards that well.
Measured plateau at a fixed run length, four tiers against five: **×3.4 → ×6.4** (both
measured at `k = 1`, so the whole-soul flooring in §3 costs each figure a little; the
comparison between them is what matters). The plateau goes as `s₁·M^(a·q)`, a power of
what the content can reach,
so each tier added is worth roughly another doubling. This is the property that makes the
curve worth keeping: prestige pays more as the game grows, without anything being retuned.

A logarithmic curve — `souls ∝ log(lifetimeEvil)` — was considered and rejected on this
exact ground. It cannot diverge, which is attractive, but its plateau goes as
`s₁ + a·log M`: content adds a fixed amount rather than a factor. Measured over the same
four-to-five-tier step it gained ×4.5 → ×5.5, against the power curve's ×3.4 → ×6.4. It
buys safety by giving up the expansion the game is planned around.

**The real fragility is margin, not depth.** Stability needs `a·q·p < 1`. Measured `a` is
17.0 over 2h→4h and 18.4 over 4h→8h, so at `q·p = 0.055` the product sits between 0.94 and
1.01 — on the line. The loop converges anyway, at four tiers and at five, because `a`
itself falls as a run lengthens (14.2 over 8h→12h) and favour dilates time into that
calmer stretch. **The design is stable because the economy saturates, not because the
exponent is comfortably below the threshold.**

That is a real dependency and it must be written down rather than discovered again:

- `q` is derived, not chosen. The rule is `q < 1/a`, where `a` is the measured growth
  exponent of lifetime Evil over the window players actually play.
- Any change to generator pacing — cost curves, cycle times, milestone rungs, Overseer
  factors — can move `a` and therefore invalidate `q`. Deeper content is the case to watch
  hardest, because it holds `a` high for longer rather than raising its peak.
- The prestige-loop harness run in §6 is the standing guard, and it is the only thing that
  can catch this. It must be run whenever the economy is retuned, not only when prestige
  is touched.

## 3 The formula

```
souls = floor(k · ((lifetimeEvil / scale) ^ exponent − 1)),  floored at zero
```

`{ k: 600, scale: '5.07e9', exponent: 0.055, perSoul: 0.001 }`, replacing
`{ k: 150, scale: '1.14e14', perSoul: 0.02 }`.

`scale` is unchanged in meaning and holds the same moment it always held: 5.07e9 is the
lifetime Evil at 41 minutes, and the offset is what keeps that true.

**The `− 1` is not cosmetic, and leaving it out shipped a broken build.** A first pass
wrote `k · (lifetimeEvil/scale)^exponent` and reasoned that `floor` would hold the early
game at zero. It does at `k = 1`: the bracket is about 0.29 near the start of a run, and
`floor(0.29)` is 0. The floor was acting as the threshold, and nobody noticed, because
`k` was 1 and the two were indistinguishable. Raising `k` to 600 for legibility multiplied
the bracket instead of the payout, and the gate vanished — the curve paid **175 souls for
the first Evil a save ever earned, and 213 for thirty-four**, which is what playtesting
found within one smite of starting a new game.

The reason it is so severe is the same reason `exponent` had to be small. At 0.055 the
bracket barely moves: it is 0.29 at one Evil and 1.0 at `scale`, thirty orders of
magnitude later. A curve that flat has no small end. It has to be given one.

Subtracting 1 costs nothing structural. It leaves `exponent` — the only term convergence
depends on — untouched, and it lowers favour by exactly `k · perSoul = 0.6` everywhere, so
the plateau moves from ×7.1 to ×6.5 and the stability margin widens rather than narrows.

**`k` and `perSoul` are one lever, not two, and their product is the whole of it.**
Favour is `1 + perSoul · k · (lifetimeEvil/scale)^exponent`, so `k · perSoul = 0.6` fixes
the game and `k` alone fixes what the player reads. Six hundred is a display decision:
souls in the hundreds and thousands, at a tenth of a percent each, because a soul count of
2 is not what this genre reads like. Any pair holding the product at 0.6 plays identically.
Changing one without the other moves the plateau, and is the mistake this paragraph exists
to prevent.

That product, 0.6, is not free. It reproduces the verified sequence in §2 shifted down by
one unit of `k · perSoul`: the stable curve `1 + 0.59·s_old^0.11` and the new
`1 + 0.6·((lifetimeEvil/5.07e9)^0.055 − 1)` are the same function of lifetime Evil less a
constant 0.6, because `150^0.11` and `(1.14e14/5.07e9)^0.055` agree to three figures.

Measured on an unboosted harness run:

| At    | 30m | 1h  | 2h  | 4h  | 8h    | 12h   | 1d    |
| ----- | --- | --- | --- | --- | ----- | ----- | ----- |
| Souls | 0   | 38  | 221 | 968 | 2,560 | 3,735 | 5,861 |

The first soul lands at **42m 13s**, which is `scale` doing its job.

The count climbs continuously rather than in steps. This is the second reason for a large
`k`: at `k = 1` the floored count sat unchanged for stretches of up to three and a half
hours, and a resource that visibly stops moving reads as a bug.

Across eight three-hour prestiges the harness reports favour running **×1.63 → ×2.37 →
×3.41 → ×4.48 → ×5.18 → ×5.70 → ×6.07**, with the bank at 630 → 1,367 → 2,411 → 3,479 →
4,184 → 4,701 → 5,071 → 5,308 souls. Step ratios fall monotonically, 1.63 down to 1.065,
and the last is under the 1.10 the settling check demands. This is the §2 sequence less
the constant the offset removes, and it converges for the same reason.
The same loop at `k = 1` settled lower, at ×6.4, purely because whole-soul flooring threw
away up to a soul a run.

**Engine.** `soulsEarned` hardcodes `.sqrt()`; it becomes `.pow(content.prestige.exponent)`.
`msToNextSoul` inverts the same formula and moves with it — the current inverse squares,
and must instead raise to `1 / exponent`, about 18.2. That is a steep power and deserves
a second look rather than a shrug: it is safe here only because its base is
`soulsEarned + 1`, a small exact integer, so the power is taken from a clean value rather
than from a re-derived one. The `SOUL_EPSILON` rounding guard and the null contract for
exhausted precision both stay exactly as written, and the null branch matters more now,
not less.

`globalMultiplier` does not change. Favour stays linear in souls.

**Content.** `PrestigeDef` gains `readonly exponent: number`, and its doc comment stops
claiming a square root.

## 4 What the change forces

Three knock-ons. None is optional — each is a place where the old denomination is written
into the content.

### 4.1 Keep prices

Keeping a smite rung costs 8 / 20 / 50 / 120 souls. Under the new curve that is more than
the economy will ever hold. Today rung 1 costs about 18% of a first prestige taken at
three hours — the reference point the old figure was measured against, since the share a
soul count buys is not fixed: it runs 36.6% at 41 minutes, 24.1% at 2h10m, 17.9% at three
hours and 14.0% at four hours, falling as the run that earns the first prestige runs
longer. **220 / 660 / 1,100 / 1,760** holds the three-hour share at that same reference
point — 3,740 souls for a full ladder, 14,960 for all four, against a bank that reaches
roughly 6,000 at the plateau and climbs past it on longer runs and deeper content. Keeping
everything stays a multi-day goal, which is what it is today.

The `k = 600` scale is what makes this land cleanly. At `k = 1` the same prices rounded to
1 / 3 / 5 / 8, and a first rung could not be priced below one whole soul — roughly a
quarter of a first prestige at the three-hour reference point, well past the intended 18%.
Granularity was the constraint, and raising `k` removed it.

### 4.2 Achievements

`souls-1` and `souls-100` both fire in the opening minutes once souls read in the
hundreds, and `souls-10000` sits a long way past the plateau. The three become
**`souls-500`**, **`souls-3000`** and **`souls-10000`** — measured on the harness, the
first lands between two and four hours, the second around ten, and the third at roughly
three days, a genuine long-haul goal reached over several resets. Only two ids change, so the `AchievementId` union and the copy entries move
together. The copy keeps its jokes; "Hold 3,000 Damned Souls. You file them by date" needs
no rewriting beyond the number.

An achievement id that disappears must not strand a save. `deserialize` already filters
`earnedAchievements` against the shipping id list, so a player who earned `souls-100`
simply loses a badge they can re-earn. This is existing behaviour and needs no new code —
but it does need a test, because nothing currently proves it.

### 4.3 Save migration

`souls` and `soulsSpent` are stored in the old denomination. `lifetimeEvil` survives every
reset, so the total is not converted — it is recomputed from the Evil that earned it,
which is exact. Save versions **8 → 9 → 10**: the first step re-denominates, the second
takes off the offset that step 9 shipped without.

The naive migration — rescale each field through the formula — is wrong. `prestigeGain`
depends on the invariant `souls + soulsSpent ≈ soulsEarned(lifetimeEvil)`, and the map
between denominations is non-linear, so transforming the two fields separately breaks it
and hands the player free souls or a permanent debt.

A second approach was tried and shipped, then failed review: recompute `soulsSpent` as
the sum of the **new** Keep prices for the rungs in `smiteKept`. The new prices hold a
fixed *three-hour* share of the new curve — 220/660/1,100/1,760 souls, a full ladder at
3,740. A save that reset later than three hours in, or reset more than once, recovers a
new total nowhere near that reference point, so the charge routinely exceeded the whole
new bank. Checked against the reported playtest save: a player holding one full ladder
was charged 3,740 against a new bank of 1,875 and left with zero — favour ×1.00 instead
of the ×2.9 a Keep-free save of the same size gets. The game rewards buying permanence;
this migration would have punished it by wiping the player who did.

**The fix charges the share of the old bank the player had already spent, not a re-priced
bill.** The old blob's `souls` and `soulsSpent` record exactly what the player held and
spent under the old curve, and that spent *fraction* is a property of their play, not of
either curve's prices — it survives the re-denomination exactly, and it can never exceed
one, so it can never charge more than the new total pays out. The migration:

1. Recomputes the total from `lifetimeEvil` at the new exponent. This is the true new
   `soulsEarned`, and it is exact.
2. Takes the old spent fraction, `oldSoulsSpent / (oldSouls + oldSoulsSpent)`, floors it
   against the new total to get the new `soulsSpent`, and sets `souls` to the remainder
   by subtraction — not by a second, separate computation — so the two fields sum to
   exactly `floor(soulsEarned)`.

This also removes the dependency on `smiteKept` and the new Keep prices entirely. A
migration that reads no price table cannot drift when the content is next retuned, which
this version could: `MIGRATIONS` entries are never edited once shipped, so the first
attempt would have stayed wrong forever once it reached a real player.

**Step 9 → 10 corrects the missing offset.** Version 9 reached the deploy preview and
minted banks on `600·(L/5.07e9)^0.055` with no `− 1`, so those saves hold up to 600 souls
they never earned. `MIGRATIONS` entries are never edited once shipped, so the fix is
appended rather than applied in place: step 10 recomputes from `lifetimeEvil` on the
corrected curve and carries the spent fraction across, exactly as step 9 does and for the
same reasons. A version 8 save walks both steps and lands where a version 9 save does,
which is asserted rather than assumed.

Carrying the fraction matters more here than it did at step 9. Re-pricing what a version 9
player bought would charge them against a bank that has just shrunk by up to 600 souls,
and the clamp at zero stops being a formality: a save under 5.07e9 lifetime Evil held
souls the corrected curve never paid, and correctly lands on nothing.

`MIN_SUPPORTED_SAVE_VERSION` stays at 6.

A worked case, from the reported playtest: 31,630 souls, none spent, recover a lifetime
Evil of 5.069×10¹⁸, which re-evaluates to **1,275 souls, ×2.28**. The count barely moves;
the multiplier falls from ×634. That is the correction, and it is the right shape for
it — nothing the player built is lost, and the ×634 was never real power. It was the
fault in §1.

The same save with a full ladder already kept (198 of the 31,630 souls spent under the
old prices) lands at **1,268 souls, soulsSpent 7, ×2.27** — the Keep survives, the
spent share is preserved, and the bank is barely dented. Two full ladders kept (396
spent) lands at **1,260 souls, soulsSpent 15, ×2.26**. No case wipes the player.

## 5 Interface

The prestige panel needs no structural change. Two strings move:

- `favour` renders `perSoul` as a percentage and will read "Their favour, at 0.1% each".
- `worth` reads "Each soul adds 0.1% to everything you make. It never goes away." The
  sentence survives intact, which is why the cut landed on the earning curve rather than
  on what a soul is worth.

A tenth of a percent is a small number to print, and it is the price of souls reading in
the thousands. The two cannot both be round: `k · perSoul` is fixed at 0.6 by §3, so a
larger soul count forces a smaller per-soul share. The panel leads with the total — `×2.8`
— which is the figure the player actually acts on; the per-soul rate is the footnote.

`formatWhole` already handles four-figure counts. Nothing in the panel's layout changes.

## 6 Testing

The anchor is the harness, not a unit test — the fault in §1 is invisible to any single
`step` assertion.

- **A prestige-loop harness run.** Eight successive three-hour runs, claiming between
  each. It asserts three things, and the third is the one that matters: favour ends inside
  ×5–×8; no run's favour exceeds the previous by more than ×2.5 (the verified sequence's
  steepest step is its first, ×2.21, so a tighter bound would fail on a correct build);
  and **the last two runs report the same favour**, which is convergence itself rather
  than a proxy for it. A build that has tipped back over the threshold in §2.1 fails that
  third assertion no matter where the band was set.

  This is the test that would have caught the original fault, and the reason the fault
  survived is that nothing ever simulated a second run. It is a script and must never gate
  CI, per the existing rule — which makes it a discipline rather than a guard rail, so
  §2.1 names when to run it.
- **The measured growth exponent, reported not asserted.** The same harness prints `a` over
  2h→4h and 4h→8h. Nobody can eyeball a divergent prestige loop, but anyone can read
  `a·q·p` off a report and see it crossing 1.
- **Soul arrivals.** Tests pinning both ends of the opening: that a run far below `scale`
  earns **zero** souls, and that `scale` itself is where the first soul lands. The first
  of those is the regression test for the missing offset, and it is the one that matters —
  an earlier draft of this section argued the opposite, that the first soul arriving
  "within seconds of the first Evil" was a harmless side effect of a small exponent and
  not worth pinning. It was neither. Nothing else in the suite would have caught it,
  because every other figure was correct.
- **The migration round trip.** A version 8 blob with known `souls`, `soulsSpent`,
  `smiteKept` and `lifetimeEvil`, asserting the invariant in §4.3 holds after migrating,
  and asserting `prestigeGain` immediately after load is not negative.
- **A property, not three examples.** `soulsEarned` composed with `msToNextSoul`'s inverse
  returns the same lifetime Evil across the range, for the new exponent.
- **Content tests.** The existing `generators.test.ts` asserts Keep prices ascend per
  rung; it keeps working and gains an assertion that a full ladder costs less than the
  souls a long run pays, so the reprice cannot drift out of reach again.

Engine tests run against fixtures, never shipping content. The fixture's prestige block
gains the new field.

## 7 Out of scope

- **Generator cost curves.** The playtest note that ten idle minutes with one Dark Legion
  bought six Fortresses is a real complaint and a separate one. Folding it in here would
  make it impossible to tell which change moved what.
- **Soul-bought Overseers.** §10.4 of the original design parks these and they stay
  parked. They are no longer the only answer to the plateau, though: §2.1 measures the
  plateau rising by roughly a doubling per tier added, so tiers above the Throne raise it
  on their own without any prestige work.
- **The plateau itself.** It is the fix, not a defect. A prestige multiplier that never
  settles is what this spec removes, and a plateau that lifts when content is added is the
  behaviour §2.1 shows this curve already has.
