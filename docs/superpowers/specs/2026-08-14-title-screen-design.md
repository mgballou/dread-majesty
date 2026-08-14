# The Title Screen, and a Whole-Number Rate

**Status:** drafted
**Extends:** `2026-08-13-onboarding-design.md` and `2026-08-14-malice-track-design.md`. The beat
model and both tracks stand. This adds a screen in front of the first run and changes one line
of Dominion copy.

Two changes from playtest, unrelated to each other.

---

## 1 The opening line is doing two jobs and fumbling the pronoun

`stir` reads:

> "One Minion, big dreams, and the favor of an otherworldly abomination. Set it about some
> wickedness."

The sentence sets up three nouns and then says *it*. The nearest antecedent is the abomination,
so the line appears to ask the player to set the abomination about some wickedness. The Minion is
meant, and it is four nouns back.

The fix is not a rewrite of the sentence. **The line is carrying the premise and the first
instruction at once**, and the premise is not an instruction — it is the opening of the game and
it deserves its own moment.

---

## 2 A title screen

A screen before the first frame of play:

```
┌─────────────────────────────┐
│                             │
│            🔨               │   the hammer, drawn flat
│                             │
│       Dread Majesty         │
│                             │
│     You are a Dark Lord     │
│                             │
│  One Minion, big dreams,    │
│  and the favor of an        │
│  otherworldly abomination.  │
│                             │
│       [ Start Game ]        │
│                             │
└─────────────────────────────┘
```

It takes the premise off the tutorial's hands, so `stir` becomes a plain instruction with a clear
subject:

> "A trusted lackey who will do your bidding. Set it about some wickedness."

*It* now points at the lackey in the sentence before, and the tutorial's first card teaches one
thing instead of two.

### 2.1 When it shows

**Only on a run with no save of any kind.** The condition is the one `useGameSession` already
answers — `ready && fresh` — plus a latch, so pressing Start Game ends it for the session and
abdicating later cannot bring it back.

**It defers to the return summary.** A fresh session cannot have an offline report, so the two are
mutually exclusive in practice; the rule is stated and enforced anyway, because "what has taken
the screen" is exactly the kind of condition that grows a second answer later and starts drawing
two scrims.

A player who starts, plays for three seconds and reloads sees it again — the autosave lands at ten
seconds, so there is genuinely no save yet. That follows from the rule rather than working around
it, and it is the honest reading of "no save of any kind".

### 2.2 What it is made of

The same shape as `OfflineSummary`, which is the game's one existing full-screen take-over: a
`role="dialog"` with `aria-modal`, a sheet, and exactly one primary action which is the way out.
Reusing that shape rather than inventing a second one is the point — two screens that take the
whole screen should not disagree about how.

Three things follow from that precedent and are not free choices:

- **The shell goes `inert` behind it**, so nobody moving by keyboard lands on a rail they cannot
  see. `App` already computes this for the summary; the flag widens rather than gaining a sibling.
- **The spotlight is withheld** while it is up. Two stacked scrims are darker than either was
  drawn to be — the same reason the summary already withholds it.
- **It sits on the summary's layer**, above the prompt bar. The three-layer order the
  2026-08-14 spec pins does not change; the title screen joins the top layer.

The Start Game button takes focus on mount. This screen is the entry point to the game and has
exactly one action, which is the case where moving focus helps rather than steals.

### 2.3 The hammer

`ArtSlot['fallback']['shape']` gains `'hammer'`, and the manifest gains `mark/dread-majesty`
drawn in the `resource` tone — the Evil tone, which is the game's own color rather than any one
tier's.

It is a generated SVG fallback like every other slot, so the build still depends on nothing. Real
art is dropping a file in and setting `src`, exactly as the manifest's header already says.

The silhouette is flat and straight-faced. The art is never the joke — see the tone note in
`CLAUDE.md`.

---

## 3 The rate reads as a whole number

The crown's *N Evil per second* carries two decimal places below 100 and floors above it. A blow
multiplies the rate through `tierMultiplier` → `globalMultiplier`, and `smiteBlow` is not a round
number, so a surge turns a readable `12.5` into `23.38`.

**The rate moves to `formatWhole`.** Measured against the shipped formatter:

| rate | now | after |
| ---- | --- | ----- |
| 1.25 | 1.25 | 1 |
| 12.5 | 12.5 | 12 |
| 23.375 (surge) | 23.38 | 23 |
| 87.34 (surge) | 87.34 | 87 |
| 116.875 | 116 | 116 |

`formatWhole`'s own doc comment currently argues the opposite — *"Rates are not this. '1.25 Evil
per second' is a true thing to say and the decimal is the information, so the crown's rate line
stays on `formatNumber`."* That paragraph becomes false with this change and must be rewritten,
not left standing. A comment that contradicts its own function is worse than no comment.

The honest cost, recorded rather than hidden: a single automated Minion makes 1.25 Evil a second
and will read as 1. The figure is a headline, the rail still states the exact yield per tier, and
a headline that changes shape when a blow lands was the worse of the two.

Nothing else moves to `formatWhole`. The souls multiplier and the smite standing keep
`formatNumber` — they are not rates and the surge does not make them noisy.

---

## 4 What is deliberately not built

**No "continue" on the title screen.** It shows only when there is no save, so there is nothing to
continue to. A button that is never enabled is worse than a button that is not there.

**No settings, no credits, no menu.** One action. This is the opening of a game about pressing a
button, and the screen should be over in one press.

**No second scrim.** The title screen and the return summary can never both be up, and §2.1
enforces it rather than trusting it.

---

## 5 Testing

- **The gate is three named tests**: shows on a fresh session with no save; does not show when a
  save was loaded; does not show once Start Game has been pressed, including after a later reset.
- **It never coexists with the return summary**, asserted directly.
- **The shell is inert behind it**, and the spotlight is withheld — both asserted, because both
  are the reasons the precedent exists.
- **The Start Game button holds focus** on mount.
- **`stir` no longer carries the premise**: the beat's line does not mention the abomination, and
  the title screen's premise does.
- **The rate is whole**: a rate with a fractional part renders with no decimal point, and the
  surge case is its own test at a value that used to render two places.
