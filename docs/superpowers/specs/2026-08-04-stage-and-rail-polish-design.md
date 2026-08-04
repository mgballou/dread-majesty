# Stage and rail polish — design

Amends `2026-08-03-dread-majesty-design.md` §6 and `docs/reference/ui-sensibility.md` §3.
Everything here is interface. No engine file changes; no balance number changes.

The work is eleven items from one play test: nine noted while playing, two written up
afterwards. They are not one feature. What holds them together is that every one of
them is the interface either **lying about the state** or **moving when it should not**.

---

## 1. The two rulings that were asked for

### 1.1 There is already an intensity ramp, and it is gold

The question was whether the palette carries one. It does, and it is the only one it
carries: the gold ramp runs five rungs and four of them are already semantic tokens.

| Rung | Token | Job today |
| --- | --- | --- |
| gold-900 | `--accent-well` | the ground a reporting fill runs over |
| gold-700 | `--accent-line` | line work — banner edges, meter teeth |
| gold-600 | `--accent-soft` | a fill that reports rather than offers |
| gold-400 | `--accent` | **the one action.** Never anything else. |

So the buy chip ramps through the first three and **stops one rung short of
`--accent`**. That last rung means *act*, and the chip is a setting, not the action —
this is the same rule that has kept the quantity control off the accent since it was
built (§3, and `QuantityToggle.tsx` says so in its own comment). Ramping into it would
make the chip compete with the buy button it governs.

| Quantity | Field | Ink | Measured |
| --- | --- | --- | --- |
| ×1 | `--surface-raised` | `--ink-dim` | existing pair |
| ×10 | `--accent-well` | `--ink-muted` | 10.88:1 |
| ×100 | `--accent-line` | `--ink` | 4.76:1 |
| ×MAX | `--accent-soft` | `--on-accent` | 5.26:1 |

All four clear §13's floor. `tokens.test.ts` recomputes them from the stylesheet, the
same as every other pair.

### 1.2 Max keeps the word, and the chip is `4ch` wide

Both proposed symbols are worse than the word, for the same underlying reason.

**∞ is wrong, and not in a way anyone forgives.** Max is bounded twice over — by the
purse and by `MAX_AFFORDABLE_CAP`. In this genre ∞ has a specific meaning attached to
it, and using it for "as many as I can currently afford" is the kind of thing that
reads as a bug the first time a player presses it and gets four.

**The Evil sigil is worse.** It is the currency everywhere else in the game — on the
node, in every cost, in the crown. Reusing it as a quantifier makes it mean two
different things on one screen, and the one it would mean here ("multiply by Evil") is
not what is happening.

**The width problem it was meant to solve does not exist.** In `--font-numeric` the
four faces are `×1`, `×10`, `×100`, `×MAX` — the widest is four characters, so the
chip is `4ch` and cannot change width whatever state it is in. Width-constrained was
the actual requirement; a symbol was a way to get there that is not needed.

---

## 2. The accent, and why it stopped jumping

### 2.1 What was wrong

`railPlan` ranks purchases and appointments on one list and lifts **one** winner
across both. The muster and the miscreants are separate panels of the deck, and the
deck shows one panel at a time. So whenever an appointment won, the muster — very
possibly the only panel on screen — carried **no accent at all**, and the gold
appeared to have vanished. Whenever the two traded places, which happens whenever
their scores cross, it appeared to jump.

Neither of those is what §3 asks for. §3 says *one action per screen*. The screen was
being read as "the whole deck", which is not what the player sees.

### 2.2 The rule, restated

**One accent per region. The screen shows two regions: the stage, and the open
panel.**

- The stage's accent is **Smite**, and it is gold whenever the blow is ready. Not
  conditionally, not only when the rail has nothing better — always. It is the one
  verb the game is named for and it should be findable without reading.
- The open panel's accent is the best affordable spend **in that panel**. The muster
  lifts a purchase; the miscreants lift an appointment. Neither can take the other's
  gold, because they are never on screen together.

This is a departure from §3 as literally written and it is deliberate. The reason is
the play test: **two fixed places beats one moving place.** A player who has learned
where the gold lives can find it without searching, and a player who has not learned
it never will while it moves.

### 2.3 Stickiness

Per-panel accents stop the gold crossing panels. They do not stop it walking down a
panel, because the score is recomputed every 100ms slice and near-ties flip.

The winner is **held** until one of three things happens:

1. it stops being available — bought out, post filled, tier gone; or
2. it stops being affordable; or
3. a challenger's score exceeds the held option's by a factor of **1.25**.

Proper hysteresis: the margin is directional, so once a handover happens the new
holder is protected by the same margin and there is no oscillation at the boundary.
Buying repeatedly walks the held option's own score down — its cost rises — so it
hands over on its own eventually, which is correct.

`railPlan` stays pure. It takes the previously held keys as an argument and returns
the sticky answer; the memory lives in a hook above it.

### 2.4 The words come off

`Advised` and `Affordable` both go.

They exist because colour must never carry a state alone (§5). It still does not:
the lifted control is a **filled** button among **outlined** ones, and fill against
outline is a weight difference, not a colour difference. It survives greyscale.

What must not be lost is the spoken state. It moves onto the control's accessible
name, where it belongs — a screen reader gets "best available" as part of the name of
the thing it is describing, rather than as a stray word floating beside it.

`Beyond reach` and `Filled` stay. Those are states worth naming. Affordable-and-open
is the default and the default needs no label (§12: an absent judgement is not a
status).

---

## 3. The stage lying about itself

### 3.1 The runs carry what is delivered, not who sent it

`ChainStage` passes each link the **producing** tier's tone. So the run from Minions
to Evil pours minion-coloured motes into the Evil node. Every other link in the chain
happens to look right, because a Warren's motes landing on Minions in Warren green is
at least *a* defensible reading — but the last one makes the error visible, and it is
the same error the whole way up.

**A mote is the thing being delivered.** The link takes the tone of the node it feeds.

### 3.2 The runs are hairlines

`stage-link::before` is `1px`, which is too thin to hold the eye across the gap, so the
chain reads as six separate nodes rather than one chain. Two pixels, and the lit run
goes to three so it still reads as heavier than a resting one.

**Corrected during implementation.** This section first claimed the run also stopped
short of the discs at either end. It does not — `.stage-link::before` already carried
`inset-inline: 0` and spanned the full gap. Thickness was the whole of the fault.

### 3.3 Rings never mark their own completion

`TierNode` marks an **arrival** — the producer above it firing — but nothing marks the
node's *own* cycle closing. So the one event the stage exists to draw is the one event
it does not draw.

Every ring flashes on its own completion. Under a surge the flash is stronger, because
under a surge the completion is worth more, and the stage should say so.

### 3.4 The cycle reads in fifths

Both progress indicators are continuous sweeps textured with eight teeth. Neither
gives a glanceable fraction. Five segments does: three lit of five is read, not
estimated.

One constant, `CYCLE_SEGMENTS = 5`, shared by the meter and the ring, and it doubles
as the reduced-motion step count both already carry separately at eight.

### 3.5 The production line says the noun twice

`2.5 Minions every 4s, each` sits directly beneath a row already titled **Minions**,
inside a panel listing Minions. The noun is the least informative thing on the line.
Replace it with the produced thing's mark from the manifest — which is also the one
place on the row that says what this tier *makes* rather than what it *is*.

The noun stays as the mark's accessible name. Nothing is lost to anyone reading by ear.

### 3.6 The deck's glyphs are whatever the platform feels like

`⚒ ◈ ✧ ※` as text. iOS gives `⚒` emoji presentation — full colour, wrong size, wrong
weight — while every desktop renders it as a monochrome glyph. The tab strip is four
marks and one of them is a different species on a phone.

The game already has a mechanism for this and uses it in three places: an inline SVG
in `currentColor` on a `0 0 48 48` viewBox (`TierArt`, `Miscreants`' diamond,
`Crown`). The tabs use it too. Nothing is left to the font.

### 3.7 The open tab is cut off from the panel it opens

`.deck__strip` draws `border-block-end: 1px solid var(--accent-line)` under **all four**
segments, including the open one. That single line is what makes the tab strip read as
a bar with a panel below it rather than as four tabs one of which is open — it severs
the open segment from its own panel, which is the entire mechanism the idiom runs on.

The open segment already changes ground and ink, but it is doing that work alone
against a line that contradicts it, which is why the distinction reads as faint.

The line moves off the strip and onto each segment. The shut ones keep it. The open one
drops it and takes a gold bar along its **top** edge instead — a structural mark, still
line weight, never a fill (§5, §7). Drawn as an inset shadow so it follows the chevron
clip rather than the element's box.

### 3.8 Smiting resizes the column

`.evil-node__report` has no width on desktop, so the node grows and shrinks with the
length of whichever line the last blow drew — `An orchard, salted.` against
`A bridge, taken down at both ends.` — and the chain beside it moves. The report is
pinned to a fixed width, as the verb chip beside it already is.

---

## 4. What this does not do

- **No smite economy.** Decay, escalating cooldown, upgrades and the item shop are
  workstream B and wait for the play test, as agreed. §3.7 and §2.2 touch the smite
  *control*; neither touches `smite.ts`, `smitePhase`, or a single balance number.
- **No guided tour.** Workstream D.
- **No engine change of any kind.** Every file this touches is under `apps/web/src/ui`
  or `packages/content/src/v1/copy.ts`.

## 5. Testing

Every item gets a test that fails when the item is reverted, and the branch keeps the
two invariants it already has:

- **Per-panel accent**, replacing `oneAccent.test.tsx`'s cross-panel invariant: each
  panel renders at most one lifted control, and a panel holding an affordable option
  renders exactly one.
- **Token parity and contrast**, extended with the chip's four pairs.

Two things stay visual and are stated as such rather than tested: whether the thicker
run reads as one chain, and whether the ring flash is legible under a surge.
