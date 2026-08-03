# Local Art Generation — what the threejs-lab repo can do for you

A capability briefing for an agent working in **another repo on the same machine**. It tells you
what art this lab can produce, how to ask for it, and the handful of traps that fail silently.

Lab: `/Users/matthewballou/projects/game-dev/threejs`

> **Hard prerequisite.** Everything here runs against **Draw Things on `127.0.0.1:7860`**, on this
> machine. Nothing is remote, nothing is a hosted API, and there is no fallback. Check it first:
> `curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:7860/` — anything but `200` and you
> stop and tell the user to open Draw Things.

---

## What it produces today

| Capability | Output | Notes |
| --- | --- | --- |
| **Fantasy props and equipment** | 1024×1024 PNG | Weapons, armour, shields, containers, totems. The best-proven path |
| **Fantasy characters** | 1024×1024 PNG | Single figure, full body, plain backdrop |
| **Photo → anthro character art** | matches source aspect | img2img over a real photograph. Separate tool, see below |
| **Procedural Three.js models** | TypeScript | From a reference image, via the `img2threejs` skill. **Hard-surface objects only** |

Five **Glazes** (style identities) exist:

```
solid-cast-fantasy    volumetric masses, unbroken silhouettes — the one to use if the image
                      will later be rebuilt as 3D geometry
low-poly-fantasy      faceted, hard normal breaks — good 2D art, cannot be rebuilt as geometry
frost-bitten-bronze   hammered metal against cold rime, hard specular
painted-hide-fiber    flat pigment on rawhide, ochre/indigo, almost no specular
obsidian-ember        near-black volcanic glass with glowing inlay
```

Theme so far is African-inspired, tribal, cold-region fantasy. Nothing enforces that.

---

## How to ask for images

Everything is a row in `<libraryRoot>/lab.db`, outside the repo. **Write through actions, never
raw SQL and never files.**

```bash
cd /Users/matthewballou/projects/game-dev/threejs
node scripts/pipeline.mjs --list                     # every action
node scripts/pipeline.mjs listGlazes  --json '{}'
node scripts/pipeline.mjs listEntries --json '{}'    # the Lexicon: 42 entries
node scripts/pipeline.mjs listTiles   --json '{}'    # 13 recorded prompt findings — READ THIS
```

The shape, for a batch of unrelated one-off images:

1. `createPlateSet` — one per subject, **one view** (`three-quarter-hero`), left as a draft.
2. `createStudy` — aimed at that draft set via the top-level `plateSet` argument, carrying its own
   `content.text`. Leave `content.plateSet` **unset**.
3. `createFiring` — slug `<YYYY-MM-DD>-<name>`, the Study uids in run order.
4. `node scripts/gen-firing.mjs --firing <slug> --dry-run` — read every resolved prompt.
5. Drop `--dry-run` to generate. About **85–330 seconds per image** depending on size.

**There is no scheduler tick.** `scheduleFiring` and `startFiringNow` only write a timestamp;
nothing reads it. A queued Firing sits queued forever. Either run `gen-firing.mjs` yourself, use
`/Users/matthewballou/projects/game-dev/threejs/scripts/run-firing-queue.sh` (edit its `QUEUE`
array), or **tell the user to run it** and hand them the exact command.

### Photo → anthro art, a separate tool

```bash
node scripts/style-transfer.mjs --list
node scripts/style-transfer.mjs --list-species
node scripts/style-transfer.mjs --in <photo-or-folder> --style all --species fox --denoise 0.7 --dry-run
```

Four styles (`inked-anthro`, `render-3d`, `painted-anthro`, `flat-cel`). It bypasses the database
entirely, because the lab's img2img path only accepts images the lab itself generated. Full
write-up: `docs/style-transfer.md` in the lab.

---

## Non-negotiables

- **Never set `cfg` below 2.** At cfg 1 the unconditional branch is never evaluated and **every
  negative is silently discarded**. No error. `GENERATION_DEFAULTS` is cfg 2 for this reason.
- **Never open, view or grade a generated image.** The human reviews every one. Report the Firing
  slug and the output directory; stop there.
- **Never hand-write `version`, `hash`, `created` or `updated`.** `saveEntry` and `savePiece`
  compute them from the content hash.
- **Never commit generated images or `lab.db`.** Both live outside the repo by config.
- **Never `--force` past a Draw Things model mismatch.** Stop and report.

---

## Traps that fail silently

Each of these produces plausible output that is simply wrong.

1. **A loaded noun overrides everything after it.** A class or species word carries its own
   ethnicity, palette, garment and silhouette priors, and they beat adjectives that follow.
   Swapping `warrior` for `sorceress` replaced a dark-skinned figure in tribal panelling with a
   pale one in a hooded purple robe. **Structure every prompt** as: identity → design language →
   the loaded noun → gear → **identity restated** → framing. One mention in front is not enough.
2. **A negative can cancel your own positive.** `composePrompt` joins six independently-authored
   sources, so no single author sees the whole negative. One term negated the bare word `gold`
   while the palette asked for gold by name — 6 prompts silently cancelled. **Sweep every composed
   prompt for negative phrases appearing verbatim in its own positive** before generating.
3. **A plate is an img2img init image, not a token.** A Study *drawing on* a ready plate set has
   every image denoised out of that plate's picture. Correct for several views of one subject;
   wrong for a batch of unrelated things. A Study *targeting* a draft set goes txt2img — that is
   the path you want for one-offs.
4. **Say how many objects belong in the frame.** "A hero weapon" invites a crossed-swords icon.
   "A single sword, one sword alone in frame" does not.
5. **Prefer a positive that makes the fault impossible** to a negative that forbids it. "Laid out
   flat on a plain surface, seen from above" got a genuinely orthographic result where three
   separate counter-phrases had failed.

---

## Extending it — this is encouraged

**Add Lexicon terms** with `saveEntry`: one call, a `category` plus the content object. Categories
in use: `form`, `material`, `ornament`, `palette`, `features`, `render`, `view`. Reuse before you
add; check `listEntries` first. Additive changes never disturb a running Firing.

**Add a Glaze** when the look is a different identity rather than a different subject. Read the
existing Glazes' `notes` first — they are short essays stating the trade each one makes, and yours
should meet that standard. Say plainly what the Glaze buys and what it costs.

**New art endpoints are wide open**, and the existing Glazes assume a rendered 3D-ish product shot,
which most of these do not want:

- **Flat 2D art / illustration** — closest to `low-poly-fantasy`'s role. Needs `render` and `view`
  entries that stop asking for studio product lighting.
- **Thumbnails / icons** — wants tight framing, a readable silhouette at small size, and a strong
  single focal shape. A new `view` entry is most of the work.
- **Pixel art** — needs its own Glaze *and* an honest look at output size. The pipeline emits
  1024×1024 and **does not downscale**; real pixel art needs a small canvas or a downsample step
  that does not exist yet. Worth building, but say so rather than shipping blurry fake pixel art.
- **Tiling textures, UI frames, card borders, maps** — all unexplored.

Whatever you add, **`recordTile` anything a run teaches you** about how a term misbehaves, with the
`model` and `steps` you saw it on. `listTiles` is the institutional memory and it is why the traps
above are known.

---

## Where to read more, in the lab repo

| Question | File |
| --- | --- |
| The nouns — Piece, Study, Firing, Sheet, Plate Set, Candidate, Tile | `docs/data-model.md` |
| Writing prompts that survive the model | `.claude/skills/authoring-firings/SKILL.md` |
| What every run has cost and taught | `docs/asset-pipeline-log.md` |
| Photo → anthro art in full | `docs/style-transfer.md` |
| Image → Three.js, and its limits | `docs/img2threejs-pitfalls.md` |

**Before concluding image-to-3D is broken**, read `docs/img2threejs-pitfalls.md` §"Pitfall zero".
The tool is strong on hard-surface manufactured objects and has **no creature generator at all**,
despite its README listing one as shipped. A finished example lives at
`/Users/matthewballou/projects/game-dev/threejs/src/models/sword/`.
