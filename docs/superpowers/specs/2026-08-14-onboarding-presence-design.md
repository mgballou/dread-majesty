# Onboarding Presence

**Status:** built
**Extends:** `2026-08-13-onboarding-design.md`. That spec's model, beats, copy and voices stand;
this one changes how much of the screen they command and repairs the Malice track's unresolved
dialogue.

Playtest on the built system: the structure, messaging, positions and cadence are right, and the
prompt is too quiet to act on. Separately, the Malice track's conversation does not resolve — the
narrator's reply to her is very nearly unreachable.

---

## 1 The two faults

### 1.1 The prompt does not command attention

The bar carries the right words at the right moment and reads as furniture. The tour it replaced
took the screen; that was its one virtue, and it went out with the modal. What the tour could not
do — and what this system exists for — is let the player act inside the lesson. Those two are not
in tension, and §3 takes both.

### 1.2 Her insistence collapses after one strike, and the narrator never answers

Three faults compound, and none of them is timing.

**`goad` is consumed by the first smite after she appears.** Her `clearedBy` is `'smite'`. She is
written as an addict working on the player — four lines, escalating — and one cave silences her.

**So `apathy` is nearly unreachable.** It requires Apathy ≥ 2, which the shipped numbers reach on
the *third* rapid strike (spec `2026-08-13` §5.3). She is gone after the second, and nothing on
screen asks for a third. The narrator's reply is a dead end by construction.

**`first-blow` can expire unread.** It retires after 12 seconds of play time. The line is 215
characters — about 38 words, roughly 11.5 seconds at 200 wpm. Whether the player finishes it is a
coin flip.

---

## 2 The Malice repair

Three changes, and the arc the earlier spec describes then actually happens.

**She persists across strikes.** `goad` is no longer cleared by a smite. She stays while the
conversation is live and keeps talking. Her lines are already chosen from Apathy, and **Apathy
rises when the player caves** — so a cave lands her back on *"Oh, that was good. Again — while
they are still trembling."* That is the insistence, and it needs no new copy.

**The narrator's reply is what clears her.** A beat may now be consumed by the next beat in its
track becoming ready. When Apathy crosses band 2 — the second cave — `apathy` becomes ready,
`goad` is consumed, and the narrator takes the bar: *"You listened to her. Everyone does, once."*

**`first-blow` and `apathy` stop expiring.** Both carry a dismissal button already; the timer only
ever loses them. They become dismiss-only. `goad` keeps her window, because she has no button —
resist her for two minutes and she gives up, which is the one ending she has that is not the
narrator interrupting.

### 2.1 The two pathways, and that both now end

| The player | What happens |
| ---------- | ------------ |
| Caves twice | Apathy crosses 2 on the second cave, `goad` is superseded, the narrator answers. |
| Resists | Apathy bleeds to 0, she walks down all four lines to *"There. They have forgotten you entirely. That is the moment — take it, and take all of it."* — her only honest line — and retires at her window. |

Neither pathway could complete before. The first was cut off after one strike; the second ended in
silence because she had already been consumed.

### 2.2 What this costs the model

One addition: `clearedBy` gains `'next-ready'`, meaning the beat is consumed when the next
unconsumed beat in its track has a `ready` that holds. Nothing else moves. `showingBeat` keeps its
three rules; this is a fourth answer to "what clears it", beside `gated-action`, `smite` and
`dismiss`.

It is evaluated where retirement already is — a pure `supersededBeat` in `game/onboarding.ts`,
called from the same effect that runs `shouldRetire`, so both "this beat's time is up" answers sit
together and neither is a decision made inside a component. The two cannot collide: `goad` is the
only beat carrying `'next-ready'`, and her window and her successor are checked in one place.

The ordering holds on the shipped numbers without a tie-break: when she first appears, twenty
seconds after the opening strike, Apathy has bled to 0.56 and band 2 is far off, so she is never
superseded on the frame she arrives.

**The Malice track still starts reactively**, on the first smite, whenever that falls. Gating it
behind an Evil threshold was considered and rejected: with the retirement faults fixed the track
waits for a gap rather than expiring in one, so the reactivity the design wanted survives.

---

## 3 Presence

**A beat that gates a control cuts a hole in a dimmed screen around that control. A beat that
gates nothing dims the whole screen.** In both cases the dimming is `pointer-events: none`, so
everything under it stays operable and the lit control is genuinely clickable. That is the thing
the modal tour could not do.

```
┌───────────────────────────────┐      ┌───────────────────────────────┐
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░ ┏━━━━━━━━━━┓ ░░░░░░░░░░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░ ┃  MINION  ┃ ░░░░░░░░░░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░ ┗━━━━━━━━━━┛ ░░░░░░░░░░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
├───────────────────────────────┤      ├───────────────────────────────┤
│ ▸ Set it about some wickedness│      │ Oh, that was good. Again —    │
└───────────────────────────────┘      └───────────────────────────────┘
   a gated beat: one hole              a narrative beat: no hole
```

### 3.1 The cutout

Four bands and a ring, the geometry the deleted tour used, pointed at the live control rather than
at a card. The bands are four plain rectangles — no mask, no spread shadow, nothing to composite —
and the ring is drawn in `--accent-line`, which is line work rather than the accent itself. **The
scrim never takes the screen's one action color**; the lit control keeps whatever it already had.

The ring pulses. Under `prefers-reduced-motion` it is static and still present — the ring is what
carries the pointing, and the pulse is only emphasis, so nothing visible goes missing.

### 3.2 Finding the control

The gate already names it. The mapping is one selector per gate kind:

| Gate | Element |
| ---- | ------- |
| `rouse` | the tier's node on the stage |
| `buy` | the tier's row in the muster |
| `appoint` | the post in the miscreants |
| `none` | nothing — the whole screen dims |

Two of those three are not addressable today and gain a data attribute: `TierNode` has
`data-oversight` and `data-gated` but no tier identifier, and the miscreants post has no
identifier at all. `TierRow` already carries `data-tier`.

**A selector that matches nothing dims the whole screen** rather than cutting a zero-sized hole,
which would read as a rendering fault. This is the same fallback the deleted tour used and the
reason it is safe to point at an element that may not exist yet.

### 3.3 The deck must bring the target forward

The deck keeps every panel mounted and hides the shut ones, so during the Taskmaster beat a player
sitting on the Misdeeds tab has the target in the DOM with a zero-sized rect. The spotlight would
fall back to dimming everything and the player would never learn where to look.

So **a gated beat opens the panel its target lives in**. `Deck` owns its open tab in private state
today and gains an optional requested tab: when that changes, the deck opens it. Absent, the deck
behaves exactly as it does now.

This is a real behavior change — a beat can move the player's open tab — and it is the point. The
alternative is pointing at nothing.

The target is also scrolled into view, smoothly under full motion and instantly under reduced.

### 3.4 The bar itself

Larger type and a stronger ground, so it reads as the thing being said rather than a status line.
It keeps its pinned position, its two voices, and its z-order **above** the scrim: the dimming
must never fall across the words explaining it.

Three layers, and they may not be reordered: scrim, then the prompt bar, then the return summary,
which takes the screen from everything.

---

## 4 Copy

One line changes. `stir` becomes:

> "One Minion, big dreams, and the favor of an otherworldly abomination. Set it about some
> wickedness."

It plants her in the first sentence, before she ever speaks, so her arrival later is a payoff
rather than an introduction.

---

## 5 What is deliberately not built

**No pointing hand.** A drifting finger toward the live control was considered. The spotlight and
the ring say "here" in the language the interface already has, and this game's art is
straight-faced gothic drawn flat, silhouettes only — an illustrative hand would be the first
winking element in it. If the spotlight proves not to be enough in play, a flat gothic pointer is
the next thing to try, and it should be added knowing the spotlight was insufficient rather than
instead of finding out.

**No Evil gate on the Malice track.** See §2.2.

**No hysteresis anywhere.** A beat withdrawing when its `ready` stops holding is the model's third
rule, not a defect — it is what makes the earlier spec's §2 edge case work.

---

## 6 Testing

- **The two pathways of §2.1 are named tests**: cave twice and the narrator answers; resist and she
  reaches her fourth line and retires.
- **`clearedBy: 'next-ready'` is unit-tested in the pure module**, including that it does not fire
  while the next beat is unready.
- **The fallback is asserted**: a gate naming an element that is not on screen dims the whole
  screen rather than producing a zero-sized hole.
- **The scrim is proven click-through** — a click lands on the control under the lit region.
- **Reduced motion keeps the ring**, and only drops the pulse.
- The stylesheet contract test gains the scrim's layering, so the bar cannot slip beneath the dim.

---

## 7 Risks accepted

**A gated beat moves the player's open deck tab.** Deliberate, per §3.3, and only ever during the
first run.

**A narrative beat dims the screen with no dismissal on it.** `goad` alone has no button, and her
window bounds the exposure. Her arc runs 45 to 90 seconds against a 120-second window, so in
practice she resolves before it expires.

**The dim is one more thing to tune.** Two weights, and both start from tokens rather than from
taste: the cutout uses the existing `--scrim`, which is what every overlay in the game already
dims to, and the whole-screen narrative dim gets a lighter sibling token beside it. Starting
values are `--scrim` unchanged for the cutout and roughly half its opacity for the narrative dim.
They are starting values — the right ones come from playing it — but nothing here is left for the
implementer to invent.
