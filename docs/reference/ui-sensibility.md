# Interface Sensibility

A portable specification of the front-end bar: how a person moves through an app, and what the
app owes them at every step. Domain-agnostic and stack-agnostic by design.

Companion to `architectural-sensibility.md`. That document governs what happens behind a
request; this one governs what a person sees and does.

> **How to read this:** every section is normative. "Prefer", "always", "never" are deliberate.
> Where two rules collide, the more specific one wins. Nothing here names a framework. Every rule
> holds for a web app, a desktop app, a native app or a terminal, because every rule is about a
> decision, not a mechanism. §21 maps a few of them onto concrete web machinery for anyone who
> wants the shortcut.

---

## 0. The bar, in one page

Most teams ship **Level 0** and call it a design system. Level 0 is real work and it is not
enough. **Level 1 is the bar.** A new app starts at Level 1 or it is not started.

| | **Level 0 — component hygiene** | **Level 1 — the bar** |
| --- | --- | --- |
| Flow | Screens exist and route correctly. | The app **carries** you. Finishing one thing puts you on the next. |
| Landing | A menu of where you could go. | A picture of the work, pushing at the one thing to do. |
| Unit | The record. | The object the person reasons in. |
| Actions | Buttons work. | **One primary per screen.** Later choices come after the first, not beside it. |
| Place | Routes remember URLs. | The app holds your place: scroll, cursor, selection, draft. |
| Dead ends | Empty, done and error render. | Every terminal state names what happens next. |
| Colour | Tokens exist. A palette is picked. | Tokens carry **jobs**. One colour means *act*; none is decoration. |
| Depth | Borders, maybe a shadow. | A named surface stack. Every surface's height is a decision. |
| Headings | Bigger, bolder text. | A heading owns a **surface**, so weight comes from structure. |
| Frame | Routes swap the whole view. | A **persistent frame**. One region changes and transitions. |
| Waiting | A spinner, or nothing. | Placeholders **in place**. Nothing unmounts, nothing moves. |
| Forms | Fields, correctly bound. | Grouped, with meaning and an example per field. |
| Copy | Explains the app. | Shows the material. |
| Model | Mirrors the schema. | Mirrors the person's model, whatever the schema says. |

The gap is not polish. Each row on the right is a decision the left column never made.

---

## 1. The six failures

Every rule below traces to one of these. They came out of a walk through a working app — one
that passed every test, shipped every feature, and felt like nothing. Read them as the
acceptance criteria for "does this feel like an app".

**1. It reads flat.** No depth, no weight, no hierarchy. A heading is body text at a larger
size. Nothing tells the eye where to start. → **§5, §6**

**2. It reads as pages, not an app.** Navigating reloads the view. Scroll jumps to the top. There
is no persistent frame and none of the furniture a modern app has. → **§7, §8**

**3. It explains instead of showing.** A name and a blurb. Prose on cards. A label where a glyph
would do. Almost no imagery, in a tool whose subject *is* images. → **§11**

**4. It buries the thing the person thinks in.** The queue dumps every row at once. The object
they actually reason about appears nowhere. Finishing one does not carry them to the next.
→ **§2.2, §2.3**

**5. It drives no behaviour.** Nothing pushes toward the one thing the app is for. Setting that
thing up took too long to find. Bare forms invited no editing. *The reviewer clicked around and
changed nothing* — the whole failure in one sentence. → **§2, §3, §10**

**6. The model is upside down.** Storage says a container owns its contents. The person thinks in
a shared shelf that many containers draw from. Neither appeared, so the UI taught the wrong
model. → **§2.14**

---

## 2. Flow

**This is the section that separates the two columns in §0.** Everything after it is craft in
service of it. An app can be beautiful, consistent, accessible and fast, and still leave a person
clicking around changing nothing — because nobody designed the path through it.

Flow is the answer to one question, asked at every point: **what happens next, and who decides?**

### 2.1 Where a person lands

The landing screen is a decision about what happens next. It is not a table of contents and it is
not a menu.

- **It shows the state of the work** — real material, real counts, actual recent output — sized
  unequally by what needs attention.
- **It pushes at the one thing the app is for.** If the app exists to produce X, then starting an
  X is the loudest thing on the screen, above everything else.
- **Something with nothing waiting goes quiet and sinks.** It does not sort to the top and it does
  not wear an accent.
- **The app's name and a description of itself do not appear.** The person knows what they opened.

### 2.2 The unit is the object the person thinks in

Find the noun they reason in. Make it the unit of every list, every count, every screen title.

It is rarely the record. Failure 4 was a queue that listed every row correctly and never once
showed the object the reviewer was actually judging — so they reassembled it in their head, on
every screen, forever.

When storage and the mental model disagree, see §2.14.

### 2.3 A task is a run, not a list

A **list** makes the person choose, repeatedly, before doing anything. A **run** chooses for them
and asks only for the judgement.

For any repeated task — reviewing, triaging, tagging, approving, sorting — **the run is the
default** and the list stays reachable.

- **One item at a time.**
- **The current item is sized to the decision**, not blown up to fill the screen. If close
  inspection matters, an expand control opens it; the resting state stays in the flow.
- **Everything the decision needs is on that one screen.** Nothing the person must scroll for.

### 2.4 Finishing advances

- **Acting moves you on.** Nobody returns to a list to pick the next thing.
- **Exhausting a group moves to the next group,** through a short interstitial that names what is
  coming. A silent jump disorients; a named one reads as progress.
- **Exhausting everything hands off to the next stage of the work.** The end of one flow is the
  start of another, and the app knows which.
- **Leaving early is always available** and costs nothing.

### 2.5 A handoff between areas goes through one declared seam

When one area of the app sends someone into another, that jump is **declared in one place both
sides read**, and neither area imports the other.

Two areas is a link. Five areas is twenty links, of which the ones nobody declared are the ones
that rot. A single seam file also happens to be the complete, readable list of every path through
the product — which is the artifact you want when asking whether a flow has a dead end.

### 2.6 Sequence decisions; do not flatten them

Too many choices at one level is fixed by **ordering** them, never by deleting any.

A second-level decision appears **after** the first is made. It never blocks: by the time it
renders, the flow has moved on, and ignoring it costs nothing. This is the fix for "five things
at once" that does not throw away a feature.

### 2.7 The app holds your place, not you

Every one of these is a place a person loses their footing:

- **Scroll position is remembered per screen and restored on return.** Going into a detail and
  coming back must land where you left. Scroll jumping to the top is the loudest tell that
  something is a page and not an app.
- **A cursor keys on identity, never on position.** Lists refetch and hand back a new array of the
  same items; anything keyed on index restarts at the top every time.
- **A filter that shrinks a list clamps the cursor**, it does not reset it. The person keeps
  roughly their place.
- **A draft survives leaving.** Half-entered work that vanishes teaches people not to start.
- **Selection, expansion and sort survive a refresh.**

### 2.8 A dead end is a bug

Every terminal state names what happens next: empty, finished, failed, nothing permitted, nothing
matched.

"No items" is not a design. An empty state is the highest-leverage screen in the app — it is what
a new person sees first, and the only screen where a call to action has no competition.

### 2.9 Reversal is part of the flow

- **Writes are optimistic.** The acted-on item leaves the list at once; the refresh follows. "I
  rejected it and it was still there" is the bug this prevents.
- **Undo has exactly one home**, and it targets an item **by its own identity** — never "whatever
  is on screen now". An undo control sitting beside the action operates on the wrong thing,
  because the flow has already advanced.
- **One action per item, per run.** One door in, one door back.
- **Undo is scoped to the run.** It must not reach something done in another context, in another
  window, an hour ago.
- **Every control disables together while a write is in flight**, so a second input cannot race
  the first.

### 2.10 Choose the depth of each step

Three depths, and picking wrong is most of what makes an app feel heavy:

| Depth | Costs | Use for |
| --- | --- | --- |
| **A new screen** | Changes where you are | A real change of task |
| **An overlay** | Borrows attention, gives it back | A decision that needs focus and then returns you |
| **An inline reveal** | Nothing | Detail, history, settings, source text |

**Anything that today needs only a scroll to reach becomes a reveal or an overlay.** That is what
keeps a flow one screen tall. A screen you must scroll to act on has already lost the person.

### 2.11 Interruption and resumption

A flow that assumes one uninterrupted sitting will break on the first phone call.

- **Long work reports progress**: the current step, count against total, a projected finish, and
  failures as they happen.
- **It survives a reload mid-run** by rehydrating from a status call, not from memory.
- **Cancelling is non-destructive and resumable.** Stop after the current unit; leave everything
  already done in place.
- **Coming back tomorrow works.** The app knows what was finished and what was not.

### 2.12 Speed is part of flow

The interface responds to the input, not to the response. 100ms is the threshold where an action
feels *caused* rather than *requested*; the products people call fast target half that.

Optimistic writes, cached reads and a frame that never rebuilds are how you get there. None of it
needs a faster backend.

### 2.13 Accelerate the repeated path

Once a task is a run, the run gets a fast path — keys on a desktop, gestures on a touch device, a
palette anywhere.

- **The accelerator is printed on the control it triggers.** That is how it gets learned without
  anyone reading a help page, and it is what eventually makes the help page unnecessary.
- **One registry feeds the handlers, the hints and the help overlay.** Three surfaces, one list.
- **An accelerator never fires while the person is entering text.** One guard, checked centrally.
- **Reserve system-level combinations for the system.** Hijacking a platform shortcut in a tool
  is rude.
- **The fast path is an accelerant, never the only path.** Everything reachable by accelerator is
  reachable by pointer.

### 2.14 Model the person's model, not the storage

When the schema and the mental model disagree, **the UI follows the mental model.**

Failure 6 was a UI that taught the storage layout instead of the concept, so every person then
carried two models and translated between them on every screen.

This may cost a migration. Pay it. The alternative is a permanent tax on everyone who uses the
app.

---

## 3. One action per screen

Every screen answers "what is the one thing to do here" before it is designed. Two answers means
two screens.

**Five equal buttons is the failure.** Give a set of actions real tiers:

| Tier | Weight | Use |
| --- | --- | --- |
| Primary | The accent, filled | The one action. Exactly one per screen. |
| Secondary | Structural outline | Real alternatives that ask for another pass. |
| Quiet | Ghost, no chrome | Reachable, never competing for the eye. |
| Destructive | Danger tone, quiet weight | Never primary, never the default. |

**Navigation is not an action.** A control that takes you somewhere is structural. The accent is
spent on doing, never on going.

**Emphasize by de-emphasizing.** When something will not stand out, the fix is usually to quiet
its neighbours, not to shout louder.

---

## 4. Tokens

### 4.1 Three tiers, one direction

```
primitives  →  semantic  →  component
 raw values    named jobs    narrow overrides
```

Each arrow is one way. A reverse reference is a cycle.

- **Nothing outside the token definition names a primitive.** No screen, no component, no style
  rule holds a raw colour, a raw measure or a raw duration.
- **Semantic is the layer everything consumes.** Name the job, never the value: *surface*, *line*,
  *accent*, *well*. Never *grey-800*, never *orange*.
- **Component tokens are for the narrow case** where one component needs an override the semantic
  layer would distort. Most projects need very few. Adding one is a decision, not a shortcut.

### 4.2 Theming is one switch

- Themes are **complete blocks of the same token set**, never a second stylesheet and never
  per-component conditionals. A theme declaring a subset half-applies, and half-applied is worse
  than absent.
- **Pin that with a test.** Read the token definitions, compare the set of names declared in each
  theme, assert equality. Ten lines that kill a whole class of bug forever.
- **Resolve tokens at runtime, not at build time**, so one switch repaints everything. Wherever
  the platform allows a value to stay a reference until it is drawn, keep it a reference.
- **An explicit choice beats the system preference in both directions.** Follow the platform
  theme, then let the person override it either way. A toggle that can only go darker is a bug.

### 4.3 A second theme is not a dimmed first theme

Recolour it. A warm accent desaturated over a warm light ground goes muddy or pink; the fix is to
hold the accent's hue and cool the ground, not to lower saturation. Structural colours can hold
their value across themes — the ground and the ink are what change.

### 4.4 One surface stays hue-free

Any surface behind **content the person is judging** — an image, a video, a swatch, a chart — is
hue-free and sits outside the theme's warmth. A tinted ground tints the very thing they are there
to assess.

---

## 5. Depth and colour

Three rules carry a whole palette. Name yours; these are the shape.

**1. One colour means act.** The accent marks the single thing to do on this screen, and a count
of work still waiting. Nothing else earns it. *A sprinkled accent is exactly why nothing stands
out.*

**2. One colour carries structure, and never fills.** Rules, hairlines, heading bands, the active
navigation mark, the cursor. All line work. A structural fill reads as an action, and only the
accent means act.

**3. Depth comes from a surface stack, not from drop shadows.** Ground, then panel, then raised,
each a step lighter, plus a hairline highlight on the top layer. A drop shadow reads as a sticker
laid on the page; a lighter surface reads as a layer *of* it.

> **Divergence, stated on purpose.** *Refactoring UI* teaches elevation through shadows — an
> ambient one plus a direct one, consistent with a single light source. That is right for light,
> airy interfaces. For a dense dark tool it is wrong: shadows vanish on dark grounds, and forty
> stacked panels turn to mud. The surface stack is the dark-tool equivalent, and it keeps the
> book's real point: **elevation must be a system, not a per-component guess.** Pick one mechanism
> and hold it.

Supporting rules:

- **Use fewer lines.** A change of ground, or more space, separates two regions better than a
  rule. Reach for a rule when the two regions share a surface.
- **Never muted text on a coloured ground.** Derive the muted tone from that ground — same hue,
  adjusted lightness — or it reads as dirt.
- **Colour is never the only carrier.** A state needs a word or a glyph as well as a tone.
- **Every tone is enumerated and named** — positive, info, warning, danger, done, neutral. Ad-hoc
  greens accumulate into six greens.

---

## 6. Type, and the heading problem

**A heading gets weight from structure, not from size.** The failure is a heading that is body
text at 1.5×, floating over its own content with nothing tying them together.

One primitive fixes it, and every titled region in the app is built from it:

```
┌══════════════════════════════┐  ← the band: its own raised surface,
║  ⚒  SECTION TITLE       14/20║    a structural rule beneath it,
└══════════════════════════════┘    glyph left, count or state right
  ┌────────────────────────┐      ← the body: inset, recessed one step
  │  content sits recessed │
  └────────────────────────┘
```

- The heading owns a **surface**, not just a size.
- The body is **inset and one step back**, so heading and content read as one built unit.
- Four slots cover nearly every titled region: title, glyph, a count or state set to the trailing
  edge, and actions. A fifth is a smell.
- **Build it once, before the second screen needs it.** Eight hand-laid headings produce eight
  spacings.

Type rules:

- **One scale.** Sizes come from the scale; nothing is nudged to fit.
- **Headings are tight and unshouty.** The material on screen is the loud part.
- **Two families at most** — one for text, one monospaced. Monospace carries anything compared
  character by character: counts, ids, hashes, durations, coordinates.
- **A label never lays itself out.** Label, hint and error come from one field primitive handed
  the control. This is how eight forms avoid eight spacings.

---

## 7. The frame

**The frame persists; one region changes.** This is the single largest jump from Level 0.

```
┌──┬──────────────┬──────────────────────────┐
│▤ │ SECTION      │                          │
│  │ ─────────    │                          │
│▣ │ ▸ Item    12 │      T H E   S T A G E   │
│  │ ▸ Item       │                          │
│◈ │ ▸ Item       │   one thing at a time    │
│  │              │   transitions on change  │
│⚙ │ ── filters ──│   spine and panel never  │
└──┴──────────────┴───rebuild────────────────┘
 spine   section panel        stage
 (frame owns)  (section owns)
```

**The spine** holds one entry per top-level area. It never moves and never rebuilds. The current
item takes a structural mark — a bar, a tint — never a fill. Work waiting takes an accent count.

**The section slot** lets an area fill a sidebar **without the frame learning what is in it**. The
frame offers a slot; a section puts its own panel there. The payoff: the contract between frame
and section never grows a field per section, the frame never imports a section's navigation, and
the frame survives every navigation.

**The stage** is the one region content occupies, one screen at a time.

- Changing screens **transitions**. It does not rebuild the tree.
- **Place is restored on return** (§2.7).

**Collapse is one decision, shared.** Below a threshold the spine drops to glyphs and the section
panel becomes a drawer. Both read the same answer so they can never disagree about whether there
is room.

- A manual override **holds until the viewport crosses the threshold again**, then the automatic
  answer takes back over. An override that sticks forever strands someone in a layout the window
  no longer fits.
- **A closed drawer is inert** — not merely hidden. Someone moving through the interface in order
  must land on the stage, never inside a panel they cannot see. The handle stays outside the inert
  region or the drawer can never reopen.
- **A glyph-only control keeps its name.** The visible label goes; the name does not.

---

## 8. Motion

- **One vocabulary, defined once.** Durations and easings live in exactly one place. No component
  invents a timing. Three durations is usually the whole set: fast for a state change, base for a
  screen transition, slow for anything rare and large.
- **One house transition:** a fade plus a short rise. Something entering eases out; something that
  moves and settles eases in and out.
- **Reduced motion drops movement, never content.** Strip the rise, keep the fade. Nothing that
  would show under normal motion may go missing under reduced motion. The preference lives beside
  the durations and every animated primitive reads it, so no caller has to remember.
- **Motion earns its place by explaining a change.** It never decorates a state that did not
  change.

---

## 9. Waiting, emptiness, failure

- **Placeholders in place, never a swapped view.** The container stays; only its contents change.
  A card that rebuilds makes the whole screen jump, which is a worse lie about progress than a
  spinner.
- **Size a placeholder to the content it stands for**, so nothing moves when the real thing lands.
  A multi-line block runs its last line short, because that is what wrapped text does.
- **Reduced motion drops the shimmer, not the block.**
- **A neighbouring region never rebuilds because its sibling is reloading.** Ever.
- **A boot screen holds until the first real data arrives** — not for a fixed time. A splash on a
  timer is a lie about progress.
- **A failure says what broke and what to do.** An expected absence — no data yet, an optional
  service missing — is a state, not an error, and the feature hides rather than failing mid-flow.
- **When a capability may be missing, ask before offering it.** A status check that never throws
  lets the UI hide a feature cleanly.

---

## 10. Forms and input

**A bare wall of inputs is why nobody edits anything.** Correctly bound fields are Level 0.

- **Group fields**, and let group order follow the underlying field order, so a group lands where
  its first field falls — not in an alphabetized guess.
- **Each field carries a meaning and an example.** The meaning says what it is for; the example
  shows a plausible value.
- **Keep that prose apart from the schema.** The schema stays the only source of truth for
  *shape* — type, required, references. The prose layer adds only meaning.
- **A field with no prose still renders**, in an "Other" group. A new field must never be a crash
  or a blank.
- **Generate the form from the shape** where the shape is rich enough. A new field type should
  need no new form code.
- **Step a long creation flow;** never present a wall.
- **Validate and normalize at the boundary, and name the field that failed.** A stray space that
  throws later is a validation nobody wrote.
- **Every control has a real label bound to the real control.** Nothing relies on nesting or on
  placeholder text.
- **A required marker is an annotation, not an action** — danger tone, never the accent.

---

## 11. Show, do not explain

- **Delete the app's name and its blurb from its own landing screen.**
- **Surface real material**, sized unequally by what needs attention. Not a row of labelled
  numbers, not a grid of equal cards.
- **Replace a label with a glyph and a tooltip wherever the label is not the point.** Labels are a
  last resort — but the accessible name always survives the label.
- **Prose describing the material loses to the material.** In an app about images this is obvious;
  it is just as true everywhere else.

---

## 12. Presentation follows data

**No screen decides what colour a state is.** Each enumerated state carries its own tone and label
in the domain layer, and one shared badge reads them.

- One place, and one only, turns a tone into a look — a filled chip, an ink-only variant, a solid
  fill for a bar or a dot.
- Adding a state in the domain layer makes it render correctly everywhere with no UI change.
- A state meaning "not yet decided" renders **nothing**, not a chip saying unknown. Absence of a
  judgement is not a status.

Same rule as `architectural-sensibility.md` §6 — enums are domain primitives, and their display
metadata rides with them.

---

## 13. The accessibility floor

Not a phase. Build-time rules, and WCAG 2.2 AA is the floor.

- **A visible focus indicator on everything focusable.** Set once, from the accent, with an
  offset. Never removed without a replacement.
- **Focus is never obscured** by fixed chrome, a drawer or a floating bar (2.4.11).
- **Targets are at least 24×24, or spaced** so a near miss cannot hit the wrong one (2.5.8).
- **Anything draggable has a single-pointer alternative** — move controls, arrow keys, a menu
  (2.5.7). Drag alone fails, and it is also the path hardest to test, so the alternative is the
  one you can actually verify.
- **Never re-ask for information already given** in the same flow (3.3.7).
- **Help sits in the same place on every screen** that offers it (3.2.6).
- **Reduced motion is honoured** (§8).
- **Use the platform's own primitive** for dialogs, menus and pickers wherever one exists. It
  supplies the focus handling and the dismissal behaviour a hand-rolled version always gets wrong.
  Reach for a library only when the platform has no answer.

---

## 14. Rules that are engineering and design at once

Enforced in design review, because each is a screen that does not survive real data.

- **No live canvas, video or map in a grid.** Stills in the grid; exactly one live instance, for
  the selected item. A hundred hardware contexts fight over one device.
- **Media loads from an address the component is handed**, never a location it builds and never a
  path on disk. That is what lets the transport change with no component edit.
- **Virtualize past a few hundred rows**, and design that list's empty and loading states at the
  same time.
- **Design every screen against the largest plausible dataset**, never the seed data. Failure 4 —
  the queue that dumps everything at once — was a screen only ever seen with twelve rows.

---

## 15. What to test

Test the structural half properly and the visual half stays a person's job.

**Always tested:**

- **The token contract** — every theme declares the same set (§4.2).
- **The frame seam** — a section's panel reaches the slot, and teardown clears it. This one piece
  holds the whole frame contract together.
- **Collapse behaviour** — a closed drawer is inert, a glyph-only control keeps its name, a manual
  override releases at the threshold.
- **Place-keeping** — a cursor keys on identity and survives a refetch returning a new collection
  of the same items; a shrinking list clamps rather than resets.
- **Every terminal state**: empty, finished, failed.
- **The reduced-motion branch** of every animated primitive.

**Not worth automating:** exact spacing, exact colour, anything an image diff would own.

**Cover screens evenly.** Tests per screen is a real signal — the area with a third of its
sibling's coverage is the area nobody trusted enough to change.

**Say what is unverified.** A path the test runner cannot drive — native drag, real hardware, a
device sensor — is *unverified*, in those words. "Built" and "working" are different claims.

---

## 16. Naming

Sigils vary by platform; the patterns do not.

| Concept | Pattern | Example |
| --- | --- | --- |
| Shared primitive | The noun alone | `Panel`, `Rail`, `Stage`, `Field` |
| Frame seam | `{Thing}Layout` / `{Thing}Slot` | `PaneLayout`, `PanelSlot` |
| Screen | The noun of what it shows | `ReviewQueue`, `FiringComposer` |
| Flow step | `{Subject}{Step}` | `PieceRun`, `DraftStudy` |
| Place-keeping state | `{Noun}Cursor` | `RunCursor`, `GridCursor` |
| Tone map | `TONE_{USE}` | `TONE_CHIP`, `TONE_INK`, `TONE_FILL` |
| Motion constant | Plural noun, frozen | `DURATION`, `EASE` |
| Field prose | `{thing}Guidance` | `fieldGuidance` |

Two naming rules that outrank the table:

- **The visible name and the internal key may differ, and a rename is prose only.** Renaming an
  internal key breaks every saved link and every declared handoff for no gain to anyone.
- **The internal gloss never reaches the screen.** If the team says "the review room" and the UI
  says "Agora", then "the review room" lives in docs and comments and nowhere else.

---

## 17. Anti-patterns

**Flow**

- ❌ A landing screen that is a menu of where you could go.
- ❌ Returning to a list to pick the next item.
- ❌ A group finishing with no named next group.
- ❌ A terminal state that stops at "nothing here".
- ❌ Two areas wired to each other directly instead of through the declared seam.
- ❌ Five choices at one level when three of them follow from the first.
- ❌ Scroll jumping to the top on return.
- ❌ A cursor keyed on position, or reset by a filter change.
- ❌ A draft that vanishes on leaving.
- ❌ An undo that operates on "whatever is on screen now".
- ❌ A long job that cannot survive a reload.
- ❌ A screen you must scroll to act on.
- ❌ A fast path that is the only path.

**Craft**

- ❌ A raw value outside the token definition.
- ❌ A theme declaring a subset of the token set.
- ❌ A screen deciding what colour a state is.
- ❌ A heading that is body text at a larger size.
- ❌ Depth by shadow *and* by surface stack, in one app.
- ❌ The accent spent on anything that is not the action.
- ❌ A structural colour used as a fill.
- ❌ Navigating rebuilding the frame.
- ❌ A spinner where a placeholder belongs; a placeholder that resizes when content lands.
- ❌ A region rebuilding because its sibling is reloading.
- ❌ Five buttons at one level.
- ❌ A drawer off-screen but still in the traversal order.
- ❌ A focus indicator removed with no replacement.
- ❌ Drag as the only way to reorder.
- ❌ A form that is one flat wall of unlabelled inputs.
- ❌ Field prose written into the schema.
- ❌ A live canvas per grid cell.
- ❌ The app explaining itself on its own landing screen.
- ❌ A primitive built inside one screen when a second screen already wants it.

---

## 18. New-screen checklist

1. **Where did the person come from, and where do they go when this is done?** If either answer is
   "back to a list", rethink it.
2. **Name the one action.** Two answers means two screens.
3. **Name the object they think in.** That is the unit of the layout.
4. **Design the empty state first.** Hardest, and most seen.
5. **Decide the depth of each step** — screen, overlay, or reveal (§2.10).
6. **Everything the decision needs is on this screen**, without scrolling.
7. Compose from **shared primitives**. A missing one gets built in the shared place now, not here
   "for now".
8. **Titled regions use the heading primitive.**
9. **Actions get tiers.** Exactly one primary.
10. **Later choices are sequenced**, not laid beside the first.
11. **Waiting is a placeholder in place**, sized to the content.
12. **Place-keeping named**: what is remembered on leaving, what is restored on return.
13. **Reversal named**: what undo means here, and where its one door is.
14. **Traverse it without a pointer**, including every collapsed state.
15. **Reduced motion checked.**
16. **Viewed at the narrow size** and against the largest plausible dataset.
17. **Both themes checked** against real content, not grey boxes.

---

## 19. The "same team" test

The app reads as one product when:

- Finishing something puts you on the next thing, everywhere.
- Every screen has one obvious action, and it is the only thing wearing the accent.
- No flow ends without naming what happens next.
- Returning to a screen lands where you left it.
- Every jump between areas appears in one readable list.
- Every colour resolves to a named job.
- Every titled region is the same primitive.
- The frame never rebuilds.
- Nothing rebuilds to show that it is loading.
- Every field says what it means and shows an example.
- No screen decides what colour a state is.
- Every glyph-only control has a name, and every closed drawer is inert.

If a screen breaks more than one of these, rebuild it.

---

## 20. Going further

Not required by the bar. The next increment, in rough order of payoff.

- **A command surface** built from the same registry as the handlers and the help overlay, showing
  each command's accelerator beside it — teaching the accelerator, then making itself unnecessary.
- **Platform-native screen transitions** instead of an animation library for the common case.
  Fewer dependencies, and the platform owns the interruption semantics.
- **Size queries against the container, not the viewport.** A card in a narrow column and a card
  in a wide one are the same component asking a different question.
- **A portable token format** once tokens must cross a tool boundary — a design tool, a second
  platform, a native shell.
- **A perceptual colour space** for token generation, so a tone ramp keeps even lightness steps
  across hues instead of the hand-correction every hex palette needs.
- **Streaming and progressive reveal** for anything model-generated: output as it arrives, a
  placeholder shaped like the answer, a visible marker for what is a guess. A slow generation is a
  batch surface with its own review screen, never a spinner in a form.
- **Measured latency budgets.** Instrument the input-to-paint time of the five most-repeated
  actions, hold them under 100ms, treat a regression as a bug.

---

## 21. Appendix — one mapping, for a web stack

The body names no framework. For anyone who wants the shortcut, this is how a few of the rules
landed once, in React with a utility CSS framework. Nothing here is normative.

| Rule | One way to do it |
| --- | --- |
| §4.1 tokens | CSS custom properties, semantic names only |
| §4.2 runtime resolution | Utilities mapped to `var(--x)`, not to values at build time |
| §4.2 explicit override | A `data-theme` attribute on the root, given precedence over the media query |
| §7 section slot | Two contexts hoisted above both sides; the section portals its panel into the frame's node |
| §7 inert drawer | The `inert` attribute, with the handle rendered outside it |
| §2.7 scroll memory | A key-to-offset map, written on unmount and read on mount |
| §8 reduced motion | A hook over `prefers-reduced-motion`, read inside the primitives |
| §13 dialogs | The native `<dialog>` element |

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
- **Waiting and disclosure** — placeholders over spinners, optimistic writes, progressive
  disclosure.
  [Placeholders vs spinners](https://www.onething.design/post/skeleton-screens-vs-loading-spinners) ·
  [Pattern survey](https://www.designstudiouiux.com/blog/web-app-ui-design-patterns/)

---

*This document is short on rationale and long on rules. Rationale belongs in the pull request;
rules belong here, where they can be applied without re-deriving them.*
