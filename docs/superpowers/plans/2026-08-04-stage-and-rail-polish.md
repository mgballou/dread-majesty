# Stage and Rail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the eleven interface fixes from the play test — the accent stops moving, the stage stops lying about the cascade, and nothing resizes when a blow lands.

**Architecture:** Every change is in `apps/web/src/ui` or `packages/content/src/v1/copy.ts` plus its type in `packages/content/src/copy.ts`. No engine file is touched, no balance number moves. The one structural change is `railPlan` returning a best *per panel* instead of one across the deck, with hysteresis so it holds still.

**Tech Stack:** React 19, TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest + Testing Library, plain CSS with the three-tier token system, `break_eternity.js`.

**Spec:** `docs/superpowers/specs/2026-08-04-stage-and-rail-polish-design.md`. Read the section named in each task.

## Global Constraints

- **No raw colour, size, duration or type values outside `apps/web/src/ui/tokens.css`.** Semantic tokens only (`--accent-soft`, `--space-2`, `--duration-fast`). Never `#c9a227`, never `8px`. Component-tier tokens (`--meter-tooth`) are defined at the top of the component's own stylesheet and derived from semantic ones.
- **`--accent` at full strength marks the one action of a region and nothing else.** A setting, a meter, a tab, a progress fill never wears it. Use `--accent-soft` / `--accent-line` / `--accent-well` for reporting weight.
- **Colour never carries a state alone.** Every state has a word, a shape, or a weight difference as well. Where a visible word is removed, the state moves into the control's accessible name — it is never simply dropped.
- **Reduced motion is designed, not stripped** (ui-sensibility §8). Anything visible under full motion stays visible under `prefers-reduced-motion: reduce`, quantised or static rather than absent. Components read it through `useReducedMotion()` and set `data-motion="reduced" | "full"`.
- **No `any`, no default exports, no `as` casts** except where a type guard cannot express it, with a comment saying why. Discriminated unions over string flags.
- **Every resource and generator count is a `Decimal`.** Never a JS number. The one licensed exception is converting for a *display* decision that never re-enters the simulation, and it carries a comment saying so (see `moteCount`).
- **Object parameters once a function takes three or more arguments.** Two or fewer stay positional.
- **No comments in tests** unless the test is genuinely unusual. One assertion per `expect`.
- **Engine imports are types and selectors only.** `apps/web` may import from `@dm/engine` and `@dm/content`; nothing may reach into another package's internals past its `src/index.ts`.
- **Run `pnpm check` before every commit** (typecheck + lint + test). Commit messages: imperative, one line, no trailers, **no AI attribution of any kind**.
- Prose in comments and copy follows Orwell's rules: short words, cut what can be cut, active voice.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `apps/web/src/ui/segments.ts` | `CYCLE_SEGMENTS`, the one number the meter and the ring both read. |
| `apps/web/src/ui/segments.test.ts` | Pins it, and pins the quantiser both callers share. |
| `apps/web/src/ui/rail/QuantityChip.tsx` | The cycling buy-quantity control. Replaces `QuantityToggle.tsx`. |
| `apps/web/src/ui/rail/QuantityChip.css` | Its four-rung gold ramp. |
| `apps/web/src/ui/rail/QuantityChip.test.tsx` | Cycle order, wrap, keyboard, accessible name. |
| `apps/web/src/ui/rail/useRailPlan.ts` | Holds the previously-lifted keys and feeds them back to `railPlan`. |
| `apps/web/src/ui/rail/useRailPlan.test.ts` | Stickiness across recomputes. |
| `apps/web/src/ui/DeckGlyph.tsx` | The four tab marks, as inline SVG. |
| `apps/web/src/ui/DeckGlyph.test.tsx` | Every tab id resolves to a drawing. |
| `apps/web/src/ui/rail/perPanelAccent.test.tsx` | Replaces `oneAccent.test.tsx`. |

**Deleted:** `apps/web/src/ui/rail/QuantityToggle.tsx`, `apps/web/src/ui/rail/oneAccent.test.tsx`.

**Modified:** `Meter.tsx/.css`, `CycleRing.tsx/.css`, `TierNode.tsx/.css`, `ChainStage.tsx`, `ChainLink.tsx/.css`, `EvilNode.tsx/.css`, `Deck.tsx/.css`, `BuyRail.tsx/.css`, `TierRow.tsx`, `Miscreants.tsx`, `railPlan.ts`, `quantity.ts`, `App.tsx`, `tokens.test.ts`, `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`, and the test file mirroring each.

---

## Task 1: The cycle reads in fifths

Spec §3.4. Both progress indicators are continuous sweeps textured with eight teeth, and neither gives a glanceable fraction. Five segments does.

**Files:**
- Create: `apps/web/src/ui/segments.ts`, `apps/web/src/ui/segments.test.ts`
- Modify: `apps/web/src/ui/Meter.tsx`, `apps/web/src/ui/Meter.css`, `apps/web/src/ui/stage/CycleRing.tsx`, `apps/web/src/ui/stage/CycleRing.css`
- Test: `apps/web/src/ui/Meter.test.tsx`, `apps/web/src/ui/stage/CycleRing.test.tsx`

**Interfaces:**
- Produces: `CYCLE_SEGMENTS: 5`, `quantise(fraction: number): number` from `apps/web/src/ui/segments.ts`. Tasks 2 and 10 do not use these; nothing else consumes them.

- [ ] **Step 1: Write the failing test for the shared constant**

Create `apps/web/src/ui/segments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CYCLE_SEGMENTS, quantise } from './segments.ts';

describe('the cycle reads in fifths', () => {
  it('is five segments', () => {
    expect(CYCLE_SEGMENTS).toBe(5);
  });

  it('drops a part-filled segment rather than rounding it up', () => {
    expect(quantise(0.39)).toBeCloseTo(0.2);
  });

  it('holds an exact boundary', () => {
    expect(quantise(0.6)).toBeCloseTo(0.6);
  });

  it('reports nothing below the first segment', () => {
    expect(quantise(0.19)).toBe(0);
  });

  it('reports full at one', () => {
    expect(quantise(1)).toBe(1);
  });

  it('treats a value that is not a number as empty', () => {
    expect(quantise(Number.NaN)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test segments`
Expected: FAIL, "Failed to resolve import './segments.ts'".

- [ ] **Step 3: Write the module**

Create `apps/web/src/ui/segments.ts`:

```ts
/**
 * How many segments a cycle is read in, on the ring and on the bar alike.
 *
 * Five, because the job is to be read at a glance rather than measured: "three of
 * five" is read, a sweep two-thirds along is estimated. It doubles as the number of
 * steps the fill holds under reduced motion, which is what it was already doing
 * separately in two files at eight.
 */
export const CYCLE_SEGMENTS = 5;

/**
 * A fraction, rounded down to whole segments.
 *
 * Down, never nearest: a segment lights when it is filled, so a lit segment always
 * means at least that much has run. Rounding to nearest would light the last one
 * early, which on a ninety-minute Throne cycle is a lie worth minutes.
 */
export function quantise(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.floor(clamped * CYCLE_SEGMENTS) / CYCLE_SEGMENTS;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @dm/web test segments`
Expected: PASS, 6 tests.

- [ ] **Step 5: Point the meter at it**

In `Meter.tsx`: delete the local `REDUCED_STEPS` constant and its docblock, import `{ quantise }` from `./segments.ts`, and replace the `shown` line:

```ts
const swept = max > 0 ? clamp(value / max) : 0;
const shown = reduced ? quantise(swept) : swept;
```

Update the component docblock's reduced-motion paragraph to say **five** steps, not eight.

- [ ] **Step 6: Segment the meter's track**

In `Meter.css`, replace the `--meter-tooth` token and the whole `.meter__teeth` rule. The teeth were a texture; these are divisions. Keep `--meter-point` and the `clip-path` block exactly as they are.

```css
.meter {
  --meter-gap: 2px;
  --meter-point: var(--space-2);
  --meter-swept: 0%;

  position: relative;
  display: block;
  inline-size: 100%;
  block-size: var(--space-2);
  background: var(--accent-well);
  box-shadow: inset 0 0 0 1px var(--accent-line);
}
```

```css
/*
 * The divisions. Five cells cut by four gaps in the ground colour, drawn over the
 * fill, so a part-run bar reads as a count of lit cells rather than as a distance
 * along a line. The gap is a raw 2px on purpose: it is a hairline, the one measure
 * the space scale has no rung for, and it is declared once here as a component token.
 */
.meter__teeth {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to right,
    transparent 0 calc(20% - var(--meter-gap)),
    var(--ground) calc(20% - var(--meter-gap)) 20%
  );
}
```

- [ ] **Step 7: Cut the ring into arcs**

In `CycleRing.tsx`: delete the local `REDUCED_STEPS`, import `{ CYCLE_SEGMENTS, quantise }` from `../segments.ts`, and add the gap geometry beside the existing constants:

```ts
/** The gap between arcs, in viewBox units. Wide enough to read, narrow enough to ignore. */
const SEGMENT_GAP = 3;
const SEGMENT_ARC = CIRCUMFERENCE / CYCLE_SEGMENTS;
```

Replace the `fraction` line and both `<circle>` elements. Three circles, in this order: the track, then the sweep as **one plain arc** from twelve o'clock, then the divisions painted over both in the ground colour. The gaps are cut once, by the divisions, so the track and the sweep can never disagree about where a division falls.

```tsx
const swept = cycleMs > 0 ? clamp(progressMs / cycleMs) : 0;
const fraction = reduced ? quantise(swept) : swept;
const percent = Math.round(fraction * 100);
```

```tsx
<svg className="stage-ring__art" viewBox="0 0 48 48" aria-hidden="true">
  <circle className="stage-ring__track" cx={CENTRE} cy={CENTRE} r={RADIUS} />
  <circle
    className="stage-ring__sweep"
    cx={CENTRE}
    cy={CENTRE}
    r={RADIUS}
    strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
  />
  <circle
    className="stage-ring__divisions"
    cx={CENTRE}
    cy={CENTRE}
    r={RADIUS}
    strokeDasharray={`${SEGMENT_GAP} ${SEGMENT_ARC - SEGMENT_GAP}`}
  />
</svg>
```

Gap first in the divisions' dash pattern, so the stroke paints only the gaps. Delete `strokeDashoffset` and its `CIRCUMFERENCE * (1 - fraction)` expression.

- [ ] **Step 8: Style the three rings**

`CycleRing.css`:

```css
.stage-ring__track {
  fill: none;
  stroke: var(--line);
  stroke-width: 2;
}

.stage-ring__sweep {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

/*
 * The gaps, drawn over the sweep in the ground colour rather than cut out of it.
 * One geometry cutting both rings, so the divisions land in the same five places
 * whatever the sweep is doing. Wider than the strokes it covers, or it leaves a hair
 * of colour at the edge of each gap.
 */
.stage-ring__divisions {
  fill: none;
  stroke: var(--ground);
  stroke-width: 4;
}
```

`stroke-linecap: round` comes off the sweep: a round cap on a segmented ring bleeds into the neighbouring gap.

- [ ] **Step 9: Test both indicators**

Add to `apps/web/src/ui/Meter.test.tsx`:

```tsx
it('reports the exact fraction under full motion', () => {
  render(<Meter label="Minion cycle" value={37} max={100} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
});

it('drops to whole segments under reduced motion', () => {
  reduceMotion();
  const { container } = render(<Meter label="Minion cycle" value={37} max={100} />);
  expect(container.querySelector('.meter')).toHaveStyle({ '--meter-swept': '20%' });
});
```

Use whatever helper `Meter.test.tsx` already has for forcing reduced motion — read the file first and match it rather than inventing a second one.

Add to `apps/web/src/ui/stage/CycleRing.test.tsx`:

```tsx
it('sweeps a fifth of the circumference at a fifth of the cycle', () => {
  const { container } = render(
    <CycleRing progressMs={800} cycleMs={4000} label="Minions" copy={CURRENT_COPY.stage} />,
  );
  const sweep = container.querySelector('.stage-ring__sweep');
  const [lit] = (sweep?.getAttribute('stroke-dasharray') ?? '').split(' ');
  expect(Number(lit)).toBeCloseTo((2 * Math.PI * 21) / 5, 3);
});

it('cuts the ring into five', () => {
  const { container } = render(
    <CycleRing progressMs={0} cycleMs={4000} label="Minions" copy={CURRENT_COPY.stage} />,
  );
  const divisions = container.querySelector('.stage-ring__divisions');
  const [, run] = (divisions?.getAttribute('stroke-dasharray') ?? '').split(' ');
  expect(Number(run)).toBeCloseTo((2 * Math.PI * 21) / 5 - 3, 3);
});
```

- [ ] **Step 10: Run everything and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Read the cycle in fifths on the ring and the bar"
```

---

## Task 2: Rings mark their own completion

Spec §3.3. `TierNode` marks an arrival — the producer above it firing — and nothing marks the node's own cycle closing. The one event the stage exists to draw is the one it does not draw.

**Files:**
- Modify: `apps/web/src/ui/stage/TierNode.tsx`, `apps/web/src/ui/stage/TierNode.css`, `apps/web/src/ui/stage/ChainStage.tsx`
- Test: `apps/web/src/ui/stage/TierNode.test.tsx`

**Interfaces:**
- Consumes: `usePulse(produced: Decimal | null, version: number): Pulse | null` from `./usePulse.ts`, unchanged.
- Produces: `TierNodeProps` gains `produced: Decimal` — the node's **own** `lifetimeProduced`, distinct from `feed`, which is the producer above it.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/ui/stage/TierNode.test.tsx`, match the file's existing render helper rather than writing a new one. Add:

```tsx
it('marks its own completion when its lifetime output grows', () => {
  const { container, rerender } = renderNode({ produced: new Decimal(10) });
  rerender(node({ produced: new Decimal(14), version: 2 }));
  expect(container.querySelector('.stage-node__fired')).not.toBeNull();
});

it('marks nothing while its output stands still', () => {
  const { container, rerender } = renderNode({ produced: new Decimal(10) });
  rerender(node({ produced: new Decimal(10), version: 2 }));
  expect(container.querySelector('.stage-node__fired')).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test TierNode`
Expected: FAIL — `produced` is not a prop, and `.stage-node__fired` is never rendered.

- [ ] **Step 3: Add the prop and the second pulse**

In `TierNode.tsx`, add to `TierNodeProps`:

```ts
  /**
   * This rung's own `lifetimeProduced`. Growth in it is this tier's cycle closing.
   *
   * Distinct from `feed`, which is the rung above delivering into this one. A node
   * shows both, and they are different events: one is this tier working, the other is
   * this tier being fed.
   */
  produced: Decimal;
```

Destructure `produced`, and beside the existing `landing`:

```ts
const landing = usePulse(feed === null ? null : feed.produced, feed?.version ?? 0);
const fired = usePulse(isUnlocked ? produced : null, feed?.version ?? 0);
```

Render it inside `.stage-node__medallion`, immediately after the `landing` element:

```tsx
{fired !== null && (
  <span className="stage-node__fired" key={`fire-${fired.id}`} aria-hidden="true" />
)}
```

Both marks are decorative: the ring beside them already carries the progress as a `progressbar` with a spoken value, and the count is on the node. A completion is a change in numbers already announced.

- [ ] **Step 4: Draw the flash**

In `TierNode.css`, beside the existing `.stage-node__landing` rules:

```css
/*
 * This rung's own cycle closing.
 *
 * A ring flaring in the tier's tone, on the ring's own line rather than over the art,
 * so it reads as the cycle completing and not as something arriving. The arrival mark
 * sits inside the medallion; this sits on its edge.
 */
.stage-node__fired {
  position: absolute;
  inset: 0;
  border: 2px solid currentColor;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
}

.stage-node[data-motion='full'] .stage-node__fired {
  animation: stage-node-fired var(--duration-base) ease-out both;
}

/*
 * Under reduced motion the flash holds still and fades rather than swelling. The
 * completion is never missing, only stationary (ui-sensibility §8).
 */
.stage-node[data-motion='reduced'] .stage-node__fired {
  animation: stage-node-fired-still var(--duration-base) linear both;
}

@keyframes stage-node-fired {
  from {
    opacity: var(--stage-node-flash, 0.9);
    scale: 1;
  }

  to {
    opacity: 0;
    scale: 1.18;
  }
}

@keyframes stage-node-fired-still {
  from {
    opacity: var(--stage-node-flash, 0.9);
  }

  to {
    opacity: 0;
  }
}

/*
 * Under a blow, harder. Every tier is producing several times what it usually does and
 * the stage should say so rather than flashing at the same weight it always does.
 */
.stage[data-surge='lit'] .stage-node__fired {
  --stage-node-flash: 1;

  border-width: 3px;
}
```

- [ ] **Step 5: Pass the prop from the chain**

In `ChainStage.tsx`, on the `<TierNode>` element, add beside `feed`:

```tsx
produced={state.gens[tier.id].lifetimeProduced}
```

- [ ] **Step 6: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Flash a rung's ring when its own cycle closes"
```

---

## Task 3: The runs carry what is delivered

Spec §3.1 and §3.2. Each link is handed the **producing** tier's tone, so the run into Evil pours minion-coloured motes at it. And the runs are hairlines that stop short of the discs, so the chain reads as six separate nodes.

**Files:**
- Modify: `apps/web/src/ui/stage/ChainStage.tsx`, `apps/web/src/ui/stage/ChainLink.css`
- Test: `apps/web/src/ui/stage/ChainStage.test.tsx`

**Interfaces:**
- Consumes: `ChainLinkProps.tone: ArtSlot['fallback']['tone'] | null`, unchanged. Only the value passed changes.
- `EVIL_ART` is already exported from `./EvilNode.tsx` and re-exported by `ChainStage.tsx`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/ui/stage/ChainStage.test.tsx`, match the file's existing render helper. Add:

```tsx
it('pours Evil-toned motes down the last run', () => {
  const { container } = renderStage();
  const links = container.querySelectorAll('.stage-link');
  const last = links[links.length - 1];
  expect(last).toHaveStyle({ '--node-tone': 'var(--tone-resource)' });
});

it('pours Minion-toned motes down the run that feeds Minions', () => {
  const { container } = renderStage({ unlocked: ['minion', 'warren'] });
  const warren = container.querySelector('[data-tier="warren"] .stage-link');
  expect(warren).toHaveStyle({ '--node-tone': 'var(--tone-tier-1)' });
});
```

Read `ChainStage.test.tsx` first: if its helper cannot choose which tiers are unlocked, extend the helper rather than adding a second one. `tone-tier-1` is the Minion tone — confirm against `packages/content/src/v1/art.ts` before asserting, and use whatever that manifest actually names.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test ChainStage`
Expected: FAIL — the last link carries `--tone-tier-1` (the Minion's own tone), not `--tone-resource`.

- [ ] **Step 3: Give the link the tone of what it feeds**

In `ChainStage.tsx`, inside the `rungs.map` callback, the `<ChainLink>` currently reads `tone={toneOf(tier.art)}`. Replace with:

```tsx
tone={toneOf(rungs[index + 1]?.art ?? EVIL_ART)}
```

`rungs` runs expensive-first, so `rungs[index + 1]` is the rung this one feeds and the last rung feeds Evil. `EVIL_ART` is already in scope — it is imported from `./EvilNode.tsx` at the top of the file.

Replace the docblock line on `ChainLink.tsx`'s `tone` prop:

```ts
  /**
   * Semantic tone the motes carry: the tone of the thing **being delivered**, from the
   * art manifest.
   *
   * The run's colour is its cargo, not its sender. A Warren firing sends Minions, so
   * that run is Minion-toned; the last run sends Evil and is ember, whatever colour the
   * Minions above it are. Null leaves them inherited.
   */
```

- [ ] **Step 4: Thicken the runs and close the gaps**

In `ChainLink.css`, the `.stage-link::before` rule sets `block-size: 1px`. Change to `block-size: 2px`, and check the rule's `inline-size` / `inset-inline` declarations: the run must span the full `--stage-link-run` with no inset at either end, so it meets the disc on both sides. Read the existing rule before editing and change only what is needed to reach both ends — if it already spans fully, thickness is the only change.

Raise `.stage-link__surge`'s `block-size` from `2px` to `3px` in step with it, so the lit run still reads as heavier than the resting one.

- [ ] **Step 5: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Colour each run by what it delivers and let it reach both discs"
```

---

## Task 4: The production line shows what it makes

Spec §3.5. `2.5 Minions every 4s, each` sits under a row titled **Minions**, in a panel listing Minions. The noun is the least informative thing on the line.

**Files:**
- Modify: `apps/web/src/ui/rail/TierRow.tsx`, `apps/web/src/ui/rail/BuyRail.css`
- Test: `apps/web/src/ui/rail/BuyRail.test.tsx`

**Interfaces:**
- Consumes: `TierArt` from `../art/TierArt.tsx` — `{ slot: string; size?: number; decorative?: boolean }`. `EVIL_ART = 'resource/evil'` from `../stage/EvilNode.tsx`.
- `produceLine` changes from returning `string` to returning `ReactNode`. Rename it `ProduceLine` and make it a component — a function returning JSX that is not a component cannot use the naming convention or be tested in isolation.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/ui/rail/BuyRail.test.tsx`:

```tsx
it('draws what the tier makes rather than naming it twice', () => {
  const { container } = renderRail();
  const row = container.querySelector('[data-tier="minion"] .rail__line');
  expect(row?.querySelector('.art')).not.toBeNull();
});

it('keeps the noun for anyone reading by ear', () => {
  const { container } = renderRail();
  const row = container.querySelector('[data-tier="minion"] .rail__line');
  expect(row).toHaveTextContent(/Evil/);
});
```

Match the file's existing render helper.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test BuyRail`
Expected: FAIL — `.rail__line` holds text only, no `.art` element.

- [ ] **Step 3: Replace the function with a component**

In `TierRow.tsx`, delete `produceLine` and add:

```tsx
/** Matches `--rail-mark` in BuyRail.css. Big enough to tell apart, small enough to sit in a line. */
const LINE_MARK_SIZE = 16;

interface ProduceLineProps {
  state: GameState;
  tier: TierDef;
  content: Content;
}

/**
 * What one unit of this tier makes, and how often.
 *
 * The mark rather than the noun: the row is already titled with this tier's name and
 * sits in a list of them, so the noun was the one word on the line carrying nothing.
 * What the row *makes* is the fact worth having, and at this size a silhouette says it
 * faster than a word does.
 *
 * The noun stays, spoken. Nothing here is available only by looking.
 */
function ProduceLine({ state, tier, content }: ProduceLineProps): ReactNode {
  const amount = effectiveYield(state, tier);
  const made = content.tiers.find((candidate) => candidate.id === tier.produces);
  const noun = made ? (amount.eq(1) ? made.name : made.plural) : 'Evil';

  return (
    <>
      {formatCount(amount)}{' '}
      <TierArt slot={made ? made.art : EVIL_ART} size={LINE_MARK_SIZE} decorative />
      <span className="rail__made">{noun}</span> every {formatDuration(effectiveCycleMs(state, tier))}
      , each
    </>
  );
}
```

Import `EVIL_ART` from `'../stage/EvilNode.tsx'` and `type ReactNode` if not already imported.

Replace the call site:

```tsx
<p className="rail__line">
  <ProduceLine state={state} tier={tier} content={content} />
</p>
```

- [ ] **Step 4: Hide the noun visually, keep it spoken**

In `BuyRail.css`, add beside the other rail rules:

```css
/* The mark sits on the text baseline rather than above it — a line of prose with a
   drawing hanging off the top of it reads as a broken image. */
.rail__line .art {
  display: inline-block;
  vertical-align: -0.15em;
  margin-inline-end: var(--space-1);
}

/* Said, never shown. The mark beside it carries the same fact by looking. */
.rail__made {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 5: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Draw what a tier makes instead of naming it twice"
```

---

## Task 5: The tab marks stop depending on the font

Spec §3.6. `⚒ ◈ ✧ ※` as text. iOS gives `⚒` emoji presentation — colour, wrong size, wrong weight — while every desktop renders it monochrome. One of the four tabs is a different species on a phone.

**Files:**
- Create: `apps/web/src/ui/DeckGlyph.tsx`, `apps/web/src/ui/DeckGlyph.test.tsx`
- Modify: `apps/web/src/ui/Deck.tsx`, `apps/web/src/ui/Deck.css`, `apps/web/src/App.tsx`
- Test: `apps/web/src/ui/Deck.test.tsx`

**Interfaces:**
- Produces: `DeckGlyphKind = 'muster' | 'miscreants' | 'deeds' | 'ledger'` and `DeckGlyph({ kind }: { kind: DeckGlyphKind }): ReactNode`, both from `apps/web/src/ui/DeckGlyph.tsx`.
- `DeckTab.glyph` changes type from `string | undefined` to `DeckGlyphKind | undefined`. Task 6 modifies the same two files — do Task 5 first.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/ui/DeckGlyph.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeckGlyph, type DeckGlyphKind } from './DeckGlyph.tsx';

const kinds: DeckGlyphKind[] = ['muster', 'miscreants', 'deeds', 'ledger'];

describe('every tab has a drawing of its own', () => {
  it.each(kinds)('draws %s', (kind) => {
    const { container } = render(<DeckGlyph kind={kind} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each(kinds)('hides %s from assistive tech', (kind) => {
    const { container } = render(<DeckGlyph kind={kind} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives each tab a different drawing', () => {
    const drawn = kinds.map((kind) => render(<DeckGlyph kind={kind} />).container.innerHTML);
    expect(new Set(drawn).size).toBe(kinds.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test DeckGlyph`
Expected: FAIL, "Failed to resolve import './DeckGlyph.tsx'".

- [ ] **Step 3: Write the component**

Create `apps/web/src/ui/DeckGlyph.tsx`:

```tsx
import type { ReactNode } from 'react';

/** One mark per panel of the deck. */
export type DeckGlyphKind = 'muster' | 'miscreants' | 'deeds' | 'ledger';

interface DeckGlyphProps {
  kind: DeckGlyphKind;
}

/**
 * The mark on a tab, drawn rather than typed.
 *
 * These were Unicode characters and the platform decided what they looked like: iOS
 * gives U+2692 emoji presentation, in colour, at its own weight, while every desktop
 * draws it as a monochrome glyph. One tab was a different species on a phone.
 *
 * Drawn in `currentColor` on the same `0 0 48 48` box every other mark in the game
 * uses, so a tab mark, a tier silhouette and the miscreants' diamond are one mechanism
 * and answer to the tab's own colour. Decorative throughout — every tab is already
 * named to assistive tech by `.deck__name`.
 */
export function DeckGlyph({ kind }: DeckGlyphProps): ReactNode {
  return (
    <svg
      className="deck__mark"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {shape(kind)}
    </svg>
  );
}

/**
 * Four marks, each readable by outline alone at 20px.
 *
 * The muster is a hammer, the thing that raises. The miscreants are a diamond, the
 * shape that already means "a post, not a generator" in that panel. The deeds are a
 * star. The ledger is a page with rules on it.
 */
function shape(kind: DeckGlyphKind): ReactNode {
  switch (kind) {
    case 'muster':
      return (
        <g fill="currentColor">
          <rect x="21" y="18" width="6" height="27" rx="1" />
          <path d="M9 9 L39 9 L39 19 L33 19 L33 14 L15 14 L15 19 L9 19 Z" />
        </g>
      );
    case 'miscreants':
      return <path d="M24 3 L45 24 L24 45 L3 24 Z" fill="currentColor" />;
    case 'deeds':
      return (
        <path
          d="M24 2 L29.5 17.5 L45 18.5 L33 28.5 L37 44 L24 35 L11 44 L15 28.5 L3 18.5 L18.5 17.5 Z"
          fill="currentColor"
        />
      );
    case 'ledger':
      return (
        <g fill="currentColor">
          <path d="M9 4 L33 4 L39 11 L39 44 L9 44 Z" opacity="0.85" />
          <rect x="15" y="17" width="18" height="3" className="art__void" />
          <rect x="15" y="25" width="18" height="3" className="art__void" />
          <rect x="15" y="33" width="11" height="3" className="art__void" />
        </g>
      );
  }
}
```

`.art__void` is the existing class for a hole punched in a silhouette — confirm its rule in `TierArt.css` applies outside `.art` before relying on it. If it does not, add `fill="var(--surface-raised)"` to those rects and say why in a comment.

- [ ] **Step 4: Take the glyph in the deck**

In `Deck.tsx`, import `DeckGlyph, type DeckGlyphKind` and change `DeckTab`:

```ts
  /** Decorative mark set at the leading edge. Hidden from assistive tech. */
  glyph?: DeckGlyphKind;
```

Replace the render:

```tsx
{tab.glyph !== undefined && (
  <span className="deck__glyph" aria-hidden="true">
    <DeckGlyph kind={tab.glyph} />
  </span>
)}
```

- [ ] **Step 5: Size it in CSS**

In `Deck.css`, replace the `.deck__glyph` rule's `font-size` with a box, keeping every colour rule around it untouched:

```css
.deck__glyph {
  display: flex;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  color: var(--ink-dim);
  transition: color var(--duration-fast) ease-out;
}

.deck__mark {
  inline-size: 100%;
  block-size: 100%;
}
```

- [ ] **Step 6: Pass the kinds from App**

In `App.tsx`, replace each `glyph:` value: `'⚒'` → `'muster'`, `'◈'` → `'miscreants'`, `'✧'` → `'deeds'`, `'※'` → `'ledger'`.

- [ ] **Step 7: Run and commit**

Run: `pnpm check`
Expected: PASS. If `Deck.test.tsx` asserts on the glyph's text content, update it to assert on the drawing.

```bash
git add -A
git commit -m "Draw the tab marks instead of typing them"
```

---

## Task 6: The open tab joins its panel

Spec §3.7. `.deck__strip` draws a gold line under **all four** segments, including the open one, severing it from the panel it opens — which is the whole mechanism the idiom runs on.

**Files:**
- Modify: `apps/web/src/ui/Deck.css`
- Test: `apps/web/src/ui/Deck.test.tsx`

**Interfaces:** none. This task is CSS and one test.

- [ ] **Step 1: Move the line off the strip**

In `Deck.css`, delete `border-block-end: 1px solid var(--accent-line);` from `.deck__strip`.

- [ ] **Step 2: Put it on each segment, and mark the open one**

Add to the existing `.deck__edge` rule, after the `filter` declaration:

```css
  /* The line that divides the strip from the panel, carried per segment so the open
     one can drop it. Inset rather than a border: the box is a rectangle and the shape
     is a chevron, so a border would not follow the clip. */
  box-shadow: inset 0 -1px 0 var(--accent-line);
```

Replace the `[aria-selected='true']` ground rule:

```css
/*
 * The open segment.
 *
 * It takes the panel's own ground and **drops the line beneath it**, so the tab and the
 * panel are one surface with no seam between them — that join is what says "you are
 * here", and a line running under every tab equally was cancelling it. A gold bar along
 * the top edge marks it, at line weight: gold at full strength would say "press me"
 * rather than "you are here" (§5, §7).
 */
.deck__tab[aria-selected='true'] .deck__edge {
  background: var(--surface);
  box-shadow: inset 0 2px 0 var(--accent-soft);
}
```

- [ ] **Step 3: Write the test that would fail if the join went back**

jsdom does not compute layout, so this asserts the contract in the DOM rather than the pixels. Add to `Deck.test.tsx`:

```tsx
it('marks exactly one tab as open', () => {
  render(<Deck tabs={tabs} />);
  expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
});

it('moves the mark when another tab is chosen', async () => {
  render(<Deck tabs={tabs} />);
  await userEvent.click(screen.getAllByRole('tab')[2]!);
  expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true');
});
```

If `Deck.test.tsx` already covers both, do not duplicate them — say so in the report and move on. **Whether the distinction now reads is a visual check, not a test.** Note it in the report as one for the human.

- [ ] **Step 4: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Join the open tab to the panel it opens"
```

---

## Task 7: Smite is gold whenever it is ready, and stops resizing the column

Spec §2.2 and §3.8. Smite wore the accent only when the rail had nothing better, so the one verb the game is named for moved. And `.evil-node__report` has no width on desktop, so the node grows and shrinks with the length of whichever line the last blow drew.

**Files:**
- Modify: `apps/web/src/ui/stage/EvilNode.tsx`, `apps/web/src/ui/stage/EvilNode.css`, `apps/web/src/ui/stage/ChainStage.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/ui/stage/EvilNode.test.tsx`

**Interfaces:**
- `EvilNodeProps` **loses** `isTheAction: boolean`. `ChainStageProps` loses `smiteIsTheAction: boolean`. `App.tsx` stops passing it. Nothing else consumed either.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/ui/stage/EvilNode.test.tsx`, match the file's existing render helper. Add:

```tsx
it('is lifted whenever the blow is ready', () => {
  const { container } = renderNode({ phase: { kind: 'ready', share: 0 } });
  expect(container.querySelector('.evil-node__strike--lifted')).not.toBeNull();
});

it('is not lifted while it is cooling', () => {
  const { container } = renderNode({ phase: { kind: 'cooling', share: 0.4 } });
  expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
});

it('is not lifted while it is running', () => {
  const { container } = renderNode({ phase: { kind: 'active', share: 0.2 } });
  expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
});
```

The first of these must fail today: the helper's default has nothing on the rail, so drop `isTheAction` from the helper's defaults as part of Step 3 and confirm the test fails before that change by passing `isTheAction: false` explicitly.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @dm/web test EvilNode`
Expected: FAIL on the first case.

- [ ] **Step 3: Drop the condition**

In `EvilNode.tsx`, delete the `isTheAction` prop from the interface and the destructure, and change the class expression:

```tsx
className={ready ? 'evil-node__strike evil-node__strike--lifted' : 'evil-node__strike'}
```

Replace the paragraph in the component docblock that explains conditional lifting:

```
 * **Gold whenever the blow is ready, and never conditionally.** The stage is its own
 * region and this is its one action; the deck's open panel carries the other. Two fixed
 * places beats one moving place — the accent used to hop here whenever the rail had
 * nothing worth buying, which meant the one verb the game is named for was findable
 * only by looking for it. See the spec's §2.2.
```

- [ ] **Step 4: Unthread it upward**

In `ChainStage.tsx`: delete `smiteIsTheAction` from `ChainStageProps`, from the destructure, and from the `<EvilNode>` element. Delete the sentence about it from the `ChainStage` docblock.

In `App.tsx`: delete the `smiteIsTheAction={plan.best === null}` line from `<ChainStage>`. Do not touch anything else in `App.tsx` — Task 9 owns the rest of it.

- [ ] **Step 5: Pin the report**

In `EvilNode.css`, add to the `.evil-node__report` rule:

```css
  /* Fixed, not a floor, and at every width. The five report lines run from nineteen
     characters to thirty-four, and the node sits beside the chain — so an unpinned
     report drags the whole track sideways every time a blow lands. */
  inline-size: 11rem;
  min-block-size: calc(var(--space-4) * 2);
  text-align: center;
```

In the `@media (width <= 52rem)` block, replace `max-inline-size: 9rem;` with `inline-size: 9rem;`.

The two-line floor is deliberate: at 11rem the longest line wraps, and a floor of one line would shift by one line the first time it did.

- [ ] **Step 6: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Keep Smite gold whenever it is ready and pin its report"
```

---

## Task 8: One best per panel, and it holds still

Spec §2.2 and §2.3. `railPlan` ranks purchases and appointments on one list and lifts one winner across both, so a panel could hold no accent at all — and the score is recomputed every slice, so near-ties flip. This task changes the pure function and adds the hook that remembers. Task 9 draws it.

**Files:**
- Modify: `apps/web/src/ui/rail/railPlan.ts`
- Create: `apps/web/src/ui/rail/useRailPlan.ts`, `apps/web/src/ui/rail/useRailPlan.test.ts`
- Test: `apps/web/src/ui/rail/railPlan.test.ts`

**Interfaces:**
- Produces, all from `railPlan.ts`:
  ```ts
  export const STICKY_MARGIN = 1.25;
  export interface RailBest {
    purchase: RailPurchase | null;
    appoint: RailAppointment | null;
  }
  export interface HeldKeys {
    purchase: TierId | null;
    appoint: OverseerId | null;
  }
  export interface RailPlan {
    options: RailOption[];
    best: RailBest;
    saving: RailBest;
  }
  ```
  `RailPlanInput` gains `held: HeldKeys`. `spendEmphasis(plan, kind, key)` keeps its exact signature and return type.
- Produces from `useRailPlan.ts`: `useRailPlan(input: Omit<RailPlanInput, 'held'>, version: number): RailPlan`.
- **Breaking:** `plan.best` is no longer `RailOption | null`. Task 9 fixes every call site — `App.tsx`, `BuyRail.tsx`, `Miscreants.tsx`, and the tests.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/ui/rail/railPlan.test.ts`. Match the file's existing state builder:

```ts
describe('each panel gets its own best', () => {
  it('lifts a purchase even while an appointment outscores it', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const plan = railPlan({ ...input(), held: none });
    expect(plan.best.purchase).not.toBeNull();
  });

  it('lifts the appointment at the same time', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const plan = railPlan({ ...input(), held: none });
    expect(plan.best.appoint?.overseerId).toBe('minion-hand');
  });

  it('lifts nothing in a panel with nothing affordable', () => {
    state.resources.evil = new Decimal(0);
    const plan = railPlan({ ...input(), held: none });
    expect(plan.best.purchase).toBeNull();
  });
});

describe('the accent holds still', () => {
  it('keeps the held purchase when a challenger only just beats it', () => {
    state.resources.evil = new Decimal(2600);
    const first = railPlan({ ...input(), held: none });
    const lifted = first.best.purchase?.tierId;
    if (lifted === undefined) throw new Error('expected a purchase to lead');

    const again = railPlan({ ...input(), held: { purchase: lifted, appoint: null } });
    expect(again.best.purchase?.tierId).toBe(lifted);
  });

  it('hands over once a challenger clears the margin', () => {
    state.resources.evil = new Decimal(2600);
    const held = { purchase: 'throne' as const, appoint: null };
    const plan = railPlan({ ...input(), held });
    expect(plan.best.purchase?.tierId).not.toBe('throne');
  });

  it('drops a held option that stopped being affordable', () => {
    state.resources.evil = new Decimal(0);
    const plan = railPlan({ ...input(), held: { purchase: 'minion', appoint: null } });
    expect(plan.best.purchase).toBeNull();
  });
});
```

`none` is `{ purchase: null, appoint: null }`. The second stickiness test relies on a Throne being far and away the worst score per Evil at 2,600 Evil, so the margin is cleared comfortably — verify that by running it, and if a Throne is not affordable at all, use a tier that is and adjust.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm --filter @dm/web test railPlan`
Expected: FAIL — `held` is not a property of `RailPlanInput`, and `best` has no `.purchase`.

- [ ] **Step 3: Change the shape**

In `railPlan.ts`, replace the `RailPlan` interface and its docblock:

```ts
/**
 * How much better a challenger must be before the accent moves to it.
 *
 * The ranking is recomputed every hundred-millisecond slice, and two options whose
 * scores are close swap places constantly — which drew as the gold hopping between
 * rows several times a second. A challenger has to be a quarter better before it takes
 * the accent, and once it has, the same margin protects it. The hysteresis is
 * directional, so there is no oscillation at the boundary.
 *
 * The held option's own score falls as it is bought — its next cost rises — so it hands
 * over on its own eventually. Nothing has to expire.
 */
export const STICKY_MARGIN = 1.25;

/** The lifted spend of each panel. Neither can take the other's accent. */
export interface RailBest {
  /** The muster's, or null when nothing there is affordable. */
  purchase: RailPurchase | null;
  /** The miscreants', or null when nothing there is affordable. */
  appoint: RailAppointment | null;
}

/** What each panel lifted last time, so the ranking can prefer to keep lifting it. */
export interface HeldKeys {
  purchase: TierId | null;
  appoint: OverseerId | null;
}

export interface RailPlan {
  /**
   * Every spend on the rail, purchases and appointments together in one list.
   *
   * Still one list: the two are still ranked by the same measure and the miscreants
   * panel still reads its offers out of it. What changed is who wins — one winner per
   * panel rather than one across the deck.
   */
  options: RailOption[];
  /**
   * The spend each panel accents.
   *
   * One per panel, because the deck shows one panel at a time and a single winner
   * across both meant the panel on screen frequently had no accent at all. See the
   * spec's §2.2 — this keeps ui-sensibility §3 rather than breaking it.
   */
  best: RailBest;
  /** What each panel should save toward when nothing in it is affordable. Never accented. */
  saving: RailBest;
}
```

Add `held: HeldKeys;` to `RailPlanInput` with a one-line comment.

- [ ] **Step 4: Split the pick and make it sticky**

Replace the body of `railPlan` and the `pick` helper:

```ts
export function railPlan({ state, content, quantity, isUnlocked, held }: RailPlanInput): RailPlan {
  const options: RailOption[] = [];

  for (const tier of content.tiers) {
    if (!isUnlocked(tier.id)) continue;

    const purchase = purchaseOption({ state, content, tier, quantity });
    if (purchase) options.push(purchase);

    options.push(...appointOptions({ state, content, tier }));
  }

  const purchases = options.filter((option): option is RailPurchase => option.kind === 'purchase');
  const appointments = options.filter(
    (option): option is RailAppointment => option.kind === 'appoint',
  );

  const bestPurchase = sticky(
    purchases.filter((option) => option.affordable),
    held.purchase,
    (option) => option.tierId,
  );
  const bestAppoint = sticky(
    appointments.filter((option) => option.affordable),
    held.appoint,
    (option) => option.overseerId,
  );

  return {
    options,
    best: { purchase: bestPurchase, appoint: bestAppoint },
    saving: {
      purchase: bestPurchase ? null : pick(purchases),
      appoint: bestAppoint ? null : pick(appointments),
    },
  };
}

/**
 * The highest score, unless the one already lifted is close enough to keep.
 *
 * A held option that has gone — bought out, post filled, purse emptied — is not in
 * `options`, so it simply loses its hold and the top scorer takes over. Nothing has to
 * notice it disappeared.
 */
function sticky<T extends RailOption>(
  options: T[],
  held: string | null,
  keyOf: (option: T) => string,
): T | null {
  const top = pick(options);
  if (top === null || held === null) return top;

  const incumbent = options.find((option) => keyOf(option) === held) ?? null;
  if (incumbent === null || keyOf(top) === held) return top;

  return top.score.gt(incumbent.score.mul(STICKY_MARGIN)) ? top : incumbent;
}

/** Highest score wins. Ties go to whichever content lists first, so it is stable. */
function pick<T extends RailOption>(options: T[]): T | null {
  let winner: T | null = null;
  for (const option of options) {
    if (!winner || option.score.gt(winner.score)) winner = option;
  }
  return winner;
}
```

`pick` becomes generic so both call sites keep their narrow type without a cast.

- [ ] **Step 5: Point `spendEmphasis` at the panels**

Replace its body, keeping the signature and the docblock's first two paragraphs:

```ts
export function spendEmphasis(
  plan: RailPlan,
  kind: RailOptionKind,
  key: TierId | OverseerId,
): SpendEmphasis {
  const matches = (option: RailOption | null): boolean =>
    option !== null &&
    option.kind === kind &&
    (option.kind === 'appoint' ? option.overseerId === key : option.tierId === key);

  const best = kind === 'purchase' ? plan.best.purchase : plan.best.appoint;
  const saving = kind === 'purchase' ? plan.saving.purchase : plan.saving.appoint;

  if (matches(best)) return 'best';
  if (matches(saving)) return 'saving';
  return 'none';
}
```

Replace the docblock's third paragraph — the one claiming the plan "can only ever answer yes once" — with the per-panel rule.

- [ ] **Step 6: Run the pure tests**

Run: `pnpm --filter @dm/web test railPlan`
Expected: PASS. Other files still fail to typecheck; Task 9 fixes them.

- [ ] **Step 7: Write the hook's failing test**

Create `apps/web/src/ui/rail/useRailPlan.test.ts`:

```ts
import Decimal from 'break_eternity.js';
import { renderHook } from '@testing-library/react';
import { CURRENT } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRailPlan } from './useRailPlan.ts';

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
  state.resources.evil = new Decimal(2600);
});

const input = (): Parameters<typeof useRailPlan>[0] => ({
  state,
  content: CURRENT,
  quantity: 1,
  isUnlocked: () => true,
});

describe('the plan remembers what it lifted', () => {
  it('lifts the same purchase on a recompute', () => {
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    const first = result.current.best.purchase?.tierId;
    rerender({ v: 2 });
    expect(result.current.best.purchase?.tierId).toBe(first);
  });

  it('keeps the memory while the purse is empty', () => {
    const { result, rerender } = renderHook(({ v }) => useRailPlan(input(), v), {
      initialProps: { v: 1 },
    });
    const first = result.current.best.purchase?.tierId;
    state.resources.evil = new Decimal(0);
    rerender({ v: 2 });
    state.resources.evil = new Decimal(2600);
    rerender({ v: 3 });
    expect(result.current.best.purchase?.tierId).toBe(first);
  });
});
```

- [ ] **Step 8: Write the hook**

Create `apps/web/src/ui/rail/useRailPlan.ts`:

```ts
import { useMemo, useRef } from 'react';
import { railPlan, type HeldKeys, type RailPlan, type RailPlanInput } from './railPlan.ts';

/**
 * The ranked spends, with the accent's memory attached.
 *
 * `railPlan` is pure and stays pure — hysteresis needs to know what was lifted last
 * time, and that is state, so it lives here. The ref is read and written inside the
 * memo, which is a side effect in render and is deliberate: the memo runs once per
 * state version, and running it twice with the same inputs returns the same answer,
 * because the second run finds its own winner already held. That is what makes it safe
 * under StrictMode's double render.
 *
 * A panel with nothing affordable **keeps** its memory rather than clearing it, so
 * emptying the purse and filling it again resumes the same row instead of picking
 * afresh.
 */
export function useRailPlan(input: Omit<RailPlanInput, 'held'>, version: number): RailPlan {
  const held = useRef<HeldKeys>({ purchase: null, appoint: null });
  const { state, content, quantity, isUnlocked } = input;

  return useMemo(() => {
    const plan = railPlan({ state, content, quantity, isUnlocked, held: held.current });

    held.current = {
      purchase: plan.best.purchase?.tierId ?? held.current.purchase,
      appoint: plan.best.appoint?.overseerId ?? held.current.appoint,
    };

    return plan;
    // `state` is mutated in place, so its identity never changes and `version` is what
    // a recompute actually hangs on. Both are listed; only one ever moves.
  }, [state, content, quantity, isUnlocked, version]);
}
```

- [ ] **Step 9: Run and commit**

Run: `pnpm --filter @dm/web test railPlan useRailPlan`
Expected: PASS. `pnpm typecheck` still fails on `App.tsx`, `BuyRail.tsx`, `Miscreants.tsx` and `oneAccent.test.tsx` — that is Task 9. Commit anyway; the branch is green again at the end of Task 9.

```bash
git add apps/web/src/ui/rail/railPlan.ts apps/web/src/ui/rail/railPlan.test.ts apps/web/src/ui/rail/useRailPlan.ts apps/web/src/ui/rail/useRailPlan.test.ts
git commit -m "Give each panel its own best spend and make it hold still"
```

---

## Task 9: Draw the per-panel accent and drop the words

Spec §2.2 and §2.4. Wires Task 8 through the components, removes `Advised` and `Affordable`, and moves the state each carried into the accessible name.

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/ui/rail/BuyRail.tsx`, `apps/web/src/ui/rail/TierRow.tsx`, `apps/web/src/ui/rail/Miscreants.tsx`, `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`
- Create: `apps/web/src/ui/rail/perPanelAccent.test.tsx`
- Delete: `apps/web/src/ui/rail/oneAccent.test.tsx`
- Test: also `apps/web/src/ui/rail/BuyRail.test.tsx`, `apps/web/src/ui/rail/Miscreants.test.tsx`

**Interfaces:**
- Consumes: everything Task 8 produced.
- `RailCopy` **loses** `best` and `affordable`, **keeps** `saving`, and **gains** `lifted: string`. `saving` stays because "save toward this" is a real state that nothing else says; `affordable` goes because affordable-and-open is the default and a default needs no label (ui-sensibility §12).

- [ ] **Step 1: Change the copy contract**

In `packages/content/src/copy.ts`, in `RailCopy`: delete `best` and `affordable` with their doc comments, and add:

```ts
  /**
   * Added to the lifted control's spoken name, never shown.
   *
   * On screen the state is carried by weight — the lifted control is filled where every
   * other is outlined, which survives greyscale and needs no word. This is the same fact
   * for anyone reading by ear.
   */
  readonly lifted: string;
```

In `packages/content/src/v1/copy.ts`, in the `rail` block: delete `best:` and `affordable:`, add `lifted: 'best available',`.

- [ ] **Step 2: Run typecheck to find every call site**

Run: `pnpm typecheck`
Expected: FAIL, naming `App.tsx`, `TierRow.tsx`, `Miscreants.tsx` and `oneAccent.test.tsx`. That list is the rest of this task.

- [ ] **Step 3: The muster row**

In `TierRow.tsx`: delete the `flag` function entirely, delete `const mark = flag(emphasis, copy);`, and delete the `{mark !== null && ...}` element. Leave the `rail__flag--overseen` element exactly as it is — that one names who holds the post and is unrelated.

Replace the buy button's `aria-label` and the shortfall span:

```tsx
aria-label={buyLabel({ tier, purchase, emphasis, copy })}
```

```tsx
<span className="rail__shortfall">
  {purchase.affordable ? '' : copy.rail.shortfall(formatNumber(shortfall))}
</span>
```

Add below the component:

```tsx
interface BuyLabelInput {
  tier: TierDef;
  purchase: RailPurchase;
  emphasis: SpendEmphasis;
  copy: RailScreenCopy;
}

/**
 * The buy button, spoken in full — and, on the lifted row, saying that it is lifted.
 *
 * The word used to sit beside the tier's name on screen. It comes off because the row
 * says the same thing by weight, and a filled control among outlined ones survives
 * greyscale. It stays here because weight is not available to anyone reading by ear.
 */
function buyLabel({ tier, purchase, emphasis, copy }: BuyLabelInput): string {
  const said = copy.rail.buy({
    count: String(purchase.count),
    tier: plural(tier, purchase.count),
    cost: copy.rail.cost(formatNumber(purchase.cost)),
  });

  return emphasis === 'best' ? `${said} — ${copy.rail.lifted}` : said;
}
```

The `rail__shortfall` span stays mounted while empty. It is already sized in CSS so nothing moves when a row becomes affordable — verify that in `BuyRail.css` and add a `min-block-size` if it is not.

- [ ] **Step 4: The miscreants**

In `Miscreants.tsx`, replace `standing`:

```tsx
/**
 * Where a post stands, in a word, or nothing where there is no judgement to report.
 *
 * "Filled" and "Beyond reach" are states worth naming. Open-and-affordable is the
 * default, and a default is not a status (ui-sensibility §12) — the price beside it and
 * the live control are already the whole of what there is to say.
 */
function standing(post: PostState, copy: MiscreantsCopy): string {
  if (post.filled) return copy.overseer.filled;
  if (post.offer === null || !post.offer.affordable) return copy.overseer.beyond;
  return '';
}
```

Replace the flag element so only `saving` survives:

```tsx
{emphasis === 'saving' && <span className="miscreant__flag">{copy.rail.saving}</span>}
```

Give the button the same spoken treatment. Its accessible name comes from its contents, so add a visually-hidden span inside the button, after `miscreant__standing`:

```tsx
{emphasis === 'best' && <span className="miscreant__lifted">{copy.rail.lifted}</span>}
```

and in `Miscreants.css`, hide it with the same clip used by `.rail__made` and `.deck__name`.

- [ ] **Step 5: App**

In `App.tsx`: import `useRailPlan` instead of `railPlan`, delete the `useMemo` block, and replace it with:

```tsx
const plan = useRailPlan({ state, content, quantity, isUnlocked: unlocked }, session.version);
```

Drop `useMemo` from the React import if nothing else uses it.

Delete the `...(plan.best?.kind === 'purchase' ? { mark: copy.rail.best } : {})` line from the muster tab and the matching `'appoint'` line from the miscreants tab. Both panels now always carry their own accent, so a dot saying "something to act on behind here" would be on every tab always, which is not a signal. `Deck`'s `mark` capability stays — it is a general facility of a shared component with its own tests, and two callers no longer using it is not a reason to remove it.

Replace the docblock paragraphs about one accent:

```
 * **One accent per region, and the regions do not move.** The stage's is Smite,
 * whenever the blow is ready. The open panel's is the best affordable spend in that
 * panel — the muster lifts a purchase, the miscreants an appointment, and neither can
 * take the other's gold because they are never on screen together. The deck shows one
 * panel at a time, so this is ui-sensibility §3 honoured rather than bent: the old
 * single winner across both panels routinely left the panel you were looking at with no
 * accent at all.
 *
 * The plan holds its choice. Scores are recomputed every slice and near-ties flipped
 * constantly, so a challenger must beat the lifted option by a quarter before the gold
 * moves. See `railPlan`'s `STICKY_MARGIN`.
```

- [ ] **Step 6: Replace the invariant test**

Delete `apps/web/src/ui/rail/oneAccent.test.tsx`. Create `apps/web/src/ui/rail/perPanelAccent.test.tsx` — keep the old file's `renderScreen` helper and its docblock's first paragraph, changing the invariant:

```tsx
describe('each panel wears exactly one accent, and never the other panel', () => {
  it('lifts one purchase on the muster', () => {
    state.resources.evil = new Decimal(2600);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(1);
  });

  it('lifts one post in the miscreants at the same time', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const { miscreants } = renderScreen(draw());
    expect(miscreants.querySelectorAll('.miscreant__post--best')).toHaveLength(1);
  });

  it('lifts a purchase even while an appointment outscores it', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(1);
  });

  it('lifts nothing on the muster with an empty purse', () => {
    state.resources.evil = new Decimal(0);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(0);
  });

  it('names the lifted purchase as lifted, for anyone reading by ear', () => {
    state.resources.evil = new Decimal(2600);
    const { rail } = renderScreen(draw());
    const lifted = rail.querySelector('.rail__row--best button');
    expect(lifted?.getAttribute('aria-label')).toContain(CURRENT_COPY.rail.lifted);
  });

  it('says nothing on screen about being advised', () => {
    state.resources.evil = new Decimal(2600);
    const { rail } = renderScreen(draw());
    expect(rail.textContent).not.toContain('Advised');
  });
});
```

`renderScreen` returns `{ rail, miscreants }` — the two containers — rather than a flat array. `draw()` passes `held: { purchase: null, appoint: null }`.

- [ ] **Step 7: Fix the rest of the suite**

Run: `pnpm --filter @dm/web test`
Any remaining failure is a test asserting on `Advised`, `Affordable`, or `plan.best.kind`. Update each to the new shape. **Do not delete an assertion to make it pass** — if a test's subject genuinely no longer exists, replace it with one covering the behaviour that took its place, and say which in the report.

- [ ] **Step 8: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Accent one spend per panel and let weight carry the state"
```

---

## Task 10: The buy quantity is one chip

Spec §1.1 and §1.2. Four radios across a strip mark the active one too quietly. One chip, cycling, showing what is active, with a gold ramp that stops one rung short of the accent.

**Files:**
- Create: `apps/web/src/ui/rail/QuantityChip.tsx`, `apps/web/src/ui/rail/QuantityChip.css`, `apps/web/src/ui/rail/QuantityChip.test.tsx`
- Delete: `apps/web/src/ui/rail/QuantityToggle.tsx`
- Modify: `apps/web/src/ui/rail/quantity.ts`, `apps/web/src/ui/rail/BuyRail.tsx`, `apps/web/src/ui/rail/BuyRail.css`, `apps/web/src/ui/tokens.test.ts`
- Test: `apps/web/src/ui/rail/quantity.test.ts` if one exists; otherwise fold into `QuantityChip.test.tsx`

**Interfaces:**
- Consumes: `BUY_QUANTITIES`, `BuyQuantity`, `quantityName` from `./quantity.ts`, and `useBuyQuantity`'s `{ quantity, setQuantity }` — both unchanged.
- Produces: `nextQuantity(quantity: BuyQuantity): BuyQuantity` and `previousQuantity(quantity: BuyQuantity): BuyQuantity` from `./quantity.ts`; `QuantityChip({ quantity, onChange, copy })` from `./QuantityChip.tsx`, same props `QuantityToggle` had.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/ui/rail/QuantityChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it, vi } from 'vitest';
import { QuantityChip } from './QuantityChip.tsx';
import { nextQuantity, previousQuantity } from './quantity.ts';

const copy = CURRENT_COPY.rail;

describe('the quantity cycles', () => {
  it('steps 1 to 10', () => {
    expect(nextQuantity(1)).toBe(10);
  });

  it('steps 100 to max', () => {
    expect(nextQuantity(100)).toBe('max');
  });

  it('wraps max back to 1', () => {
    expect(nextQuantity('max')).toBe(1);
  });

  it('steps backward from 1 to max', () => {
    expect(previousQuantity(1)).toBe('max');
  });
});

describe('the chip', () => {
  it('shows the quantity that is active', () => {
    render(<QuantityChip quantity={100} onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveTextContent('×100');
  });

  it('shows max as a word, not a symbol', () => {
    render(<QuantityChip quantity="max" onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveTextContent('×MAX');
  });

  it('advances on a press', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('goes back on an arrow', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('says which quantity is set', () => {
    render(<QuantityChip quantity={10} onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/Buy 10 at a time/);
  });

  it('ramps its weight with the quantity', () => {
    render(<QuantityChip quantity="max" onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-step', '4');
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm --filter @dm/web test QuantityChip`
Expected: FAIL, "Failed to resolve import './QuantityChip.tsx'".

- [ ] **Step 3: Add the cycle to `quantity.ts`**

Append to `apps/web/src/ui/rail/quantity.ts`:

```ts
/**
 * The next quantity in the cycle, wrapping at the end.
 *
 * The control is one chip rather than four ticks, so the set is walked rather than
 * chosen from. Four states and a wrap means every one of them is at most three presses
 * away, which is what makes a cycling control acceptable here at all.
 */
export function nextQuantity(quantity: BuyQuantity): BuyQuantity {
  return step(quantity, 1);
}

/** The previous quantity, wrapping at the start. Bound to the arrow keys. */
export function previousQuantity(quantity: BuyQuantity): BuyQuantity {
  return step(quantity, -1);
}

function step(quantity: BuyQuantity, by: number): BuyQuantity {
  const at = BUY_QUANTITIES.indexOf(quantity);
  const count = BUY_QUANTITIES.length;
  return BUY_QUANTITIES[(at + by + count) % count] ?? 1;
}
```

Change `quantityLabel` so max is a word of the same width as the widest number:

```ts
/**
 * The face of the chip. Monospaced, and four characters in every state — `×1`, `×10`,
 * `×100`, `×MAX` — so the control cannot change width as it cycles.
 *
 * Max keeps the word. `∞` is wrong: the quantity is bounded twice over, by the purse
 * and by `MAX_AFFORDABLE_CAP`, and a player who presses ∞ and gets four has been lied
 * to. The Evil sigil is worse — it is the currency everywhere else on the screen, and
 * reusing it as a quantifier would make it mean two things at once.
 */
export function quantityLabel(quantity: BuyQuantity): string {
  return quantity === 'max' ? '×MAX' : `×${quantity}`;
}
```

- [ ] **Step 4: Write the chip**

Create `apps/web/src/ui/rail/QuantityChip.tsx`:

```tsx
import type { KeyboardEvent, ReactNode } from 'react';
import type { RailCopy } from '@dm/content';
import {
  BUY_QUANTITIES,
  nextQuantity,
  previousQuantity,
  quantityLabel,
  quantityName,
  type BuyQuantity,
} from './quantity.ts';
import './QuantityChip.css';

interface QuantityChipProps {
  quantity: BuyQuantity;
  onChange: (quantity: BuyQuantity) => void;
  /** The rail's writing. `copy.rail` at the call site. */
  copy: RailCopy;
}

/**
 * How many the rail buys at a press: one chip, showing what is set, cycling on a press.
 *
 * Four radios marked the active one too quietly to find without looking for it. One
 * control that *is* its own state cannot be misread — and four states with a wrap means
 * any of them is three presses away at worst, which is what makes cycling acceptable
 * here and would not at eight.
 *
 * **A setting, so it never wears the accent.** Its weight ramps through the gold ramp
 * with the quantity, and stops one rung short of `--accent` — full-strength gold means
 * *act*, and this governs the buttons rather than being one (ui-sensibility §3, §5).
 *
 * What the radio group gave for free and this has to pay for: the arrow keys move
 * through the set without cycling, and the accessible name says which quantity is set
 * rather than what pressing will do. A control whose label changes on press has to name
 * its state, or a screen reader user hears the future instead of the present.
 */
export function QuantityChip({ quantity, onChange, copy }: QuantityChipProps): ReactNode {
  const step = BUY_QUANTITIES.indexOf(quantity) + 1;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    const on = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    if (!back && !on) return;

    event.preventDefault();
    onChange(back ? previousQuantity(quantity) : nextQuantity(quantity));
  };

  return (
    <button
      type="button"
      className="quantity-chip"
      data-step={step}
      aria-label={`${copy.quantity}: ${quantityName(quantity, copy)}`}
      onClick={() => onChange(nextQuantity(quantity))}
      onKeyDown={onKeyDown}
    >
      <span aria-hidden="true">{quantityLabel(quantity)}</span>
    </button>
  );
}
```

- [ ] **Step 5: Draw the ramp**

Create `apps/web/src/ui/rail/QuantityChip.css`:

```css
/*
 * The buy-quantity chip. See QuantityChip.tsx.
 *
 * Four rungs of the gold ramp, stopping one short of `--accent`. That last rung is the
 * one action of a region and this is a setting, so it may never reach it — the chip
 * governs the buy buttons and must not compete with the one they lift.
 *
 * Every pair below is measured against ui-sensibility §13's floor and recomputed by
 * tokens.test.ts.
 */

.quantity-chip {
  /* Four characters at the widest — ×100 and ×MAX — so the chip cannot change width as
     it cycles. This is the whole of the width requirement; no symbol was needed. */
  inline-size: 4ch;
  min-block-size: 2.25rem;
  padding: 0;
  font-family: var(--font-numeric);
  font-size: var(--text-sm);
  text-align: center;
  color: var(--ink-dim);
  background: var(--surface-raised);
  border: 1px solid var(--line);
  border-radius: var(--space-1);
  cursor: pointer;
  transition:
    background var(--duration-fast) ease-out,
    color var(--duration-fast) ease-out,
    border-color var(--duration-fast) ease-out;
}

.quantity-chip[data-step='2'] {
  color: var(--ink-muted);
  background: var(--accent-well);
  border-color: var(--accent-line);
}

.quantity-chip[data-step='3'] {
  color: var(--ink);
  background: var(--accent-line);
  border-color: var(--accent-soft);
}

.quantity-chip[data-step='4'] {
  color: var(--on-accent);
  background: var(--accent-soft);
  border-color: var(--accent-soft);
  font-weight: 600;
}

.quantity-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Swap it into the rail**

In `BuyRail.tsx`, replace the `QuantityToggle` import with `QuantityChip` and the element:

```tsx
<div className="muster__setting">
  <span className="muster__setting-name">{copy.rail.quantity}</span>
  <QuantityChip quantity={quantity} onChange={onQuantity} copy={copy.rail} />
</div>
```

Delete `apps/web/src/ui/rail/QuantityToggle.tsx`.

In `BuyRail.css`, delete every `.quantity*` rule (the whole block from the `--- the quantity setting ---` comment to the end of the clipped-label rule) and give the strip its new shape:

```css
.muster__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.muster__setting-name {
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-dim);
}
```

Read the existing `.muster__setting` rule first and keep whatever padding and border it already carries.

- [ ] **Step 7: Pin the new contrast pairs**

In `apps/web/src/ui/tokens.test.ts`, add the chip's three gold pairs to whatever table the file already drives its contrast assertions from. Expected ratios, computed against the current primitives: `--ink-muted` on `--accent-well` ≥ 12:1, `--ink` on `--accent-line` ≥ 4.5:1 (measures 4.81), `--on-accent` on `--accent-soft` ≥ 4.5:1 (measures 5.26). Match the file's existing style exactly — do not add a second contrast helper.

- [ ] **Step 8: Run and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add -A
git commit -m "Cycle the buy quantity on one chip that shows what is set"
```

---

## Task 11: Fold the amendments back into the design docs

The specs are read before every piece of work here and two of them now describe an interface that no longer exists.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-dread-majesty-design.md`, `docs/ui-sensibility.md`

**Interfaces:** none.

- [ ] **Step 1: Amend §6 of the design spec**

In `docs/superpowers/specs/2026-08-03-dread-majesty-design.md`, replace the sentence in the **Rail — one accent, always** paragraph that reads "the single best available purchase is lifted out and accented" and the sentence about the buy quantity toggle:

```
**Rail — one accent per panel.** `ui-sensibility.md` §3 forbids five equal buttons; the
genre's scrolling list is nothing else. Every generator sits in the rail at secondary
weight, and **the best available purchase in that panel is lifted out and accented**.
The miscreants panel accents its own best appointment, and the stage accents Smite
whenever the blow is ready. The deck shows one panel at a time, so at most two accented
controls are ever on screen and both are always in the same place. A single winner
across both panels — which is what this was — left whichever panel you were looking at
with no accent at all whenever the other one won. See
`2026-08-04-stage-and-rail-polish-design.md` §2.

The accent holds its choice. Scores are recomputed every slice, so a challenger must
beat the lifted spend by a quarter before the gold moves.

Buy quantity (×1 / ×10 / ×100 / ×MAX) is a sticky global setting on one cycling chip,
whose weight ramps with the quantity and never reaches full-strength gold.
```

- [ ] **Step 2: Amend the stage paragraph**

In the same section, replace the sentence "On completion the ring snaps and motes travel down the link to the next node" with:

```
On completion the ring flashes and motes travel down the link to the next node — and
the run takes the tone of what it *delivers*, not of what sent it, so the last run into
Evil is ember whatever colour the Minions above it are. Both progress indicators read
in five segments rather than as a continuous sweep, so a glance gives a fraction.
```

- [ ] **Step 3: Amend ui-sensibility §3**

In `docs/ui-sensibility.md`, under **## 3. One action per screen**, after the "Navigation is not an action" paragraph, add:

```
**One region, one action.** A screen showing two regions at once — a live diagram beside
a panelled deck — gets one accent in each. The failure the rule is guarding against is
five equal buttons competing, not two accents in two places a person can learn. What
must never happen is the accent *moving*: an accent that is sometimes here and sometimes
there is worse than two that always are.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Fold the polish pass back into the design docs"
```

---

## Self-Review

**Spec coverage.** §1.1 and §1.2 → Task 10. §2.2 → Tasks 7, 8, 9. §2.3 → Task 8. §2.4 → Task 9. §3.1 and §3.2 → Task 3. §3.3 → Task 2. §3.4 → Task 1. §3.5 → Task 4. §3.6 → Task 5. §3.7 → Task 6. §3.8 → Task 7. §5's two invariants → Tasks 9 and 10. §4's "no engine change" holds: no task names a file under `packages/engine`.

**Type consistency.** `RailBest` and `HeldKeys` are defined in Task 8 and consumed in Task 9 under those names. `DeckGlyphKind` is defined in Task 5 and used in the same task's `App.tsx` edit. `CYCLE_SEGMENTS` and `quantise` are defined in Task 1 and used nowhere else. `nextQuantity` / `previousQuantity` are defined and consumed inside Task 10. `produced` is added to `TierNodeProps` in Task 2 and passed in the same task.

**Ordering.** Task 8 must precede Task 9 — Task 8 leaves the branch failing typecheck and Task 9 restores it, and that is called out in both. Task 5 must precede Task 6; both edit `Deck.css`. Task 7 edits `App.tsx` before Task 9 does, and says which lines it owns. Everything else is independent.

**Known soft spots, stated rather than hidden.** Tasks 3, 6 and 7 each end in something only eyes can settle: whether the thicker run reads as one chain, whether the open tab now reads as open, and whether the pinned report holds at every width. Each says so, and none of them is claimed as tested. Task 1's ring geometry is arithmetic that jsdom cannot draw — the tests check the dash numbers, which is the fact the drawing depends on, not the drawing.
