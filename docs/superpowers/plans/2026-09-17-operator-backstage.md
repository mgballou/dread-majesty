# Operator Backstage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the chain a server: a Laravel + Filament app that authors, validates, versions and publishes the production chain as data, holds the balance harness and conformance runs, inspects a pasted save, and carries its own log10 and pow10. The game keeps working with no account and no network.

**His six answers (The Third Hour, 14 September 2026, all recommended):**

| # | Question | Answer |
|---|----------|--------|
| 1 | Does the game take a server at all? | **Operator** — a place to author and publish the chain, which no player ever sees |
| 2 | What is the package's one sentence? | **Reconciler** — a deterministic fixed-step reconciler over a declared production graph |
| 3 | Does the abstraction hold? | **Narrow** — true of exactly one shipped game unless a second implementation makes it two |
| 4 | Can two languages agree? | **Exact** — PHP carries its own log10 and pow10 rather than the platform's |
| 5 | Does this app have two audiences? | **One** — it is him. The player never authenticates |
| 6 | What ships first? | **Vectors** — conformance vectors before any PHP |

**Tech Stack:** Laravel 13, Filament 5, PHP 8.4, Pest, PHPStan level 9. TypeScript conformance vectors via the existing pnpm workspace. The Filament app is the operator backstage (§1.6); no player-facing surface.

---

## 1. Where the app lives

**Recommendation: a new repository, `dread-majesty-backstage`.**

The monorepo is a pnpm TypeScript workspace. A Laravel app in it needs Composer, PHP, a database, a web server, and a `vendor/` tree — none of which pnpm manages. The workspace `packages/*` and `apps/*` convention would carry a PHP app as a foreign body: it would not appear in `pnpm check`, would not typecheck alongside the TypeScript packages, and would need its own CI workflow. That buys co-location and costs a workspace that is no longer one thing.

A separate repo keeps the PHP app under `composer check` and the TypeScript workspace under `pnpm check`, each with its own CI. The conformance vectors live in the engine repo — they are engine artifacts, not backstage artifacts — and the PHP app reads them as a fixture during `composer test`. Publishing a release hands the client a JSON file it fetches; the repos share a schema, not a dependency.

The cost is two repos where the chain definition crosses both. That crossing is the conformance vectors: the engine emits them, the PHP port passes them. It is already mediated by a JSON file, so no import runs between the two.

**Do not create the repository or add any remote.** That is publication and it is his.

---

## 2. Milestone 1 — conformance vectors (before any PHP)

**Where:** `packages/engine/conformance/` in the existing dread-majesty repo.

**What:** `pnpm conformance:emit` writes `conformance/vectors/v1.json` and `pnpm conformance:verify` replays them against `catchUp`. Done means a committed vectors file, a green verify in CI, and every vector labelled `exact` or `toleranced` by which side of `9e15` it falls on.

### Vector shape

```jsonc
{
  "version": "1",
  "emittedAt": "2026-09-17T...",
  "engineCommit": "2cde28e",
  "chain": { /* the full Content object, serialized */ },
  "vectors": [
    {
      "label": "two-hour absence from fresh state",
      "kind": "exact",           // or "toleranced"
      "tolerance": null,         // or "1e-11" for toleranced
      "startState": { /* SaveBlob */ },
      "elapsedMs": 7200000,
      "expected": {
        "endState": { /* SaveBlob */ },
        "produced": { "evil": "...", "minion": "...", ... }
      }
    }
  ]
}
```

Every numeric value is a string. `kind` is `exact` when the vector's start state and elapsed time keep all values below `9e15` (plain IEEE-754 doubles, no log-space). `kind` is `toleranced` when any value crosses the line, with `tolerance` stating the maximum relative error (recommended `1e-11`, four orders of magnitude below the harness's sensitivity).

### The vectors to emit

| # | Label | Start state | Elapsed | Kind | Why |
|---|-------|-------------|---------|------|-----|
| 1 | Fresh state, 1s | `createState()` | 1,000ms | exact | Sanity: one Minion produces 5 Evil |
| 2 | Fresh, 5m | `createState()` | 300,000ms | exact | The opening: Warrens should appear |
| 3 | Fresh, 30m | `createState()` with harness buy policy to 30m | 60,000ms | exact | Mid-game slice, multiple tiers active |
| 4 | Fresh, 2h then 1h absence | State at 2h via harness | 3,600,000ms | exact | Still under `9e15` at 3h total |
| 5 | Fresh, 4h then 4h absence | State at 4h via harness | 14,400,000ms | toleranced | Crosses the `9e15` line; layer-1 log-space |
| 6 | 8h state, 4h absence | State at 8h via harness | 14,400,000ms | toleranced | Deep into log-space; stresses pow10 |
| 7 | Prestige state at 3h, 1h post-reset | State after 3h prestige | 3,600,000ms | exact | Soul multiplier is active, values still small |
| 8 | One step at exactly `9e15` | Synthetic: one resource at `9e15 - 1` | 100ms | exact | Edge: still IEEE-754 |
| 9 | One step past `9e15` | Synthetic: one resource at `9e15 + 1` | 100ms | toleranced | Edge: first log-space operation |

### Tasks

- [ ] **2.1** Create `packages/engine/conformance/` and `packages/engine/conformance/vectors/`.
- [ ] **2.2** Write `packages/engine/conformance/emit.ts`. It imports `createState`, `step`, `catchUp`, `serialize`, the harness's `decide` function (extract it to a shared utility if needed), and `CURRENT`. For each vector: build the start state by running the engine to the prescribed point, serialize it, run `catchUp` or `step` for the prescribed elapsed time, serialize the end state, label the vector `exact` or `toleranced` by checking whether any `Decimal` in the start or end state crosses `9e15`. Write the JSON to `conformance/vectors/v1.json`.
- [ ] **2.3** Write `packages/engine/conformance/verify.ts`. It reads `v1.json`, deserializes each start state, runs `catchUp` with the stated elapsed time, and compares the end state field by field. For `exact` vectors: string equality on every serialized value. For `toleranced` vectors: parse both as `Decimal` and assert `|actual - expected| / |expected| < tolerance` for every nonzero field, and string equality for zero fields. Exit 1 on any failure.
- [ ] **2.4** Add `"conformance:emit"` and `"conformance:verify"` scripts to `packages/engine/package.json`, running via `tsx`.
- [ ] **2.5** Write `packages/engine/conformance/verify.test.ts`: a vitest test that calls the verify logic against the committed vectors. This is the CI gate.
- [ ] **2.6** `pnpm conformance:emit`, inspect the output, `pnpm conformance:verify`, then `pnpm check`. Commit the vectors file.

**Done check:** `pnpm conformance:verify` exits 0, `pnpm check` passes, the vectors file is committed with every vector labelled.

**Fits one night row.**

---

## 3. Milestone 2 — PHP Decimal with its own log10 and pow10

**Where:** `dread-majesty-backstage` (the new repo, once created). A Composer package under `packages/decimal/`.

**What:** A PHP transliteration of `break_eternity`'s three-field representation (`sign`, `layer`, `mag`) on PHP doubles. It carries its own `log10` and `pow10` rather than calling the platform's, because V8 and PHP's `libm` disagree on 3.21% and 9.39% of calls respectively. It copies `add`'s drop-the-smaller-operand behavior rather than fixing it, because the target is agreement with the TypeScript engine, not mathematical improvement.

### Why carry log10 and pow10

Above `9e15` the library stores the base-10 logarithm of the value. Every addition at layer 1 costs a `log10` and a `pow10`. V8 ships its own implementations; PHP calls the platform `libm`. Measured on this machine over 20,000 samples:

- `log10(x)`: 3.21% of calls disagree, worst case 2 ulp
- `pow(10, x)`: 9.39% disagree, worst case 1 ulp

The fix: transliterate V8's specific `log10` and `pow10` polynomial approximations into PHP, so the PHP port uses the same algorithm on the same double inputs and produces the same double outputs. Not a lookup table, not a correction factor — the same code.

### Tasks

- [ ] **3.1** Set up the package: `packages/decimal/`, `composer.json`, `phpunit.xml` or `pest.php`, PHPStan at level 9. Three classes: `Decimal` (the value object), `DecimalMath` (static arithmetic), `DecimalLog` (the ported log10/pow10).
- [ ] **3.2** `Decimal`: `readonly float $sign`, `readonly int $layer`, `readonly float $mag`. Constructor from string. `toString()`. `toNumber()`. `fromNumber()`. The three-field normalization. Immutable — every operation returns a new `Decimal`.
- [ ] **3.3** `DecimalLog::log10(float $x): float` and `DecimalLog::pow10(float $x): float`. Transliterate from V8's source (available at `chromium/v8/src/base/ieee754.cc`). Every input/output pair must match V8's to the bit. Test against the conformance vectors' layer-1 values.
- [ ] **3.4** `DecimalMath`: `add`, `sub`, `mul`, `div`, `pow`, `log10`, `cmp`, `floor`, `max`, `min`. Follow `break_eternity.js`'s logic path by path, including the drop-the-smaller-operand behavior in `add` for layer-0 values whose sum would overflow into layer 1.
- [ ] **3.5** Conformance test: read `v1.json` (copied from the engine repo), deserialize each vector's start state into PHP `Decimal` objects, run the equivalent of `catchUp` (a step loop), and compare the end state. `exact` vectors: string equality. `toleranced` vectors: relative error under the stated tolerance.
- [ ] **3.6** A `Value` cast for Eloquent: stores `sign|layer|mag` as three columns or a JSON column, hydrates to `Decimal`. This is §5's value cast, built here because the model depends on it.

**Done check:** `composer test` passes, every conformance vector passes, PHPStan level 9 clean.

**Two night rows.** The log10/pow10 port is the hard part; arithmetic and the cast are mechanical once those pass.

---

## 4. Milestone 3 — models and casts

**Where:** `dread-majesty-backstage`.

**What:** The Eloquent models for the chain, per architectural-sensibility §5.

### Models

| Model | Key fields | Notes |
|-------|-----------|-------|
| `Chain` | `version`, `status` (enum: Draft, Published, Archived) | One chain; `version` is the content version string |
| `Tier` | `chain_id`, `position`, `tier_key`, `name`, `plural`, `produces`, `yield` (Decimal), `cycle_ms`, `cost_resource`, `base_cost` (Decimal), `cost_rate`, `art` | Ordered by `position`. `yield` and `base_cost` use the `DecimalCast` |
| `Overseer` | `tier_id`, `position`, `overseer_key`, `name`, `cost` (Decimal), `effect_kind`, `effect_factor` | `effect_kind` is an enum: Automate, Quicken, Swell |
| `Milestone` | `chain_id`, `at`, `multiplier` | Ascending by `at` |
| `Achievement` | `chain_id`, `achievement_key`, `name`, `description`, `condition` (JSON cast), `multiplier` | `condition` follows the discriminated union from TypeScript |
| `SmiteUpgrade` | `chain_id`, `smite_upgrade_key`, `name`, `base`, `unit` (enum), `rungs` (JSON cast) | |
| `Prestige` | `chain_id`, `k`, `scale` (Decimal), `exponent`, `per_soul` | One per chain |
| `Release` | `chain_id`, `version_tag`, `published_at`, `chain_snapshot` (JSON), `notes` | The published, immutable snapshot |

### Enums

- `ChainStatus`: Draft, Published, Archived — with `isEditable()`, `isPublished()`.
- `OverseerEffect`: Automate, Quicken, Swell.
- `SmiteUnit`: Seconds, Multiplier, Amount.

### Tasks

- [ ] **4.1** Scaffold the Laravel app: `composer create-project laravel/laravel .`, Filament installed, Pest, PHPStan, Pint with the reference config from §22. SQLite for development.
- [ ] **4.2** Create migrations for all models.
- [ ] **4.3** Create the models with relationships, casts, and the `DecimalCast`. Generic-typed relationships. `Model::shouldBeStrict()` in `ModelServiceProvider`. Morph map in `RelationServiceProvider` (even with one panel, it is mandatory per §16).
- [ ] **4.4** Create the enums with display metadata (§6): labels, colors, icons, predicates, set helpers.
- [ ] **4.5** Create factories for every model. `createQuietly()` in tests.
- [ ] **4.6** Write model tests: relationships load, casts round-trip, enum predicates hold.

**Done check:** `composer check` passes (lint + PHPStan + test). Every model has a factory, every factory builds a valid record.

**One night row.**

---

## 5. Milestone 4 — the Filament backstage

**Where:** `dread-majesty-backstage`.

**What:** A Filament panel on `/admin` for authoring, validating, versioning and publishing the chain. Per §9, every resource has `Schemas/`, `Actions/`, `Pages/`, and the Resource class fits on one screen.

### Resources

**ChainResource** — the top-level entry point.
- Table: version, status badge, tier count, last published date. Filterable by status.
- View: the full chain rendered as a nested infolist: tiers in chain order, each with its overseers, then milestones, achievements, smite upgrades, prestige.
- Edit: the chain form, with nested repeaters for tiers and their overseers. Milestones, achievements, and smite upgrades as separate relation managers.
- Actions:
  - `PublishChainAction` — a Filament Action that delegates to `Services/Chain/Actions/PublishChain`. It snapshots the current chain into a `Release`, sets the chain status to Published, and writes the JSON file the client fetches. Requires confirmation. Only available when the chain is in Draft and passes validation.
  - `RunHarnessAction` — runs the conformance vectors against the current draft. Shows a result summary as a notification. Details on a dedicated page.
  - `DiffReleasesAction` — compare two releases side by side. Opens a dedicated page.

**ReleaseResource** — read-only, showing the published snapshots.
- Table: version tag, published date, notes.
- View: the frozen chain snapshot, rendered identically to the chain infolist but from the JSON column.

### Nested chain authoring

Tiers are edited inline on the chain form as a Repeater, ordered by `position`. Each tier row expands to show its overseers as a nested Repeater. This is the Filament pattern for parent-child-grandchild editing, and it works because the chain is shallow (five tiers, three overseers each, fifteen rows total).

Milestones, achievements, and smite upgrades are RelationManagers on the chain's View/Edit pages rather than nested Repeaters, because they are siblings of the tiers rather than children.

### The publish flow

`Services/Chain/Actions/PublishChain`:
1. Validate the chain: every tier has a valid cycle, cost curve, and at least one overseer. Milestones are ascending. Achievement conditions reference existing tier keys.
2. Snapshot the chain into a `Release` record with the full JSON.
3. Write the JSON to a configured output path (or S3, configurable). This is the file the client fetches.
4. Set the chain status to Published.

The client ships a baked `CURRENT` in its bundle and fetches a newer chain only if it can. The game keeps working with no account and no network. See milestone 7.

### The release diff page

A custom Filament page, not a resource page. Takes two release version tags as route parameters. Renders a two-column comparison: left release, right release, differences highlighted. The comparison is structural (field by field on the JSON), not textual.

### Tasks

- [ ] **5.1** Create the `ChainResource` skeleton with pages, schemas extracted to `Schemas/`, and the table/form/infolist.
- [ ] **5.2** Create nested tier and overseer editing (Repeaters on the chain form).
- [ ] **5.3** Create milestone, achievement, and smite upgrade RelationManagers.
- [ ] **5.4** Write `PublishChain` as a service Action (§4). Write the Filament `PublishChainAction` that delegates to it (§9.3).
- [ ] **5.5** Write chain validation logic as a service Action `ValidateChain`. Called by `PublishChain` and available as its own Filament Action for "check this draft without publishing."
- [ ] **5.6** Write `RunHarnessAction`: it runs the PHP conformance suite against the current draft's chain data and reports results. This is the "run the harness against this draft" button.
- [ ] **5.7** Create the `ReleaseResource` (read-only).
- [ ] **5.8** Create the release diff page.
- [ ] **5.9** Write access-control tests for every resource page (§14.2). One operator, so every test is one line.
- [ ] **5.10** Write feature tests for the publish flow: draft validates, publishes, creates a release, writes the JSON. A chain that fails validation does not publish.

**Done check:** `composer check` passes. A chain can be authored, validated, published, and diffed. The harness runs against a draft.

**Three night rows.** 5.1-5.3 are one. 5.4-5.6 are one. 5.7-5.10 are one.

---

## 6. Milestone 5 — the save inspector

**Where:** `dread-majesty-backstage`, a page in the Filament panel.

**What:** Paste the Ledger's exported save text (base64-encoded JSON). The inspector decodes it against `save.ts`'s shape, shows the game state, which release it was made under, and what `catchUp` would do to it.

### Runs the PHP reconciler, not a Node sidecar

The whole point of milestones 2 and 3 is that the PHP port can replay the engine. A Node sidecar would mean the backstage cannot function without Node installed, would add a second runtime to deploy, and would leave the PHP Decimal untested on real saves. The inspector uses the PHP `Decimal` and the PHP step loop to compute what `catchUp` would produce, which is also the conformance test for the PHP port against real player data.

### Tasks

- [ ] **6.1** Write `Services/Save/Actions/DecodeSave`: takes the base64 string, decodes, validates against the `SaveBlob` shape (matching `save.ts`'s `isSaveBlob`), returns a typed DTO with the parsed state.
- [ ] **6.2** Write `Services/Save/Actions/InspectSave`: takes the decoded state, identifies which release's chain version it was saved under, computes `catchUp` for the time since `savedAtMs`, returns an inspection report DTO.
- [ ] **6.3** Create a custom Filament page `InspectSavePage` with a textarea for pasting, a decode button, and a results panel showing: save version, chain version, all resource counts, all generator states (owned, purchased, lifetime produced), souls, lifetime Evil, stats, and the `catchUp` projection.
- [ ] **6.4** Test: a known save blob (exported from the harness at a known state) decodes correctly and `catchUp` matches the TypeScript engine's output for the same input.

**Done check:** Paste a save, see the state, see which release made it, see what catch-up would do.

**One night row.**

---

## 7. Milestone 6 — publishing: the client fetches a chain

**Where:** Changes in both repos. The backstage writes a file; the client reads it.

**What:** The client ships a baked `CURRENT` in its bundle (it already does). It also fetches a chain from a configured URL on startup. If the fetch succeeds and the chain version is newer, it uses the fetched chain. If the fetch fails or the version is not newer, it uses `CURRENT`. The game keeps working with no account and no network, permanently.

### What the web app changes (additive only)

1. **A `chainUrl` config value** in the web app, defaulting to `null` (no fetch, use `CURRENT`). Set via an environment variable at build time.
2. **A fetch-on-startup path** in `App.tsx` or a new `useChain` hook: if `chainUrl` is set, fetch the JSON, validate it against `Content`'s shape (the same validation the backstage runs before publishing), and if valid and newer than `CURRENT.version`, use it. If the fetch fails, times out (3s), or returns an older or invalid chain, fall back to `CURRENT` silently.
3. **No new dependency.** `fetch` is the platform.
4. **No account, no auth, no token.** The JSON is a static file served from wherever the backstage writes it (Netlify, S3, a CDN, a Laravel route). The client asks for it with a plain GET.
5. **The engine contract does not change.** `catchUp`, `step`, and every selector still take `Content` as a parameter. The only change is where the `Content` value comes from at the top level.

### Tasks

- [ ] **7.1** In the backstage: `PublishChain` writes the chain JSON to a configurable output (a local path or an S3 bucket, switchable by env).
- [ ] **7.2** In the web app: add `VITE_CHAIN_URL` env var, a `fetchChain` utility that fetches and validates, and a `useChain` hook or top-level effect that provides the active `Content`. Fall back to `CURRENT` on any failure.
- [ ] **7.3** Test in the web app: mock `fetch` to return a valid newer chain — the app uses it. Mock `fetch` to fail — the app uses `CURRENT`. Mock `fetch` to return an older version — the app uses `CURRENT`.
- [ ] **7.4** Test in the backstage: `PublishChain` writes a file that the web app's validator accepts.

**Done check:** With `VITE_CHAIN_URL` unset, the game works exactly as today. With it set and a valid chain at the URL, the game uses it. With it set and the URL down, the game uses `CURRENT`.

**One night row.**

---

## 8. Milestone 7 — commands

**Where:** `dread-majesty-backstage`.

### Scheduled: conformance run against the published release

`app/Console/Commands/RunConformanceCommand.php`, signature `conformance:run`. Reads the published release's chain JSON, runs the PHP conformance suite against it, logs the result. Scheduled daily via Laravel's scheduler. This is the §15 scheduled-versus-one-shot split, and the scheduled half.

### One-shot: import v1 from TypeScript

`app/Console/Commands/Script/ImportV1Command.php`, signature `script:import-v1`. Reads the v1 content from a provided JSON file (the vectors file or a standalone export of `CURRENT`), creates a Chain with all its tiers, overseers, milestones, achievements, and smite data. Run once after initial setup. This is the §15 one-shot half.

### Tasks

- [ ] **8.1** Write `RunConformanceCommand`. It loads the current published release's chain JSON, instantiates the PHP Decimal-based step loop with the chain data, runs every conformance vector, and reports pass/fail. Register it in the scheduler.
- [ ] **8.2** Write `ImportV1Command`. It reads a JSON file argument, parses it as `Content`, creates the Chain and all related models. Idempotent: if a chain with that version already exists, it skips.
- [ ] **8.3** Test both commands: the conformance run passes against a known-good release; the import creates the expected model graph.

**Done check:** `php artisan conformance:run` passes. `php artisan script:import-v1 vectors/v1.json` creates a chain. `composer check` passes.

**One night row.**

---

## Milestone summary

| # | What | Repo | Night rows | Depends on |
|---|------|------|-----------|------------|
| 1 | Conformance vectors | dread-majesty | 1 | nothing |
| 2 | PHP Decimal with log10/pow10 | backstage | 2 | M1 (reads vectors) |
| 3 | Models and casts | backstage | 1 | M2 (uses Decimal) |
| 4 | Filament backstage | backstage | 3 | M3 |
| 5 | Save inspector | backstage | 1 | M2, M3 |
| 6 | Client chain fetch | both | 1 | M4 (needs publish) |
| 7 | Commands | backstage | 1 | M2, M3, M4 |
| **Total** | | | **10** | |

M5 can run in parallel with M4 once M3 is done. M7 can run in parallel with M6 once M4 is done.

Critical path: M1 → M2 → M3 → M4 → M6. Ten rows, eight on the critical path.

---

## What this plan does not include

- A leaderboard, accounts, or player sync. His 14 September word and The Third Hour both rule these out.
- Any change to the TypeScript engine's behavior. The engine stays pure, client-authoritative, and unchanged.
- Deployment configuration. Where the backstage runs (Forge, Vapor, a VPS) is a decision this plan does not make.
- A player-facing API beyond the static chain JSON. The client fetches one file. There is no session, no token, no endpoint.
