# The Malice Track, Repaired

**Status:** drafted
**Extends:** `2026-08-13-onboarding-design.md` and `2026-08-14-onboarding-presence-design.md`.
The beat model, the Dominion track and the presence work all stand. This changes the Malice
track's timing, its endings, how her lines are chosen, and what happens when both tracks want
the bar.

Second playtest, focused on the smite portion: her lines repeat, the narrator's reply arrives
far too late or twice, the dim sits over a screen with nothing to do, and the dismissal has a
jank nobody could pin down. Four symptoms, three of them one defect.

---

## 1 The defect under most of it

`verdict` — the narrator's closing line, shipped as `apathy` — is the only beat in either
track whose `ready` can stop holding **after it has already appeared**. It waits on
`band-at-least: 2`, and `bandIndex` is `floor(smiteApathy)` at a cap of 3, so it needs Apathy
at 2.0 or over. On the shipped numbers — 20s cooldown, +1 per blow, 45s per point of bleed —
striking on cadence gives:

| Blow | At | Apathy after |
| ---- | -- | ------------ |
| 1st | t=0s | 1.000 |
| 2nd | t=20s | 1.556 |
| 3rd | t=40s | **2.111** — band 2, the beat appears |

It bleeds back under 2.0 at t=45s. **The beat is on screen for five seconds** against a
fourteen-word line, and then withdraws unread. Strike a fourth time and it comes back.

That is one defect wearing three costumes: the ending seen twice, the bar going out from under
the dismiss button, and the narrator arriving "much much later" — because the only route to
him is a three-strike burst on near-perfect cadence.

### 1.1 Withdrawal protects gates, and nothing else

The 2026-08-14 spec §5 says there is no hysteresis anywhere, and treats a beat withdrawing when
its `ready` lapses as the model working. That is right **for a gated beat**, where `ready` means
*can afford the named action* — withdrawal is what stops the tutorial stranding a player on a
purchase they can no longer make.

It protects nothing on a beat that gates no control and is ended by a button. So the rule gains
a boundary rather than an exception:

> **A beat that gates nothing and is cleared by dismissal latches.** Once shown it stays until
> the player dismisses it, whatever its `ready` does afterwards.

Derived from `gate.kind === 'none' && clearedBy === 'dismiss'`, not declared per beat, so it
cannot be set on a gated beat by mistake. It is checked against all three beats it matches
today: `cascade` and `first-blow` both have monotonic conditions, so latching changes nothing
for them; `verdict` is the one that needed it.

---

## 2 Apathy was the wrong hinge

Band 2 is reachable only by striking near the cooldown floor. A player who strikes every
forty-five seconds caves over and over and never crosses it — Apathy bleeds to zero between
blows — and so is handed the ending written for someone who resisted. The mechanism reads a
rate and reports it as a choice.

**The cave count is the honest predicate.** She is superseded by **two caves after she
arrives**. Monotonic, indifferent to cadence, and it is what the narrator's line actually
claims happened.

### 2.1 Count from her arrival, not from zero

This first read "three lifetime blows: the one that summoned her, plus two caves", which
silently assumed exactly one blow precedes her. Nothing guarantees that. Smite is ungated
throughout the opening beat and Malice may not take the bar until that beat is consumed (§6),
so a player is free to strike as often as they like before she can appear — about forty seconds
buys three blows at a twenty-second cooldown.

Three lifetime blows was then satisfied on the frame she first rendered: she was superseded
before she said a word, and the narrator delivered *"You listened to her"* to somebody who had
never seen her. Two blows before rousing was the likelier shape and cost her all but one line.

It is the same fault §2 was written to kill, one level down — a mechanism reading a count and
reporting it as a choice. The count has to start where her conversation does.

`BeatReady` gains `{ kind: 'smites-since-shown', count }`, a separate variant rather than an
overload, and `isBeatReady` takes the blow count at the moment the beat was shown — `null` when
it has not been shown, which reads as false. `goad` declares `smites-since-shown: 2`.

The arrival count is a **distinct fact from the one the retirement clock keeps**. §4.1 re-takes
that one on every blow, so it always equals the live count; a single field would make "caves
since she arrived" permanently zero. Two fields, `arrivedAtSmites` and `clockFromSmites`, and
only the first is ever read as a count.

Apathy keeps the job it is good at — deciding **which** line she is on while she is being
ignored, which is precisely "how far the realm has forgotten you." That is its honest use.

`band-at-least` loses its only consumer and goes, and with it the `bandCount` argument threaded
through `isBeatReady`, `showingBeat` and `supersededBeat`.

---

## 3 She arrives on the blow

`goad.ready` becomes `smites-at-least: 1`, the same condition as `first-blow`. She queues
directly behind the narrator and takes the bar the moment he is dismissed — inside the
twenty-second cooldown, before the player can strike again.

Three things fall out, and only the first was the goal:

- Her opening line reads as a direct answer to what the player just did.
- It gets the whole cooldown to be read in, instead of arriving after it.
- **She stops withdrawing.** `blow-ready-after-first` lapses on every cooldown, so she vanished
  and returned on each cave. That flicker was half of the reported line-repeating.

---

## 4 Her lines were two sets fused into one

The shipped `goad` list has one descending Apathy threshold picking between four lines that are
not the same kind of thing. *"Oh, that was good. Again — while they are still trembling"* is a
**response to a strike**; the other three are a **walk down through being ignored**. Selecting
between them on one axis put the response line behind `apathy > 0.45`, which her first
appearance cleared by 0.106 — about five seconds of dwell. That is the reported "first message
quickly slipped away into the second," and it is a copy structure fault, not a threshold.

Two lists, each keyed to something that only moves one way while it is being read:

**`urging`** — what she says in the cooldown after a blow, indexed by **caves since she
arrived** and clamped to the list. Shown while `smiteCooldownMs > 0`. Monotonic, so it never
repeats and never walks backwards.

| Caves since she arrived | Line |
| ----------------------- | ---- |
| 0 | "Oh, that was good. Again — while they are still trembling. Don't let them settle." |
| 1 | "There. You felt that, didn't you? Once more and they will not settle for a week." |

Two entries, because the second cave supersedes her on the frame it lands. A third line would
be unreachable.

Counted from her arrival for the reason §2.1 gives, and it is the same reason: she is a
character reacting to what she has watched, and the blow that summoned her is the first thing
she saw — so it is answered by her opening line, whoever struck what before she could appear. A
lifetime index started her partway down the list for anybody who struck before rousing anything,
and then, since the clamp had nowhere further to go, gave them that same line again on their
next cave. Splitting `urging` from `waiting` was meant to end exactly that repeat; leaving the
index on a lifetime count kept a narrower version of it alive.

**`waiting`** — what she says once the cooldown is clear and she is being ignored, chosen by
descending Apathy exactly as `goadLine` does now. Thresholds retuned against her real arrival:
she reaches this state at t=20s with Apathy at 0.556, and it hits zero at t=45s.

| Above Apathy | Roughly | Line |
| ------------ | ------- | ---- |
| 0.35 | t=20-30s | "You are being careful. I do like that in you. But careful is not the same as strong." |
| 0.12 | t=30-41s | "No? Then I'll wait with you. I have nothing else. Neither, in the end, do you." |
| -1 | t=41s on | "There. They have forgotten you entirely. That is the moment — take it, and take all of it." |

The last threshold stays negative, so the list is total and `goadLine`'s unreachable fallback
stays unreachable. The content test pinning that holds.

### 4.1 Her window restarts on a blow

`retireAfterMs` drops from 120s to 75s, **and the clock restarts every time the player strikes.**
Without the restart a cave at t=70 would be answered by her giving up ten seconds later.

The general rule, and it is the right one for any beat: *the retirement clock restarts when the
player does the thing the beat is asking for.* `goad` is the only beat this reaches today —
every other beat asking for an action is cleared by it rather than timed out.

### 4.2 One Dominion line counts something it cannot count

Unrelated to Malice, found in the same pass. `cascade` reads *"Five Minions you did not
raise…"* and five is not guaranteed. The Warren yields 5 a cycle, but a second Warren is
affordable inside the first one's sixty seconds — `costRate` is 1.25 on a base of 3000 — and a
smite surge running when the cycle lands multiplies the yield. The beat fires on the Warren
having cycled at all, so the number can be ten, or 7.5.

Drop the count: *"Minions you did not raise, already at work. Everything above feeds what is
below it, all at once. The rest is yours."*

The two source comments that narrate "five Minions" go with it, as does the quotation in the
2026-08-13 spec §4 — it quotes shipped copy, and stale quotations in a spec are how the next
reader learns the wrong thing.

---

## 5 Both endings, and which one you get

`apathy` is renamed `verdict`, since it no longer has anything to do with bands. Its `ready`
becomes `always`, so it shows however her turn ended, and it latches per §1.1.

Its line is chosen by **how `goad` was consumed**, which is a fact recorded once rather than a
number re-read later:

| `goad` ended by | The player | The narrator |
| --------------- | ---------- | ------------ |
| Supersession (3 blows) | Caved twice | "You listened to her. Everyone does, once. Let them rest and the fear returns." |
| Retirement (75s window) | Outlasted her | "You outlasted her. She has nothing else to do but wait. Let them rest and the fear returns." |

Both carry the same second half, because the tip about Apathy is the load-bearing part and is
owed to the player either way. Only the judgment changes.

Reading the band at show time instead would be a trap: the beat latches, so a line picked from a
decaying value would be pinned to whatever the value happened to be on one frame. The flag is
`caved: boolean`, held beside the consumed lists and written down with them, so a reload
mid-verdict resumes on the right line.

### 5.1 What this costs the model

`BeatClearedBy` stops being a bare string and carries its condition:

```ts
export type BeatClearedBy =
  | 'gated-action'
  | 'smite'
  | 'dismiss'
  | { readonly kind: 'superseded'; readonly when: BeatReady };
```

`goad` declares `{ kind: 'superseded', when: { kind: 'smites-since-shown', count: 2 } }` — two
caves after she arrives. See §2.1 for why a lifetime count was wrong.

This is a simplification, not an addition. `supersededBeat` currently asks whether the *next*
beat is ready, which coupled two beats through a condition neither of them stated and forced the
load-bearing note about why it must not require the beat being cleared to be ready. A beat now
says what ends it. That note, and the deadlock it guarded against, both go.

---

## 6 One bar, and who holds it

Two tracks contend for one bar, and today Dominion always wins. That is what produced the
interruption the playtest could not pin down: strike during the ten-minute Dominion track, the
Malice track starts, gets crowded off the bar, and is cut into by the next Dominion beat coming
ready.

**Once the Malice track has started, it holds the bar until it ends.** Nothing is lost by making
Dominion wait: no Dominion beat carries a retirement window, and every one of them is ready off
game state that does not decay. Malice, after the changes above, runs continuously from the
first blow to `verdict` with no gap for Dominion to slip into — she no longer withdraws, and
`verdict` is ready always.

**How long Dominion waits, honestly.** `goad` is bounded by her 75s window, restarted by a blow
the player chose to strike. `first-blow` and `verdict` are not bounded by anything but the
player: both are dismiss-only with no window, so somebody who never presses the button holds
Dominion off the bar for as long as they like. That costs nothing, and the reason is the rule
below rather than any figure — no Dominion beat carries a window, none of them is ready off
anything that decays, and the actions they wait on are recorded whoever is on the bar.

**Which beat is on the bar and which beat an action answers are two different questions.** Both
tracks are resolved every frame; only the bar picks between them. A Malice beat gates nothing,
so every control stays live while she is talking, and a Dominion beat's gated action performed
during her turn consumes that beat unshown. This is not a nicety. Without it, appointing the
Minion Hand while she held the bar left `appoint` unconsumed, ready again the moment Evil
recovered, gating every other control behind a post button that is disabled for good once
filled — no dismissal, no window, and nothing written down, so it survived a reload.

A dismissal is the one action that does not reach past the bar. It is a press on the bar's own
button, so the only beat it can answer is the one on the bar.

**And `ready` means the named action can be performed**, not merely that it is affordable.
`can-afford-overseer` asks `canAppoint`, which refuses a post already filled. A condition that
claims ready for an impossible action is what turned the missing record above into a lock
rather than a repeated lesson.

**A beat whose gated action is already accomplished is consumed, not stalled.** The rule above
closes the lock but opens a stall: a beat that is neither clearable nor ready stops the track
where it stands — no control taken from anybody, but no more tutorial and `done` never written.
`accomplishedBeat` is the fourth answer to "this beat's time is up", beside the player acting,
nobody acting, and the state moving on. It reports the first *unconsumed* beat whose gate names
an action that can no longer be performed, so ordering is untouched: the beat is still consumed
in its turn, by a fact rather than by a click.

Two gate kinds can reach that state, and both are read through the engine's own selectors.
`appoint` — the post is filled. `rouse` — the tier has an automator, which refuses the rouse
outright and leaves `running` false, so `owned-and-idle` and `idle-after-cycle` read ready
against a permanently dead button. `buy` and `none` never can: buying has no terminal state and
`none` names no action. The rouse case is out of reach today only because the two posts cost
1200 Evil and 2.4e7, and prices are not rules.

**One exception, and it is about the way out.** The opening Dominion beat carries the only Skip
tutorial and Load save buttons in the game. Malice does not take the bar while it is showing —
a player who strikes before rousing anything must not lose their exit for the next minute.
Expressed as one condition: Malice takes priority only once the first Dominion beat is consumed.

---

## 7 The dim, and finding the button at all

### 7.1 She points at the strike

A narrative beat dims the whole screen, which is right when there is nothing to do and wrong for
her — she is asking for one specific thing. `goad` frames the Evil node and pulses its ring,
using the cutout that already exists.

This needs **what a beat points at** separated from **what a beat gates**, which are one field
today. They are not the same claim: gating holds every other control back, pointing only draws
the eye. Beats gain an optional `points` naming a control; `spotlightFor` reads it and falls
back to the gate, so every existing beat is unchanged.

That separation is what makes this legal. `GatedControl` still has no `smite` case and Smite
still cannot be gated — she asks, and the player stays free to ignore her, which is the entire
resist pathway. A gate here would delete one of the two endings.

### 7.2 The first blow has to be discoverable

Smite sits outside every cutout for the whole Dominion track, so the tutorial spends ten minutes
quietly telling the player it is not the thing to look at. It is found by fiddling.

The strike button pulses while it is ready and `stats.smites === 0`. It stops the first time it
is used and never returns.

Deliberately **not** on a random long delay. A random timer in the interface makes a
timing-sensitive thing unreproducible in exactly the place it needs tuning, and it would have no
stopping condition. "Never struck a blow" is the actual state being reported, and it ends itself.

It is safe from the first minute now only because §6 fixed the contention — an early strike
starts a Malice track that can finish. It waits for the opening beat to clear, for the same
reason §6 does.

Under `prefers-reduced-motion` the pulse drops and nothing replaces it. This is pure emphasis on
a control that is already visible, labeled and reachable — unlike the spotlight ring, which
carries the pointing and therefore stays.

### 7.3 The rate says nothing about the surge

The blow's whole effect is that production runs harder for a while, and the one figure that
reports production — *N Evil per second* in the crown — does not move a pixel when it happens.
The number changes; nothing says why. The player is left to infer that the button they pressed
at the top of the chain and the figure at the top of the screen are the same subject.

While the blow is running, the rate takes `--tone-resource`. That is not a new decision: it is
the Evil tone, and `EvilNode` already turns it on `[data-smite='active']`. The same tone in both
places is the whole point — one thing lit in two positions reads as one fact, and two different
highlights would read as two.

Carried on a `data-smite` attribute mirroring the one `EvilNode` already uses, so the tone rides
with the data and no stylesheet decides what state the game is in. The figure and the label move
together into their own span; the standing beside them keeps its own color, since it is a
different fact.

Color is not carrying this alone. The standing on the same line already reads *reigning* through
the surge, so the tone is emphasis on something already said in words.

---

## 8 What is deliberately not built

**No Evil gate on the Malice track.** Considered twice now. §6 solves the contention the gate was
being reached for, and the track stays reactive.

**No third ending.** Striking once and never again is the resist path. She was answered once;
outlasting her is what the player did.

**No pointing hand.** Unchanged from the 2026-08-14 spec §5. The cutout now reaches the control
she is asking for, which was the gap that would have justified one.

---

## 9 Testing

- **The five-second window is a regression test**: `verdict` shown, its `ready` made false,
  still on screen. Once `verdict.ready` became `always` no App-level test could shake it, so
  what is asserted there instead is the §5 trap — the verdict holds **one line** while Apathy
  bleeds to zero under it. The latch itself is pinned in `game/onboarding.test.ts`.
- **Both endings are named tests**: two caves after she arrives and the narrator says the player
  listened; 75 seconds of silence and he says they outlasted her.
- **Her turn is hers**: blows struck before Malice may take the bar do not count towards ending
  her. Three strikes before rousing anything still leaves her a full turn — §2.1, and it fails
  on a lifetime count.
- **Cadence independence**: blows spaced far enough apart that Apathy never leaves band 0 still
  reach the caved ending. This is the §2 defect, and it fails on the shipped code.
- **The window restarts**: a blow at t=70s leaves her on screen at t=100s.
- **The two lists are covered separately** — `urging` by caves since she arrived, including the
  clamp and a player who struck before rousing anything; `waiting` by
  descending Apathy including the boundary case where the threshold is exact.
- **Priority**: a beat on each track ready at once puts Malice on the bar, and does not while the
  opening Dominion beat is showing.
- **The pulse ends**: present at zero blows, absent at one, absent under reduced motion.
- **`points` falls back to the gate** for every beat that does not set it, asserted over the
  shipped tracks.

---

## 10 Risks accepted

**Dominion can wait up to about ninety seconds.** It has no windows and nothing decays, so the
cost is a pause, and it buys a Malice conversation that finishes.

**Renaming `apathy` to `verdict` orphans stored progress.** `consumedIds` filters unknown ids,
so anyone mid-track sees that one beat again. It is onboarding, not save data, and it affects
testers rather than players.

**`urging` has two entries against a two-cave supersession.** Deliberate — the second cave ends
her turn on the frame it lands. If supersession ever moves, the clamp keeps the last line rather
than reading off the end.

**Nothing in her track reads a lifetime blow count any more.** Her arrival ends her turn (§2.1)
and her arrival indexes her lines (§4). The one place `state.stats.smites` is still read raw is
`goad.ready` — `smites-at-least: 1`, which is the condition for her to exist at all, and a
lifetime count is the right question there.
