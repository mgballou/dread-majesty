# Smite as a System — Design Spec

**Date:** 2026-08-04
**Status:** built
**Amends:** `2026-08-03-dread-majesty-design.md` §5.5; `2026-08-04-economy-retune-design.md` §10

**This is Spec B.** A is delivered, C is delivered. D — the guided tour — is still
unwritten.

---

## 1. Why

Smite works and it never grows. A blow is ×2 for fifteen seconds on a sixty-second
cooldown, which averages to ×1.25 over a session, and that number is the same at minute
five and at hour five. There is no decision in pressing it, nothing to spend on it, and
nothing that changes when you do.

This spec gives the verb a cost, a ceiling, and a shop.

- **Apathy.** Every blow makes the next one worth less. It bleeds off while you leave it
  alone. Strike well and you beat the idle player by a third; hammer it and you beat
  them by a quarter; sit in the middle and you barely beat them at all.
- **Four ladders.** Evil climbs them during a run. Souls make a rung permanent. Buying
  into them flips which way of playing is best, so an upgrade changes how you play
  rather than what a number reads.
- **The deck loses the ledger** to make room for the shop, and the ledger goes back to a
  footer button and a sheet, where it was before the deck existed.

It changes no engine rule. All five in `CLAUDE.md` hold, and §4.3's 120-second golden
must pass untouched.

---

## 2. Apathy

### 2.1 The shape

One number. Every blow adds to it; it bleeds away on its own; the blow's multiplier
reads it **before** the strike lands.

```
blow multiplier = weight − step × apathy      (floored at 1)
after the strike, apathy = min(cap, apathy + perBlow)
every slice,      apathy = max(0, apathy − dtMs / bleedMs)
```

It is a real number, not an integer. An integer sheds in visible jumps, and a jump
creates a knife-edge: hitting the shed by one second is worth a great deal and missing
it by one second is worth nothing. A continuous bleed has no cliff anywhere on it, which
is what lets the payoff curve below have two broad optima instead of two spikes.

The cooldown is **flat and not for sale**. See §2.4.

### 2.2 Seed numbers

| | value |
| --- | --- |
| Cooldown | 20s |
| Blow duration (Reach, rung 0) | 15s |
| Weight (rung 0) | ×2.00 |
| Apathy per blow | +1 |
| Apathy cap | 3 |
| Bleed (Forgetting, rung 0) | one point per 45s |
| Step (Restraint, rung 0) | −0.25 per point |

So the four faces of a blow, unupgraded: ×2.00, ×1.75, ×1.50, ×1.25.

Every number here is a seed. The harness settles them, per the rule about not trusting
seeded balance.

### 2.3 What it produces

Steady-state average multiplier, against striking every P seconds:

| Habit | Average | |
| --- | --- | --- |
| Never smite | ×1.00 | the harness's number |
| Every 60s | ×1.25 | today's game, exactly |
| Every 40s | ×1.18 | the punished middle |
| Every 20s, flat out | ×1.27 | hammer it — Apathy pins near 2.6 |
| Every 45s | **×1.33** | pace it — Apathy always clears |

Two ways to play, a valley between them, pacing ahead by a nose. **Nobody ever drops
below ×1.00**, so a player who has not worked the system out is never punished for using
it — spamming stops paying, visibly, while they watch the bar. That is deliberate. A
mechanic whose failure state is worse than not touching it teaches by punishment, and
this one teaches by showing.

At the cap, Apathy sheds `P/bleedMs` between blows and pins there, so the flat-out
player's multiplier is `weight − step × (cap − P/bleed)` — a stable figure, not a
spiral. There is no state from which smiting is a mistake.

### 2.4 Why the escalation is not on the cooldown

It was, in the first draft, and the arithmetic killed it.

A blow lasts fifteen seconds. A cooldown shorter than that only re-ups a buff already
running, and blows are set rather than added — two blows can never be worth more than
two blows, per §5.5. So the useful cooldown range starts at the duration, and **every
second above it cuts uptime.** An escalating cooldown can therefore set a ceiling but
can never create a choice: chaining loses to pacing at every setting, so "chain or pace"
is a trap dressed as a decision.

Escalation on the blow's **value** is both a brake and a gradient. It caps the flat-out
player (§2.3) and it leaves a real question every time the ring clears: strike now for
less, or wait for the realm to forget.

The cooldown stays flat at 20s and is not on any ladder. **Reach is the tempo upgrade
instead** — buy it to rung 3 and the blow outlasts the cooldown, so uptime reaches 100%.
"The blow lasts longer" is a legible thing to sell; "the cooldown is 18s" is not.

### 2.5 Prestige, offline, and the harness

- **A reset keeps the Apathy and the cooldown, and clears the running blow.** Same
  reasoning as today: a reset is not a free blow. Apathy bleeds out inside a minute
  anyway, so this costs the player nothing they will notice and saves a special case.
- **Apathy bleeds during offline catch-up** like every other counter, because `step`
  spends it at the rate it spends `dtMs`. A returning player is always at zero. The idle
  player is untouched by this spec.
- **The harness still does not smite.** §5.2's economy measurements stand exactly as
  they are, which is what makes this spec unable to move them.

### 2.6 The name

The gauge is **Apathy**. Gothic played straight: the realm does not fear you less, it
simply cannot be bothered any more, and the Dark Lord's real enemy turns out to be being
ignored. The engine field is `smiteApathy`, so the mechanic and the joke share a name.

---

## 3. The Wrath shop

### 3.1 Four ladders

| Ladder | Base | 1 | 2 | 3 | 4 | Does what |
| --- | --- | --- | --- | --- | --- | --- |
| **Weight** | ×2.00 | ×2.25 | ×2.50 | ×2.75 | ×3.00 | how hard a blow lands |
| **Reach** | 15s | 17s | 19s | 21s | 23s | how long it holds |
| **Forgetting** | 45s | 40s | 36s | 32s | 30s | how fast Apathy bleeds |
| **Restraint** | −0.25 | −0.225 | −0.20 | −0.175 | −0.15 | what a point of Apathy costs |

Weight and Reach are flat gains. Forgetting and Restraint are the pair that make Apathy
survivable, and neither is worth much without the other — that is the interlock, and it
is why four ladders beats four percentages.

**Rung 0 is the base and carries no price.** It lives on the upgrade rather than on
`SmiteDef`, so a base value and a rung-0 value can never drift apart.

### 3.2 The shop flips which style wins

| | Pacer | Hammer |
| --- | --- | --- |
| Nothing bought | ×1.33 | ×1.27 |
| One rung each | ×1.53 | ×1.58 |
| Everything bought | ×2.53 | **×2.65** |

Unupgraded, pacing wins. One rung in and hammering pulls ahead, mostly on Reach, because
uptime is the cheapest thing to buy early. Fully built, the hammer build is the best in
the game.

This is the point of the whole shop: **an upgrade changes how you play.** A player who
buys nothing learns to pace. A player who buys in learns they can stop.

### 3.3 Climb with Evil, keep with souls

Two counters per ladder:

- `rung` — where you have climbed **this run**. Evil buys the next one.
- `kept` — your permanent floor. Souls buy the next one. Survives a reset.

The invariant is `kept ≤ rung`, and a reset sets `rung = kept`. That means the effective
value is always just `rung` — no `max()` anywhere in the engine.

**Souls can never advance you.** Keeping rung N requires that you have already climbed to
rung N with Evil in this run, and that `kept` is at N−1. So the order is fixed: earn it,
then make it stick. Souls buy permanence and nothing else.

That gives prestige a decision it does not currently have. Before you abdicate you are
looking at four ladders you are about to lose most of, and a soul count that will keep
one or two rungs of them.

### 3.4 Prices

Evil, per rung — roughly ×12 a rung, with Reach cheapest so the first thing a player
buys is the one that teaches the system:

| Ladder | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Reach | 2.5e3 | 3e4 | 3.6e5 | 4.3e6 |
| Weight | 5e3 | 6e4 | 7.2e5 | 8.6e6 |
| Forgetting | 1e4 | 1.2e5 | 1.44e6 | 1.73e7 |
| Restraint | 1.5e4 | 1.8e5 | 2.16e6 | 2.6e7 |

Rung 1 of Reach sits beside the Keeper of the Whip at 2,400 Evil, which the harness puts
around eleven minutes. So the shop opens inside the first run rather than behind the
prestige wall.

Souls to keep a rung, the same schedule on every ladder:

| Rung | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Souls | 8 | 20 | 50 | 120 |

A first reset pays 40–50 souls (retune §5.3), so it keeps two rung-1s or one rung-2.
Keeping every rung of every ladder runs to 792 souls, which is deep into the game.

---

## 4. Engine and content shape

### 4.1 Content

```ts
export type SmiteUpgradeId = 'weight' | 'reach' | 'forgetting' | 'restraint';

export interface SmiteRungDef {
  /** Evil to climb to this rung within a run. */
  readonly evil: string;
  /** Souls to make this rung the permanent floor. */
  readonly souls: string;
  /** What the effect reads at this rung. */
  readonly value: number;
}

export interface SmiteUpgradeDef {
  readonly id: SmiteUpgradeId;
  /** Display title. The engine never reads it. */
  readonly name: string;
  /** What the effect reads at rung 0, before anything is bought. */
  readonly base: number;
  /** Rungs 1..N, ascending in price. Never includes rung 0. */
  readonly rungs: readonly SmiteRungDef[];
}

export interface SmiteDef {
  /** Flat, and on no ladder. See §2.4. */
  readonly cooldownMs: number;
  readonly apathy: { readonly perBlow: number; readonly cap: number };
  readonly upgrades: readonly SmiteUpgradeDef[];
}
```

`SmiteDef` **loses `seconds`, `durationMs` and `multiplier`.** `seconds` has been
vestigial since the instant payment came out — the engine stopped reading it and the
tests already assert a blow pays nothing at once. The other two become rung 0 of Reach
and Weight.

A content test pins: four upgrades, four rungs each, Weight and Reach ascending,
Forgetting and Restraint descending, every price parseable as a `Decimal`.

### 4.2 State

```ts
/** 0..cap, real. Bleeds every slice; every blow adds to it. */
smiteApathy: number;
/** The multiplier the running blow carries. 1 when none runs. */
smiteBlow: number;
/** Where each ladder stands this run. A reset drops each to its `kept` floor. */
smiteRungs: Record<SmiteUpgradeId, number>;
/** The permanent floor, bought with souls. Never cleared. `kept <= rung`. */
smiteKept: Record<SmiteUpgradeId, number>;
```

`smiteBlow` is necessary because the multiplier now varies per blow and
`globalMultiplier` has to know what **this** blow was worth, not what a fresh one would
be. Set at strike time, read while `smiteActiveMs > 0`, back to 1 when it runs out.

**No second field for the blow's duration.** Buying Reach mid-blow would make
`smitePhase`'s active share exceed 1, so the share clamps to `[0, 1]`. A clamp is one
line and the drawing is identical; a stored duration is a field that exists for one
frame a run.

### 4.3 Intents

```ts
| { kind: 'climb'; upgradeId: SmiteUpgradeId }
| { kind: 'keep'; upgradeId: SmiteUpgradeId }
```

`IntentFailure` gains `'rung-maxed'`, `'nothing-to-keep'` and `'insufficient-souls'`.
Souls are not in `state.resources`, so the existing `'insufficient-resource'` cannot
cover them.

`climb` refuses at the top of the ladder and refuses what the player cannot afford.
`keep` refuses when `kept === rung` — there is nothing earned to lock — and when the
souls are short.

`prestige` sets `smiteRungs = { ...smiteKept }` alongside what it already clears, and
sets `smiteBlow` to 1 with `smiteActiveMs` to 0.

### 4.4 Selectors

Named per the house rule — a noun or a `verbNoun`, pure, read-only:

- `smiteWeight`, `smiteDurationMs`, `smiteBleedMs`, `smiteStep` — each ladder's value at
  its current rung. One shared private helper resolves rung → value.
- `nextBlowMultiplier(state, content)` — `weight − step × apathy`, floored at 1. The
  figure the interface prints.
- `smitePhase` keeps its shape; the active share divides by the effective duration and
  clamps.
- `climbCost` / `keepCost` — the next rung's two prices, or null at the top.
- `canClimb` / `canKeep` — predicates, per the naming table.

`globalMultiplier` reads `state.smiteBlow` in place of `content.smite.multiplier`.

### 4.5 Save

`SAVE_VERSION` 7 → 8. `MIN_SUPPORTED_SAVE_VERSION` stays 6. The migration defaults
`smiteApathy` to 0, `smiteBlow` to 1, and every entry of `smiteRungs` and `smiteKept` to
0 — which is exactly the game an existing save was already playing, with the ladders
unbought.

---

## 5. Interface

### 5.1 The Apathy readout

A thin bar between the Smite button and the report line. **Always present, empty at
zero**, so nothing moves when it fills — the report line is already held open for the
same reason.

- **Its own semantic token.** Not gold: gold is the stage's one accent and belongs to the
  verb. Not the Evil tone: Apathy is the thing working against you. Tone rides with the
  data, so the token is defined once and no component decides it.
- **The next blow's worth prints at the bar's right end.** That is the actionable number
  and it belongs beside the thing that causes it. The verb on the button stays
  width-locked and numberless, as it is today — a label that changes length moves the
  whole column.
- **Reduced motion is designed.** The bar jumps rather than easing. Nothing visible under
  full motion goes missing.
- **The band carries the joke.** The bar's title names where the realm stands — it
  flinches, it has seen worse, it has stopped looking. Three short lines in copy, keyed
  to thirds of the cap.

### 5.2 The Wrath panel

Four rows, one per ladder. Each row carries the ladder's name, what it reads now and what
the next rung reads, a rung count, the Evil price as the row's action, and a quiet
**Keep** beside it that is live only while `kept < rung`.

The panel joins `railPlan` as a third category, so its accent behaves exactly like the
muster's and the miscreants': `RailBest` and the saving pair each grow a `wrath` field,
and the same directional hysteresis holds the choice. **One accent per region** is
unchanged — the deck shows one panel at a time, and Keep is a secondary weight that can
never lift.

Rows rank by **gain in the average multiplier per Evil spent, measured at the cooldown's
rhythm.** A defined and testable number rather than a hand-waved "best", and the
cooldown's rhythm is the assumption a majority of players will actually match. As
everywhere else, an option scoring zero is not a recommendation.

### 5.3 The deck, and the ledger's move

The deck stays at four: **muster, miscreants, deeds, wrath.** Wrath takes the fourth
slot, where the ledger was. Five tabs do not sit comfortably in one tube.

The ledger goes back to a footer button and a `Sheet`, where both it and the deeds lived
before the deck existed. This is a restoration, not a build: `Sheet` survives and
`Confirm` is built on it, so the platform `<dialog>` behaviour is already there and
already tested. Only `shell__foot` and `shell__records` were deleted from `App.css` and
need writing back. **One button, not the old two** — deeds stays in the deck.

`DeckGlyphKind` swaps `'ledger'` for `'wrath'` and gains its tab mark. The `shape()`
function returns `ReactElement`, never `ReactNode`, so a missing case fails typecheck.

### 5.4 The buy chip

The chip is `inline-size: 4ch; padding: 0`, and `box-sizing: border-box` is global — so
adding padding alone would squeeze the text rather than give it room.

```css
padding-inline: var(--space-2);
inline-size: calc(4ch + 2 * var(--space-2));
```

The text box stays exactly 4ch, so `×100` and `×MAX` still both fit and the chip still
cannot change width as it cycles.

---

## 6. Copy

`SmiteCopy` gains the Apathy bar's name, its three band lines, and the next-blow
figure's format. A new `WrathCopy` carries the panel title, the four ladder names and
notes, the Keep verb, and the two price formats.

The report line under the Evil node is unchanged. It cycles on the smite count and that
still reads well.

The achievement vocabulary already carries a `smites` condition. Nothing here needs a new
condition kind.

---

## 7. Testing

Engine tests run against `packages/engine/test/fixtures/`, never shipping content. The
fixture's smite block takes the new shape.

1. A blow reads Apathy before the strike, not after — the first blow of a run is full
   weight.
2. Apathy bleeds at exactly `dtMs / bleedMs` and floors at zero.
3. Apathy caps, and a flat-out player's multiplier settles rather than spiralling.
4. The blow multiplier floors at 1 whatever the content says.
5. `step(step(s, dt), dt)` and `step(s, 2·dt)` agree on Apathy — the property, not three
   examples.
6. `globalMultiplier` reads the struck blow, so buying Weight mid-blow does not change
   the blow already running.
7. `climb` refuses at the top of the ladder, and on short Evil.
8. `keep` refuses at `kept === rung`, and on short souls. Souls can never overtake Evil.
9. `prestige` drops every rung to its floor and leaves the floors alone.
10. A version-7 save migrates to a state that plays identically.
11. The active share clamps to 1 when Reach is bought mid-blow.

Web tests: the Apathy bar renders at zero and never unmounts; the Wrath panel's accent
lifts one row; Keep is dead while `kept === rung`; the ledger button opens the sheet and
Escape closes it; the chip's width is unchanged by the padding.

The harness stays a script and never gates CI. It still does not smite.

---

## 8. Not in this spec

- **Prestige tuning, and any further move on the economy numbers.** Apathy changes what a
  run is worth, so both wait until this has been played. This is the reason the spec
  exists before either.
- **The guided tour. Spec D.**
- **Soul-bought second Overseers** (main spec §10.4). This spec establishes that souls
  can buy permanence; the roster can use the same shape later.
- **Apathy-banded report lines.** The bar's title carries the band. Making the flavour
  report read Apathy as well as the smite count is a content change that can land any
  time.
