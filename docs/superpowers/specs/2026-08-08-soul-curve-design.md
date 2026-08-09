# The Soul Curve

**Status:** approved, not yet built
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

A consequence, not a side effect: a flat exponent forces small soul counts. A large `k`
on a curve this flat would barely move — the number would read as nearly constant. Rare
souls are what this exponent produces, and the tone suits it. Something you file by date
should be countable.

## 3 The formula

```
souls = floor(k · (lifetimeEvil / scale) ^ exponent)
```

`{ k: 1, scale: '5.07e9', exponent: 0.055, perSoul: 0.6 }`, replacing
`{ k: 150, scale: '1.14e14', perSoul: 0.02 }`.

`scale` is unchanged in meaning and holds the same moment it always held: 5.07e9 is the
lifetime Evil at 41 minutes, where the first soul is tuned today and where it stays.

`perSoul` is 0.6 because that reproduces the verified sequence in §2 exactly. This is not
a coincidence to be tidied away later: the stable curve `1 + 0.59·s_old^0.11` and the new
`1 + 0.6·s_new` are the same function of lifetime Evil, because `150^0.11` and
`(1.14e14 / 5.07e9)^0.055` agree to three figures. Changing `scale` or `k` without
re-deriving `perSoul` moves the plateau.

Measured arrivals on an unboosted run:

| Soul     | 1   | 2    | 3    | 4    | 5    | 6    | 7     | 8     | 9     | 10    |
| -------- | --- | ---- | ---- | ---- | ---- | ---- | ----- | ----- | ----- | ----- |
| Lands at | 41m | 2h54 | 4h37 | 6h12 | 7h35 | 9h17 | 11h26 | 14h06 | 17h19 | 20h55 |

Gaps run 1h22 to 3h36 and widen gently. No dead stretch. Across eight prestiges the bank
runs 2 → 4 → 7 → 8 → 9 → 10 while favour runs ×2.2 → ×7.

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
the economy will ever hold. Today rung 1 costs about 18% of a first prestige; **1 / 3 / 5
/ 8** comes as close as whole souls allow, at roughly a quarter of a first prestige, and
holds the shape of the ladder above it — 17 souls for a full ladder, 68 for all four,
against a bank that reaches the low tens over many resets. Keeping everything stays a
multi-day goal, which is what it is today. One soul is the floor: the first rung cannot
be made to cost proportionally less without fractional souls, and fractional souls would
undo §2.

### 4.2 Achievements

`souls-100` and `souls-10000` name counts nobody will reach. They become **`souls-5`** and
**`souls-20`**, keeping `souls-1` where it is. Their ids change, so the `AchievementId`
union and the copy entries move together. The copy keeps its jokes; "Hold 5 Damned Souls.
You file them by date" needs no rewriting beyond the number.

An achievement id that disappears must not strand a save. `deserialize` already filters
`earnedAchievements` against the shipping id list, so a player who earned `souls-100`
simply loses a badge they can re-earn. This is existing behaviour and needs no new code —
but it does need a test, because nothing currently proves it.

### 4.3 Save migration

`souls` and `soulsSpent` are stored in the old denomination. `lifetimeEvil` survives every
reset, so the conversion is exact rather than approximate. Save version **8 → 9**.

The naive migration — rescale each field through the formula — is wrong. `prestigeGain`
depends on the invariant `souls + soulsSpent ≈ soulsEarned(lifetimeEvil)`, and the map
between denominations is non-linear, so transforming the two fields separately breaks it
and hands the player free souls or a permanent debt. The migration must instead:

1. Recompute the total from `lifetimeEvil` at the new exponent. This is the true new
   `soulsEarned`, and it is exact.
2. Recompute `soulsSpent` as the sum of the **new** Keep prices for the rungs in
   `smiteKept`. A player who bought a full ladder still owns it, and now owes 17 rather
   than 198.
3. Set `souls` to the remainder, floored at zero.

The migration inlines its constants rather than importing content. This is required —
`packages/engine` may not import balance data — and it is also correct on its own terms:
a shipped migration is frozen against the numbers of its moment, and must not drift when
the content is next retuned. `MIGRATIONS` entries are never edited once shipped.

`MIN_SUPPORTED_SAVE_VERSION` stays at 6.

A worked case, from the reported playtest: 31,630 souls recover a lifetime Evil of
5.07×10¹⁸, which re-evaluates to **3 souls, ×2.8**. Nothing is lost. The currency is
re-denominated, and the ×634 was never real power — it was the fault in §1.

## 5 Interface

The prestige panel needs no structural change. Two strings move:

- `favour` renders `perSoul` as a percentage and will read "Their favour, at 60% each".
- `worth` reads "Each soul adds 60% to everything you make. It never goes away." The
  sentence survives the change intact, which is the whole reason the cut landed on `q`.

`formatWhole` already handles single digits. The panel's `trailing` slot will now show a
number small enough to read at a glance, which it was not before.

## 6 Testing

The anchor is the harness, not a unit test — the fault in §1 is invisible to any single
`step` assertion.

- **A prestige-loop harness run.** Eight successive three-hour runs, claiming between
  each, asserting favour ends inside ×6–×8 and that no run's favour exceeds the previous
  by more than ×2.5 — the verified sequence's steepest step is its first, ×2.21, so a
  tighter bound would fail on a correct build. This is the test that would have caught
  the original fault, and it is
  the reason the fault survived: nothing ever simulated a second run. It is a script and
  must never gate CI, per the existing rule.
- **Soul arrivals.** An engine test pinning the first soul at 41m ± 1m against a fixture,
  so a future content edit cannot move it silently.
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
- **Soul-bought Overseers.** Favour plateaus near ×7 by design. That means prestige stops
  paying after roughly five resets and further progress must come from content. §10.4 of
  the original design already parks this; it stays parked.
- **The plateau itself.** It is the fix, not a defect. A prestige multiplier that never
  settles is what this spec removes.
