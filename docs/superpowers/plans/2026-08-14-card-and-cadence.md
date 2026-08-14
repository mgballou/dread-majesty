# Card and Cadence Tweaks

> **For agentic workers:** Two tasks, both small. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Strip three labels off the rail card, change the count it shows, soften the dim
during her turn so the rail stays usable, and slow the strike's beckon to an occasional blip.

**Why no spec:** five bounded changes to shipped behavior, each fully described by the player's
own words. Recorded here rather than in a design doc because none of them changes a rule.

## Global Constraints

- `pnpm` is not on PATH: `./node_modules/.bin/vitest run <path>`, `./node_modules/.bin/eslint .`,
  `./node_modules/.bin/prettier --check .`
- **No root `tsconfig.json`.** `npx tsc --noEmit` at the root reads zero files and always passes.
  Use `npx tsc --noEmit -p packages/content/tsconfig.json` and `-p apps/web/tsconfig.json`.
- **Run prettier and eslint before every commit.**
- US English. ~40 pre-existing files use British spellings — existing convention, out of scope,
  but a British spelling on a **new** line is in scope.
- No `any`, no default exports, no `as` casts, no raw color or size values outside `tokens.css`.
- Exhaustive `switch` with no `default`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.
- No comments in tests unless genuinely unusual. One assertion per `expect`.
- **Every test must be able to fail.** Ask what source change would break it; if nothing would,
  fix or delete it. This branch has produced inert tests five times.
- Commit messages: one imperative line, no trailers, **no AI attribution**.
- If signing fails with a 1Password error, use `--no-gpg-sign`; never change git config.

---

## Task 1: Strip the rail card back

**Files:**
- Modify: `packages/content/src/copy.ts`, `packages/content/src/v1/copy.ts`
- Modify: `apps/web/src/ui/rail/TierRow.tsx`, `apps/web/src/ui/rail/Miscreants.tsx`
- Modify: `apps/web/src/ui/rail/BuyRail.css` (and `Miscreants.css`) — orphaned rules
- Test: `packages/content/test/copy.test.ts`, `apps/web/src/ui/rail/BuyRail.test.tsx`

Four changes, all to what the card says.

- [ ] **Step 1: Drop "Save toward this"**

`TierRow.tsx:84` renders `copy.rail.saving` behind `emphasis === 'saving'`. Remove the element.

**It is also on the miscreants panel** — `Miscreants.tsx:218`, same flag, same reasoning. Remove
it there too. The player's objection is that it clutters and that the gold lift already carries
the directive; that argument does not stop at one panel, and leaving one of the two would be an
inconsistency nobody asked for.

Then remove `saving` from `RailCopy` in `copy.ts` and from `v1/copy.ts`. Nothing else uses it.

- [ ] **Step 2: Drop "Short X Evil"**

`TierRow.tsx:121` renders `copy.rail.shortfall(...)` inside an always-mounted
`<span className="rail__shortfall">`. Remove the span entirely, and the local `shortfall`
computation above it if nothing else reads it.

Remove `shortfall` from `RailCopy` and `v1/copy.ts`.

**Check `buyLabel`.** The spoken button label must still say what the button does; confirm it
never read the shortfall (it does not today — it uses `buy`, `cost` and `lifted`). If removing
the visible text takes away information a screen reader had, say so rather than shipping it.

- [ ] **Step 3: Drop the "bought" line and change the count**

`TierRow.tsx:90-93` renders `.rail__bought` with `copy.rail.bought(...)` whenever
`gen.purchased.lt(gen.owned)`. Remove the whole `<p>`, its comment, and `bought` from both copy
files.

Then `TierRow.tsx:85`:

```tsx
<span className="rail__owned">{copy.rail.held(formatWhole(gen.owned))}</span>
```

becomes the **purchased** count, not the owned one:

```tsx
<span className="rail__purchased">{copy.rail.purchased(formatWhole(gen.purchased))}</span>
```

In `copy.ts`, rename `held` to `purchased` and update its doc comment; in `v1/copy.ts`:

```ts
    purchased: (count: string): string => `${count} purchased`,
```

The class renames with it — `rail__owned` would be a lie once it shows a purchased count. Update
`BuyRail.css` accordingly.

The row now states only what the player bought. The stage still shows what they *have*, and the
gap between the two is the cascade — the player does that arithmetic themselves, which is the
point of the change.

- [ ] **Step 4: Clean up the stylesheets**

`.rail__flag`, `.rail__shortfall`, `.rail__bought` and `.miscreant__flag` now have no elements.
Remove their rules. **Check whether any reserved height went with them** — `.rail__shortfall` and
`.rail__bought` were mounted-but-empty specifically to stop layout shift, so their rules may hold
a `min-height` that other rules assumed. Removing the elements is what the player asked for; make
sure the row still lays out without a gap where they were, and say in your report what changed
about the row's height.

- [ ] **Step 5: Update the tests**

`packages/content/test/copy.test.ts:170-171, 221-223` and `apps/web/src/ui/rail/BuyRail.test.tsx`
at roughly `:89-92`, `:103-108`, `:138`, `:149-158`, `:384-387` all reference the removed copy.

Delete the cases that tested removed behavior. **Add one that pins the new behavior**: a row
where `purchased` and `owned` differ shows the purchased count, not the owned one. That is the
whole change and nothing currently asserts it.

Do not leave a test that renders a row and asserts nothing.

- [ ] **Step 6: Gate and commit**

```
./node_modules/.bin/vitest run
npx tsc --noEmit -p packages/content/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
```

```bash
git commit -m "Strip the rail card to the purchased count"
```

---

## Task 2: Let her share the screen, and slow the beckon

**Files:**
- Modify: `apps/web/src/ui/Spotlight.tsx`, `apps/web/src/ui/Spotlight.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/ui/stage/EvilNode.css`
- Test: `apps/web/src/ui/Spotlight.test.tsx`, `apps/web/src/App.test.tsx`

- [ ] **Step 1: Give the cutout two weights**

Today `Spotlight` picks one of three modes and the cutout always dims to the full `--scrim` (78%).
That is right when the beat **gates** a control — everything else really is held back. It is wrong
for her: `goad` gates nothing, every control stays live, and dimming the rail to 78% tells the
player it is unavailable when it is not.

**The dim's weight follows whether the interface is actually held back.** Add an optional prop:

```ts
  /**
   * How hard the screen dims around the cutout.
   *
   * `full` is a gated beat: the named control is the only one that works, and the dim says so.
   * `soft` is a beat that points without gating — she asks for a blow while the rail stays live,
   * and a full dim would claim otherwise. The ring still carries the pointing either way.
   */
  weight?: 'full' | 'soft';
```

Default `full`. Put it on the root as `data-weight`, matching the `data-motion` idiom already
there, and in `Spotlight.css`:

```css
.spotlight--cutout[data-weight='soft'] .spotlight__band {
  background: var(--scrim-soft);
}
```

`--scrim-soft` already exists and is exactly this: half weight, what a narrative beat dims to.

- [ ] **Step 2: Decide it in App**

`App.tsx` computes `spotlight` from the beat. Pass `weight` by conditional spread
(`exactOptionalPropertyTypes` is on):

```tsx
{...(beat.gate.kind === 'none' ? { weight: 'soft' as const } : {})}
```

Read how `spotlight.target` is already spread there and match it. The condition is the beat's own
gate — do not add a new field to content for this.

- [ ] **Step 3: Slow the beckon to a blip**

`EvilNode.css:217-225`. The animation runs at `var(--duration-slow)`, which is **420ms** — it
pulses more than twice a second, which reads as urgency in a spot where nothing is urgent yet.

Make it an occasional blip: a long cycle that sits still for most of it.

```css
.evil-node[data-motion='full'][data-beckon='true'][data-smite='ready'] .evil-node__strike {
  /* Not `--duration-slow`: at 420ms this pulsed twice a second and read as urgency, in the one
     place where nothing is urgent yet. The mark of this is a blip you catch out of the corner of
     an eye, not a throb. Composed from the token rather than written flat, so it moves if the
     motion scale does. */
  animation: evil-node-beckon calc(var(--duration-slow) * 12) ease-in-out infinite;
}

@keyframes evil-node-beckon {
  0%,
  90%,
  100% {
    transform: none;
  }
  95% {
    transform: scale(1.02);
  }
}
```

That is a ~500ms blip once every ~5 seconds. Look at it and say in your report whether the
interval reads right; adjust the multiplier if not and say what you changed.

- [ ] **Step 4: Tests**

- `Spotlight.test.tsx`: a cutout with `weight="soft"` carries `data-weight="soft"`; without the
  prop it is `full`. Add a stylesheet-contract case, using the existing `rule()` helper, that the
  soft cutout resolves to `--scrim-soft` and the default to `--scrim` — assert token names, never
  hex values.
- `App.test.tsx`: while she holds the bar the spotlight is soft, and on a gated Dominion beat it
  is full. This is the change; nothing else pins it.

jsdom measures every element as zero, so do not assert geometry — assert the attribute and the
stylesheet text.

- [ ] **Step 5: Gate and commit**

Same six commands as Task 1.

```bash
git commit -m "Soften the dim when a beat points without gating, and slow the beckon"
```

---

## Final gate

All six checks clean, no `packages/engine` file in the diff, `SAVE_VERSION` unchanged, no AI
attribution in any commit message.
