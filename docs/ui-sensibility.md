# Interface Sensibility

**The front-end bar for Dread Majesty.** How a person moves through this game, and what it owes
them at every step. Normative for everything in `apps/web`.

> **How to read this:** every section is normative. "Prefer", "always", "never" are deliberate.
> Where two rules collide, the more specific one wins. Section numbers are stable — source files
> cite them by number, so a section may be rewritten but never renumbered. §21 names the actual
> mechanisms in this codebase.

`CLAUDE.md` holds how to write code here. This holds what the code has to produce.

---

## 0. The bar, in one page

Most games in this genre ship **Level 0** and call it a design system. Level 0 is real work and it
is not enough. **Level 1 is the bar.**

| | **Level 0 — component hygiene** | **Level 1 — the bar** |
| --- | --- | --- |
| Flow | Screens exist and route correctly. | The game **carries** you. Finishing one thing puts you on the next. |
| Landing | A menu of where you could go. | A picture of the work, pushing at the one thing to do. |
| Unit | The record. | The object the person reasons in. |
| Actions | Buttons work. | **One primary per region.** Later choices come after the first, not beside it. |
| Place | Routes remember URLs. | The app holds your place: scroll, cursor, selection, draft. |
| Dead ends | Empty, done and error render. | Every terminal state names what happens next. |
| Color | Tokens exist. A palette is picked. | Tokens carry **jobs**. One color means *act*; none is decoration. |
| Depth | Borders, maybe a shadow. | A named surface stack. Every surface's height is a decision. |
| Headings | Bigger, bolder text. | A heading owns a **surface**, so weight comes from structure. |
| Frame | Routes swap the whole view. | A **persistent frame**. One region changes and transitions. |
| Waiting | A spinner, or nothing. | Placeholders **in place**. Nothing unmounts, nothing moves. |
| Copy | Explains the game. | Shows the material. |
| Model | Mirrors the save blob. | Mirrors the player's model, whatever the blob says. |

The gap is not polish. Each row on the right is a decision the left column never made.

---

## 1. The six failures

Every rule below exists to prevent one of these. Read them as the acceptance criteria for "does
this feel like a game rather than a spreadsheet with a theme".

**1. It reads flat.** No depth, no weight, no hierarchy. A heading is body text at a larger size.
Nothing tells the eye where to start. → **§5, §6**

**2. It reads as pages, not an app.** Opening a panel reloads the view. Scroll jumps to the top.
The chain rebuilds because the rail refetched. → **§7, §8**

**3. It explains instead of showing.** A tier is a name and a number where a silhouette and a
moving ring would do. The cascade — the thing this game is *for* — is described in a sentence
rather than drawn. → **§11**

**4. It buries the thing the player thinks in.** The player reasons in *tiers* and in *the gap
between what they bought and what they have*. A rail that lists rows correctly and never shows
that gap makes them do the arithmetic in their head, forever. → **§2.2, §2.3**

**5. It drives no behavior.** Nothing pushes at the one thing to do next. Five equal buttons, so
none of them is the answer. *The player clicks around and changes nothing* — the whole failure in
one sentence. → **§2, §3**

**6. The model is upside down.** The save records `purchased` and derives `owned`. The player
thinks in what they *have* and what it *cost*. Teach their model; keep the blob's shape to
yourself. → **§2.14**

---

## 2. Flow

**This is the section that separates the two columns in §0.** Everything after it is craft in
service of it. A game can be consistent, accessible and fast, and still leave a person clicking
around changing nothing — because nobody designed the path through it.

Flow is the answer to one question, asked at every point: **what happens next, and who decides?**

### 2.1 Where a person lands

The first screen is a decision about what happens next. It is not a table of contents.

- **It shows the state of the work** — the chain as it actually stands, real counts, the rate —
  sized unequally by what needs attention.
- **It pushes at the one thing the game is for.** Making Evil, and spending it. The single best
  purchase available wears the accent; nothing else does.
- **A tier with nothing to do goes quiet and sinks.** It does not sort to the top and it does not
  wear an accent.
- **The game's name and a description of itself do not appear on the board.** The player knows
  what they opened. The title screen is the one place the game may introduce itself, and it shows
  only on a genuinely fresh run.

### 2.2 The unit is the object the player thinks in

The unit is the **tier** — not the row, not the generator record. Every count, every label and
every panel title is denominated in tiers.

The second unit is the **gap**: what was bought against what is held. That gap *is* the cascade,
and it is the one number the player cannot derive without help. The rail states what was
purchased; the stage states what is held; the player reads the difference and understands the
game. Do not collapse those into one figure.

When the save shape and the mental model disagree, see §2.14.

### 2.3 A task is a run, not a list

A **list** makes the player choose, repeatedly, before doing anything. A **run** chooses for them
and asks only for the judgment.

The buy rail is a run. It lifts exactly one purchase — the best available — and leaves every other
row reachable at secondary weight.

- **One lifted thing at a time.**
- **The lifted row is sized to the decision**, not blown up to fill the screen.
- **Everything the decision needs is on that one row**: what it makes, how often, what it costs.
  Nothing the player must open a panel to learn.

### 2.4 Finishing advances

- **Acting moves you on.** The accent moves to the next best purchase the moment one lands.
- **Exhausting a stage names the next.** A tier going obsolete, a prestige becoming worthwhile —
  each says what is coming rather than silently changing.
- **Leaving early is always available** and costs nothing. The first-run tour is skippable at the
  first prompt and never returns.

### 2.5 A handoff between areas goes through one declared seam

When one area sends the player into another, that jump is **declared in one place both sides
read**, and neither area imports the other.

The deck's tabs, the onboarding beats and the prestige panel all reach each other this way. Two
areas is a link; five areas is twenty links, of which the ones nobody declared are the ones that
rot. A single declared list is also the complete, readable set of paths through the game — which
is the artifact you want when asking whether a flow can dead-end.

### 2.6 Sequence decisions; do not flatten them

Too many choices at one level is fixed by **ordering** them, never by deleting any.

This is why the chain draws only the tiers the player has met plus the one above them. Three
sealed discs beside a single live node is a wall; one named rung ahead is a goal.

A second-level decision appears **after** the first is made, and never blocks: by the time it
renders, the flow has moved on, and ignoring it costs nothing.

### 2.7 The app holds your place, not you

Every one of these is a place a person loses their footing:

- **Scroll position is remembered per panel and restored on return.** Scroll jumping to the top is
  the loudest tell that something is a page and not an app.
- **A cursor keys on identity, never on position.** Anything keyed on index restarts at the top
  every time the list is rebuilt.
- **A filter that shrinks a list clamps the cursor**, it does not reset it.
- **Selection, expansion, the open tab and the buy quantity survive a reload.**

### 2.8 A dead end is a bug

Every terminal state names what happens next: nothing affordable yet, nothing left to appoint,
a tier not yet reached, a prestige not yet worth taking.

"Nothing here" is not a design. The empty state is the highest-leverage screen in the game — it is
what a new player sees first, and the only screen where a call to action has no competition.

### 2.9 Reversal is part of the flow

- **Writes land immediately.** The engine is local and synchronous; there is no request to wait on
  and nothing may pretend there is.
- **Anything irreversible says so before it happens, once.** Prestige takes everything and cannot
  be undone; it says that in as many words and asks.
- **Every control disables together while a confirm is open**, so a second input cannot race it.

### 2.10 Choose the depth of each step

Three depths, and picking wrong is most of what makes an interface feel heavy:

| Depth | Costs | Use for |
| --- | --- | --- |
| **A full-screen take-over** | Changes where you are | The title screen, the return summary, a confirm |
| **An overlay** | Borrows attention, gives it back | A decision that needs focus and then returns you |
| **An inline reveal** | Nothing | Detail, history, the ledger, a tier's numbers |

**Anything that today needs only a scroll to reach becomes a reveal or a panel.** A board you must
scroll to act on has already lost the player.

### 2.11 Interruption and resumption

An idle game is *made of* interruption. This is not an edge case; it is the product.

- **Coming back is a designed screen, not a diff.** The return summary says what happened while
  the player was gone, in the game's own words.
- **It survives a reload mid-anything** by rehydrating from the save, not from memory.
- **Coming back in a week works** and produces the same numbers as sitting there for a week —
  one `step`, called from both paths.

### 2.12 Speed is part of flow

The interface responds to the input, not to a response. 100ms is the threshold where an action
feels *caused* rather than *requested*.

The engine is local, so there is no excuse for missing it. A frame that never rebuilds is how you
keep it under load.

### 2.13 Accelerate the repeated path

Buying is the repeated action, so it gets a fast path: the quantity chips (×1, ×10, ×100, ×max).

- **The accelerator is printed on the control it triggers.**
- **An accelerator never fires while the player is entering text.** One guard, checked centrally.
- **The fast path is an accelerant, never the only path.** Everything reachable by chip is
  reachable by a plain buy.

### 2.14 Model the player's model, not the storage

When the save shape and the mental model disagree, **the UI follows the mental model.**

The save records what was purchased because that is what the cost curve needs. The player thinks
in what they hold. Show both, name them honestly, and let the difference teach the cascade —
rather than exposing the blob's shape and making them translate on every screen.

This may cost a save migration. Pay it. The alternative is a permanent tax on everyone who plays.

---

## 3. One action per region

Every region answers "what is the one thing to do here" before it is designed. Two answers in one
region means two regions, or two screens.

**Five equal buttons is the failure.** Give a set of actions real tiers:

| Tier | Weight | Use |
| --- | --- | --- |
| Primary | The accent, filled | The one action. Exactly one per region. |
| Secondary | Structural outline | Real alternatives that ask for another pass. |
| Quiet | Ghost, no chrome | Reachable, never competing for the eye. |
| Destructive | Danger tone, quiet weight | Never primary, never the default. |

**Navigation is not an action.** A control that takes you somewhere is structural. The accent is
spent on doing, never on going.

**What counts as a region.** A part of the screen a person attends to as a whole, and can tell
apart from its neighbors without being told: the live chain beside the panelled deck is two. A
row, a card and a list are not — they are the inside of one region, and one accent covers them
all. Split a screen into regions to describe it, never to license a second accent.

The failure this rule guards against is five equal buttons competing, not two accents in two
places a person can learn. What must never happen is the accent *moving*: an accent that is
sometimes here and sometimes there is worse than two that always are.

**Emphasize by de-emphasizing.** When something will not stand out, the fix is usually to quiet
its neighbors, not to shout louder. The spotlight does this literally, and it dims to the weight
the moment deserves — full when a control is genuinely held back, soft when nothing is.

---

## 4. Tokens

### 4.1 Three tiers, one direction

```
primitives  →  semantic  →  component
 raw values    named jobs    narrow overrides
```

Each arrow is one way. A reverse reference is a cycle.

- **Nothing outside `tokens.css` names a primitive.** No screen, no component, no style rule holds
  a raw color, a raw measure or a raw duration.
- **Semantic is the layer everything consumes.** Name the job, never the value: `--surface`,
  `--line`, `--accent`, `--well`. Never `grey-800`, never `orange`.
- **Component tokens are for the narrow case** where one component needs an override the semantic
  layer would distort. Adding one is a decision, not a shortcut.

### 4.2 Theming is one switch

**This game is forced dark and single-theme, deliberately.** A gothic game commits to a look. That
does not make the token contract optional:

- Themes are **complete blocks of the same token set**, never a second stylesheet and never
  per-component conditionals. A theme declaring a subset half-applies, and half-applied is worse
  than absent.
- **The parity test stays even with one theme.** It costs nothing and it pins the contract the day
  a second one arrives. `tokens.test.ts` reads the definitions and asserts the sets match.
- **Resolve tokens at runtime, not at build time.** Wherever a value can stay a reference until it
  is drawn, keep it a reference — that is what lets a stylesheet take a drawing's color over,
  which the chain does while a blow is running.

### 4.3 A second theme is not a dimmed first theme

If one ever arrives: recolor it. A warm accent desaturated over a warm light ground goes muddy or
pink; the fix is to hold the accent's hue and cool the ground, not to lower saturation. Structural
colors can hold their value across themes — the ground and the ink are what change.

### 4.4 One surface stays hue-free

Any surface behind **content the player is judging** — art, a chart, a swatch — is hue-free and
sits outside the theme's warmth. A tinted ground tints the very thing they are there to assess.

---

## 5. Depth and color

Three rules carry the whole palette.

**1. One color means act, and it is gold.** The accent marks the single thing to do in a region.
Nothing else earns it. *A sprinkled accent is exactly why nothing stands out.* Gold at low weight
is line work (`--accent-line`), a fill that reports progress rather than offering an action
(`--accent-soft`), and the ground such a fill runs over (`--accent-well`) — none of those is the
action.

**2. One color carries structure, and never fills.** Rules, hairlines, heading bands, the active
mark. All line work. A structural fill reads as an action, and only the accent means act.

**3. Depth comes from a surface stack, not from drop shadows.** `--ground`, then `--surface`, then
`--surface-panel`, then `--surface-raised`, each a step lighter. A drop shadow reads as a sticker
laid on the page; a lighter surface reads as a layer *of* it.

> **Divergence, stated on purpose.** *Refactoring UI* teaches elevation through shadows — an
> ambient one plus a direct one, consistent with a single light source. That is right for light,
> airy interfaces. For a dense dark game it is wrong: shadows vanish on dark grounds, and forty
> stacked panels turn to mud. The surface stack is the dark equivalent, and it keeps the book's
> real point: **elevation must be a system, not a per-component guess.**

Supporting rules:

- **Use fewer lines.** A change of ground, or more space, separates two regions better than a
  rule. Reach for a rule when the two regions share a surface.
- **Never muted text on a colored ground.** Derive the muted tone from that ground — same hue,
  adjusted lightness — or it reads as dirt.
- **Color is never the only carrier.** A state needs a word or a glyph as well as a tone.
- **Every tone is enumerated and named**, and every one is measured against `--surface` rather
  than picked by eye. `tokens.test.ts` recomputes those ratios; change a value and it tells you
  what it did. Ad-hoc greens accumulate into six greens.
- **A tone belongs to one thing.** Ember is Evil. Verdigris is her. Ash is the realm's patience.
  Nothing borrows another's tone, and no tone sits within 45° of gold — gold means act.

---

## 6. Type, and the heading problem

**A heading gets weight from structure, not from size.** The failure is a heading that is body
text at 1.5×, floating over its own content with nothing tying them together.

One primitive fixes it, and every titled region is built from it:

```
┌══════════════════════════════┐  ← the band: its own raised surface,
║  ⚒  MUSTER              4/5  ║    a structural rule beneath it,
└══════════════════════════════┘    glyph left, count or state right
  ┌────────────────────────┐      ← the body: inset, recessed one step
  │  content sits recessed │
  └────────────────────────┘
```

- The heading owns a **surface**, not just a size.
- The body is **inset and one step back**, so heading and content read as one built unit.
- Four slots cover nearly every titled region: title, glyph, a count or state set to the trailing
  edge, and actions. A fifth is a smell.
- **Build it once, before the second panel needs it.** Eight hand-laid headings produce eight
  spacings.

Type rules:

- **One scale.** Sizes come from `--text-*`; nothing is nudged to fit.
- **Headings are tight and unshouty.** The numbers on screen are the loud part.
- **Two families, and the split is meaningful.** `--font-text` is a serif and carries the voice.
  `--font-numeric` is monospaced and carries anything compared character by character: counts,
  rates, costs, durations. A number that changes in place must not reflow the text around it.
- **Number formatting is one shared function**, used everywhere. It is among the most-read text in
  the game.

---

## 7. The frame

**The frame persists; one region changes.** This is the single largest jump from Level 0.

```
┌───────────────────────────────────────────────────┐
│ 62 Evil per second  ·  Enact your will            │ ← the crown: rate and standing
├───────────────────────────────────────────────────┤
│  ◌ ── ◌ ── ◌ ── ◌ ── ◌            ┌───────────┐   │ ← the stage: the chain,
│  the chain of production          │   EVIL    │   │   one node per met tier,
│                                   │   SMITE   │   │   the Evil node at its end
│                                   └───────────┘   │
├───────────────────────────────────────────────────┤
│ ⚒ MUSTER  │  ◆  │  ★  │  ▼                        │ ← the deck: tabbed panels,
│  ┌─────────────────────────────────────────────┐  │   one open at a time
│  │  the buy rail, one row lifted               │  │
│  └─────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────┤
│ ▸ a line naming the next thing to do              │ ← the prompt bar
└───────────────────────────────────────────────────┘
```

**The crown** never moves and never rebuilds. It carries the rate and, when there is one, the
standing that outranks it.

**The stage** is the chain. It draws every tier the player has met and one above them (§2.6). It
is the only region that is *always* visible, because it is the game.

**The deck** offers a slot; each panel puts its own content there. The payoff: the contract
between deck and panel never grows a field per panel, and the deck survives every tab change.

**The prompt bar** is the lowest layer of chrome and the highest layer of attention. Nothing may
dim it — the spotlight sits beneath it precisely so the dim never falls across the words
explaining it. That z-order is pinned by a test.

- Changing tabs **transitions**. It does not rebuild the tree.
- **Place is restored on return** (§2.7).

**Collapse is one decision, shared.** Below a threshold the deck becomes a drawer. Every part
reads the same answer so they can never disagree about whether there is room.

- **A closed drawer is inert** — not merely hidden. Someone moving through the interface in order
  must land on the board, never inside a panel they cannot see. The same applies to a full-screen
  take-over: while the title screen or the return summary is up, the frame behind it is `inert`.
- **A glyph-only control keeps its name.** The visible label goes; the accessible name does not.

---

## 8. Motion

- **One vocabulary, defined once.** `--duration-fast` for a state change, `--duration-base` for a
  transition, `--duration-slow` for anything rare and large. No component invents a timing, and
  anything slower is composed from a token rather than written flat.
- **One house transition:** a fade plus a short rise. Something entering eases out; something that
  moves and settles eases in and out.
- **Reduced motion is designed, not stripped.** This game *is* motion, so the reduced branch is
  its own design rather than an absence: rings jump instead of sweeping, motes fade in place
  instead of traveling, numbers still roll. **Nothing visible under normal motion may go missing
  under reduced motion.** The preference lives beside the durations and every animated primitive
  reads it, so no caller has to remember.
- **Motion earns its place by explaining a change.** It never decorates a state that did not
  change. A pulse that urges before there is anything to urge is the failure — a blip the eye
  catches is enough.

---

## 9. Waiting, emptiness, failure

- **Placeholders in place, never a swapped view.** The container stays; only its contents change.
  A card that rebuilds makes the whole screen jump, which is a worse lie about progress than a
  spinner.
- **Size a placeholder to the content it stands for**, so nothing moves when the real thing lands.
- **Reduced motion drops the shimmer, not the block.**
- **A neighboring region never rebuilds because its sibling is reloading.** Ever.
- **Nothing a row can hold may push the page sideways.** A number that grows, a name that runs
  long, a state that appears — each wraps, truncates or scrolls inside its own container. The
  board is the one thing that must never move under the player.
- **The boot screen holds until the save has actually been read** — not for a fixed time. A splash
  on a timer is a lie about progress, and here it would also risk showing a fresh board to a
  returning player.
- **A failure says what broke and what to do.** An expected absence — no save yet, sound not asked
  for — is a state, not an error, and the feature hides rather than failing mid-flow.

---

## 10. Forms and input

This game has almost no forms. The rules that apply, apply anyway — to the save import field, the
buy quantity, and the dev workbench.

- **Every control has a real label bound to the real control.** Nothing relies on nesting or on
  placeholder text.
- **Validate and normalize at the boundary, and name the field that failed.** A pasted save blob
  that is malformed says so, in the game's voice, and changes nothing.
- **A required marker is an annotation, not an action** — danger tone, never the accent.
- **Never present a wall.** If a flow ever needs more than a few fields, step it.

The dev workbench is the deliberate exception and looks nothing like the game, so that it can
never be mistaken for it. It is stripped from production builds.

---

## 11. Show, do not explain

- **The board never explains itself.** No name, no blurb, no tutorial text that outlives its
  moment.
- **Surface the real material**, sized unequally by what needs attention: the chain, the counts,
  the rings actually turning. Not a row of labelled numbers.
- **Replace a label with a glyph wherever the label is not the point** — but the accessible name
  always survives the label.
- **A drawing beats a sentence about the drawing.** Every tier has a silhouette that can be told
  from its neighbors by outline alone, at rail size, before any detail resolves. That is what
  makes the chain readable at a glance instead of readable by reading.
- **The writing carries the tone, and the numbers carry the joke.** Neither is decoration.

---

## 12. Presentation follows data

**No screen decides what color a state is.** Each enumerated state carries its own tone and label
in the content layer, and one shared component reads them.

- The art manifest names a **semantic token** for each slot; `TierArt` resolves it. No screen
  decides what color a tier is, which is why tone rides with the data and a stylesheet can take it
  over when the whole stage burns.
- One place, and one only, turns a tone into a look.
- Adding a state in the content layer makes it render correctly everywhere with no UI change.
- A state meaning "not yet decided" renders **nothing**, not a chip saying unknown. Absence of a
  judgment is not a status.

---

## 13. The accessibility floor

Not a phase. Build-time rules, and WCAG 2.2 AA is the floor.

- **A visible focus indicator on everything focusable.** Set once, from the accent, with an
  offset. Never removed without a replacement.
- **Focus is never obscured** by fixed chrome, a drawer or a floating bar (2.4.11).
- **Targets are at least 24×24, or spaced** so a near miss cannot hit the wrong one (2.5.8). This
  game is built on repeated tapping; a mis-tap is not a minor annoyance here.
- **Anything draggable has a single-pointer alternative** (2.5.7).
- **Never re-ask for information already given** in the same flow (3.3.7).
- **Help sits in the same place on every screen** that offers it (3.2.6).
- **Reduced motion is honored** (§8).
- **Use the platform's own primitive** for dialogs and menus wherever one exists. It supplies the
  focus handling and the dismissal behavior a hand-rolled version always gets wrong.
- **Pinch-zoom is never taken away.** Double-tap may be dropped — a game of repeated tapping fires
  it by accident constantly — but zoom stays.

---

## 14. Rules that are engineering and design at once

Enforced in review, because each is a screen that does not survive real data.

- **Design every screen against the largest plausible number, never the seed data.** This game
  reaches 1e30 in a week and past 1e300 eventually. A layout that only works at four digits is a
  layout that breaks on day two. There is a dev jump that sets 1e80 of everything for exactly
  this.
- **A number that changes in place must not move its neighbors.** Monospaced figures and reserved
  width, or the whole row twitches every tick.
- **Art loads from an address the component is handed**, never a location it builds. That is what
  lets a slot go from a drawn fallback to a real file with no component edit.
- **Nothing in the build may depend on an art tool being reachable.** Every slot renders something
  with zero image files present.

---

## 15. What to test

Test the structural half properly and the visual half stays a person's job.

**Always tested:**

- **The token contract** — every theme declares the same set, and every measured ratio holds
  (§4.2, §5).
- **Layer order** — the dim never falls across the prompt bar; a take-over sits above both. Three
  files, one order, and nothing may reorder them.
- **Collapse and take-over behavior** — a closed drawer is inert, a glyph-only control keeps its
  name, the frame behind a take-over is inert.
- **Place-keeping** — a cursor keys on identity and survives a rebuild; a shrinking list clamps
  rather than resets.
- **Every terminal state**: nothing affordable, nothing left to appoint, nothing yet reached.
- **The reduced-motion branch** of every animated primitive.

**Not worth automating:** exact spacing, exact color, anything an image diff would own. Geometry
that jsdom cannot measure is **unverified**, in those words, and gets a browser pass instead.

**Say what is unverified.** "Built" and "working" are different claims.

---

## 16. Naming

`CLAUDE.md` holds the full table. The interface half:

| Concept | Pattern | Example |
| --- | --- | --- |
| Shared primitive | The noun alone | `Panel`, `Sheet`, `Meter`, `Banner` |
| Screen | The noun of what it shows | `TitleScreen`, `OfflineSummary`, `Ledger` |
| Region component | The noun of what it shows | `ChainStage`, `BuyRail`, `TierNode` |
| Hook | `use{Noun}` | `useGameLoop`, `useReducedMotion` |
| Motion constant | A token, never a literal | `--duration-slow` |

Two naming rules that outrank the table:

- **The visible name and the internal id may differ, and a rename is prose only.** Renaming an id
  breaks every save that records it, for no gain to anyone. Ids are permanent.
- **The internal gloss never reaches the screen.** The code says `minion-hand`; the player reads
  "the Taskmaster of the Pits".

---

## 17. Anti-patterns

**Flow**

- ❌ A first screen that is a menu of where you could go.
- ❌ A terminal state that stops at "nothing here".
- ❌ Two areas wired to each other directly instead of through the declared seam.
- ❌ Five choices at one level when three of them follow from the first.
- ❌ Every locked tier drawn at once, so the climb reads as a wall.
- ❌ Scroll jumping to the top on return.
- ❌ A cursor keyed on position, or reset by a filter change.
- ❌ A board you must scroll to act on.
- ❌ A fast path that is the only path.

**Craft**

- ❌ A raw value outside `tokens.css`.
- ❌ A theme declaring a subset of the token set.
- ❌ A screen deciding what color a state is.
- ❌ A heading that is body text at a larger size.
- ❌ Depth by shadow *and* by surface stack, in one app.
- ❌ The accent spent on anything that is not the action.
- ❌ An accent that moves between places.
- ❌ A structural color used as a fill.
- ❌ A tone borrowed from whatever else already owns it.
- ❌ Changing tabs rebuilding the frame.
- ❌ A spinner where a placeholder belongs; a placeholder that resizes when content lands.
- ❌ A region rebuilding because its sibling is reloading.
- ❌ Five buttons at one level.
- ❌ A drawer off-screen but still in the traversal order.
- ❌ A focus indicator removed with no replacement.
- ❌ Anything visible under full motion going missing under reduced motion.
- ❌ A number formatted by a second function.
- ❌ A primitive built inside one screen when a second screen already wants it.

---

## 18. New-screen checklist

1. **Where did the player come from, and where do they go when this is done?**
2. **Name the one action.** Two answers means two regions.
3. **Name the object they think in.** That is the unit of the layout.
4. **Design the empty state first.** Hardest, and most seen.
5. **Decide the depth of each step** — take-over, overlay, or reveal (§2.10).
6. **Everything the decision needs is here**, without scrolling.
7. Compose from **shared primitives**. A missing one gets built in the shared place now, not here
   "for now".
8. **Titled regions use the heading primitive.**
9. **Actions get tiers.** Exactly one primary per region.
10. **Later choices are sequenced**, not laid beside the first.
11. **Waiting is a placeholder in place**, sized to the content.
12. **Place-keeping named**: what is remembered on leaving, what is restored on return.
13. **Traverse it without a pointer**, including every collapsed and inert state.
14. **Reduced motion checked** — and checked for what is still *there*, not just what stopped.
15. **Viewed at the narrow size** and against the largest plausible number.

---

## 19. The "same team" test

The game reads as one product when:

- Finishing something puts you on the next thing, everywhere.
- Every region has one obvious action, and it is the only thing there wearing the accent.
- No flow ends without naming what happens next.
- Returning to a panel lands where you left it.
- Every color resolves to a named job, and every tone belongs to exactly one thing.
- Every titled region is the same primitive.
- The frame never rebuilds.
- Nothing rebuilds to show that it is loading.
- No screen decides what color a state is.
- Every number goes through the one formatter.
- Every glyph-only control has a name, and every closed drawer is inert.

If a screen breaks more than one of these, rebuild it.

---

## 20. Going further

Not required by the bar. The next increment, in rough order of payoff.

- **Keyboard accelerators** on the repeated actions, printed on the controls they trigger, fed
  from one registry shared with the hints.
- **Size queries against the container, not the viewport.** A rail row in a narrow column and one
  in a wide column are the same component asking a different question.
- **A perceptual color space** for token generation, so a tone ramp keeps even lightness steps
  across hues instead of the hand-correction every hex palette needs.
- **Measured latency budgets.** Instrument input-to-paint on the five most-repeated actions, hold
  them under 100ms, treat a regression as a bug.

---

## 21. How these land in this codebase

Normative, unlike the generic appendix this replaced. These are the actual mechanisms.

| Rule | How it is done here |
| --- | --- |
| §4.1 tokens | CSS custom properties in `apps/web/src/ui/tokens.css`, semantic names only |
| §4.2 parity and contrast | `apps/web/src/ui/tokens.test.ts`, which recomputes the ratios from the file |
| §5 tone rides with data | The art manifest names a token; `TierArt` resolves it to `--art-tone` |
| §7 layer order | z-index asserted across three stylesheets in `Spotlight.test.tsx` |
| §7 inert drawer and take-over | The `inert` attribute on `.shell__frame`, handle rendered outside |
| §8 reduced motion | `useReducedMotion`, read inside the primitives, plus a media block on the duration tokens |
| §9 boot holds for the save | The save is read from IndexedDB before the board renders |
| §13 dialogs | The native `<dialog>` element |
| §14 largest plausible number | `break_eternity.js` throughout, and the `absurd` dev jump |

---

## 22. Sources

- **Refactoring UI** — Adam Wathan and Steve Schoger. Hierarchy, emphasis by de-emphasis, fewer
  borders, spacing and type systems, labels as a last resort, empty states deserving design. §5's
  shadow rule is a deliberate divergence, stated in place.
  [Summary](https://howtoes.blog/2025/07/04/refactoring-ui-complete-book-summary-all-key-ideas/) ·
  [Key points](https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802)
- **WCAG 2.2** — the §13 floor.
  [W3C Recommendation](https://www.w3.org/TR/WCAG22/) ·
  [What's new](https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2/)
- **The 100ms rule** — Paul Buchheit via Superhuman; Linear on how a persistent frame and local
  reads get there.
  [Superhuman](https://blog.superhuman.com/superhuman-is-built-for-speed/) ·
  [Linear](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
- **Three-tier design tokens** — primitives → semantic → component, one direction.
  [Architecture](https://timgraf.com/ui/design-token-architecture-2026-the-strategic-blueprint-for-scalable-design-systems/) ·
  [Naming](https://www.netguru.com/blog/design-token-naming-best-practices)
- **Waiting and disclosure** — placeholders over spinners, progressive disclosure.
  [Placeholders vs spinners](https://www.onething.design/post/skeleton-screens-vs-loading-spinners) ·
  [Pattern survey](https://www.designstudiouiux.com/blog/web-app-ui-design-patterns/)

---

*This document is short on rationale and long on rules. Rationale belongs in the pull request;
rules belong here, where they can be applied without re-deriving them.*
