# Deployment and the log10/pow10 Agreement

Written 18 September 2026, after landing conformance vectors (Milestone 1).
Answers the four deployment questions raised 17 September and documents the
arithmetic agreement the PHP port must satisfy.

---

## The log10/pow10 agreement

break_eternity.js calls `Math.log10()` and `Math.pow(10, x)` directly — it
does not carry its own implementations. V8 provides both, using polynomial
approximations in `src/base/ieee754.cc`. PHP's `log10()` and `pow(10, x)`
call the platform `libm`, which uses different polynomials.

Measured on this machine over 20,000 samples (plan §3):

- `log10(x)`: 3.21% of calls disagree, worst case 2 ULP
- `pow(10, x)`: 9.39% disagree, worst case 1 ULP

### What triggers log10 and pow10

break_eternity stores values below `9e15` as plain doubles (layer 0). Above
that threshold it stores `log10(value)` (layer 1). Four operations call
`Math.log10` or `Math.pow(10, x)`:

1. **Normalization.** When a layer-0 magnitude reaches `9e15`, the library
   calls `Math.log10(mag)` and increments the layer. When a layer-1 magnitude
   drops below `log10(9e15) ≈ 15.954`, it calls `Math.pow(10, mag)` and
   decrements.

2. **Layer-1 addition.** Adding two layer-1 values converts one operand back
   to linear space with `Math.pow(10, diff)`, adds, then converts back with
   `Math.log10(sum)`.

3. **Layer-1 multiplication.** Uses `Math.log10(b.mag)` to combine exponents
   at layer 1.

4. **String construction.** Parsing a mantissa-exponent string into a Decimal
   calls `Math.log10(mantissa)`.

### The agreement

| Requirement | Detail |
|---|---|
| **Which function** | `log10(x: float): float` for positive x; `pow10(x: float): float` meaning `10^x` |
| **Source to transliterate** | V8's `chromium/v8/src/base/ieee754.cc`, the `log10` and `pow` functions |
| **Match target** | Bit-identical output on identical double inputs — not "close," identical |
| **Inputs to log10** | Positive IEEE-754 doubles, typically from 1 up to `9e15` (during normalization) or the magnitude of a layer-1 value (up to `9e15`) |
| **Inputs to pow10** | IEEE-754 doubles, typically from ~`-324` to ~`15.954` (layer down) or larger during arithmetic |
| **Tolerance for the port** | The conformance vectors use `1e-11` relative error, four orders of magnitude below the harness's sensitivity; this is the ceiling, not a target |
| **What pins it** | Vectors 5 (layer-1-onset), 6 (deep-log-space), 9 (edge-toleranced), and 10 (intermediate-log-space) — every toleranced vector exercises log10/pow10 paths |

### The integer-power lookup table

break_eternity has a separate `powerOf10(n)` lookup table for integer
exponents from −323 to 308, built from `Number("1e" + i)`. PHP can replicate
this table with the same string-to-float parse. This table is used for
formatting, not for the core arithmetic that the conformance vectors test.

### What PHP must carry

1. A `DecimalLog::log10(float $x): float` that runs V8's polynomial, not
   `\log10($x)`.
2. A `DecimalLog::pow10(float $x): float` that runs V8's polynomial, not
   `10 ** $x` or `\pow(10, $x)`.
3. The integer lookup table, which PHP builds the same way: `(float)"1e{$i}"`.

### What PHP need not carry

- Its own `sin`, `cos`, `exp`, or `ln` — break_eternity's core path never
  calls these.
- A custom `floor`, `ceil`, or `round` — IEEE-754 rounding is identical across
  runtimes for the operations break_eternity uses.

---

## 1. Can the Laravel app and the TypeScript front end deploy together?

**Recommendation: no. Deploy them separately.**

### What each one needs at runtime

| | Front end (Dread Majesty) | Backstage (operator) |
|---|---|---|
| Runtime | None — static HTML, JS, CSS | PHP 8.4, FrankenPHP or Octane |
| Database | None | PostgreSQL |
| Queue | None | Database-backed (Laravel) |
| Storage | CDN | Local or S3 |
| Auth | None — no player accounts | Single operator, Laravel auth |
| Build | `pnpm build` → static `dist/` | `composer install`, `npm run build` (Filament assets), `php artisan migrate` |

The front end is a static site on Netlify today. It needs no PHP, no database,
no server process. The backstage is a Laravel app that needs PHP, PostgreSQL,
and a migration step on every deploy.

A single host could serve both — FrankenPHP serves static files, or a reverse
proxy splits `/admin` from `/`. But the front end gains nothing: it is already
deployed, already cached by Netlify's CDN, and adding PHP to its deploy path
adds a runtime dependency and a failure mode it does not have. The backstage
gains nothing either: it does not serve the game, does not need the game's
assets, and coupling its deploy to the game's deploy means a balance tweak
blocks on a front-end build (or vice versa).

**Cost of separation:** two deploy pipelines instead of one. The backstage
needs its own Railway project. The connection between them is a JSON file
(the published chain), not a shared process.

**Cost of co-location:** a new runtime dependency for the front end (PHP),
a coupled deploy cycle, and a host that must serve both static assets at CDN
speed and PHP responses.

### What suivre shows

suivre deploys to Railway with FrankenPHP, a Dockerfile, and two services
(web and worker). Its deploy workflow runs `railway up` after tests pass.
The backstage can copy this pattern wholesale — same Dockerfile structure,
same pre-deploy migration, same two-service split. The front end stays on
Netlify.

---

## 2. Does this become a monorepo?

**Recommendation: no. The backstage plan's argument (§1) holds.**

The argument: pnpm does not manage Composer, PHP, a database, or `vendor/`.
A Laravel app inside the workspace is a foreign body that `pnpm check` cannot
see. The workspace's `packages/*` and `apps/*` convention assumes TypeScript;
a PHP app breaks that assumption.

The question asked whether a private remote and shared CI change the reasoning.
They do not. A private remote is a separate repository on GitHub with
restricted visibility — it is the *repo*, not the workspace. Shared CI means
both repos' workflows can reference the same conformance vectors; it does not
mean they must live in the same tree.

What a monorepo would buy:

- One `git clone` instead of two.
- Atomic commits across both the chain definition and the operator.

What it would cost:

- `pnpm check` can never cover the PHP half. A separate `composer check` must
  run alongside it, with its own CI job. The workspace's single-command
  guarantee — `pnpm check` catches everything — breaks.
- `pnpm install` does not install PHP dependencies. A developer must run both
  `pnpm install` and `composer install`. If either is stale, the monorepo's
  integrity depends on a convention, not on a tool.
- Turborepo or Nx could orchestrate both, but neither is in the project today
  and neither understands Composer. Adding one to manage two packages in two
  languages is more complexity than the problem warrants.
- The Dockerfile for the backstage would need to ignore the TypeScript half
  of the tree, or carry Node in the image for no runtime reason.

The crossing between the two repos is one JSON file: `v1.json`, the
conformance vectors. The engine emits them. The PHP port reads them as a test
fixture. That crossing is already mediated by a file, not an import. Putting
both repos in one tree does not make the crossing cheaper — it is already as
cheap as it gets.

---

## 3. How do the two connect?

**The plan's answer holds: one JSON file, no import between them.**

The backstage publishes a chain by writing a JSON file (the `Release`
snapshot) to a configured output — a local path, an S3 bucket, or a route
that serves a static response. The front end fetches that file on startup
(Milestone 6, §7 of the plan). If the fetch succeeds and the version is
newer than the baked `CURRENT`, the game uses it. If not, `CURRENT` serves.

This is the same architecture with deployment made real:

1. The backstage writes `chain-v{N}.json` to an S3 bucket (or Netlify's asset
   hosting, or a Railway volume — the medium does not matter as long as it
   serves a static file over HTTPS).
2. The front end has a `VITE_CHAIN_URL` build variable pointing at the file.
   On startup it fetches the URL. On failure it falls back to `CURRENT`.
3. No server-to-server call. No shared database. No API. No auth token. The
   chain JSON is a public, cacheable, static file.

### The schema agreement

The two repos share a schema: the shape of the `Content` type, serialized as
JSON. The backstage validates a chain against that shape before publishing.
The front end validates the fetched JSON against the same shape before using
it. Neither repo imports the other's code. Both carry their own validator.

Changes to the schema require updates in both repos. This is deliberate: a
schema change is a breaking change, and it should look like one — two PRs,
not a silent internal refactor.

### What about the conformance vectors?

The vectors live in the engine repo (`packages/engine/conformance/vectors/`).
The backstage repo copies `v1.json` as a test fixture. When the engine emits
a new version, the backstage repo updates its copy. This is a manual step —
a GitHub release asset, a curl in CI, or a developer copying the file. It
happens rarely (when the engine changes its arithmetic) and must be
deliberate (the PHP port should not silently adopt a new vector set without
running its tests against it).

---

## 4. What does this cost to run?

### The front end (today)

Netlify free tier. Static site, no build minutes pressure at this scale. Cost:
**$0/month.**

### The backstage (new)

Railway, matching suivre's pattern:

| Resource | What | Estimated cost |
|---|---|---|
| Web service | FrankenPHP, 0.5 vCPU, 512 MB | ~$5/month |
| Worker service | Queue worker, same spec | ~$3/month (idle most of the time) |
| PostgreSQL | Managed, 1 GB | ~$5/month |
| Total | | **~$13/month** |

Railway bills by usage (CPU-seconds and memory-seconds), not by reserved
capacity. The backstage is a single-user admin panel; traffic is negligible.
The worker runs the conformance suite daily and sits idle otherwise. The
database stores a chain definition (a few hundred rows) and releases (a few
JSON snapshots).

For comparison, the Hobby plan on Railway gives $5/month in credits and
charges usage above that. The Pro plan is $20/month with more generous
included usage. At this scale the Hobby plan is likely sufficient, with
occasional overage on months when the conformance suite runs often.

### Alternatives

| Platform | Estimated cost | Notes |
|---|---|---|
| Railway Hobby | ~$8–13/month | Matches suivre; copy the Dockerfile |
| Fly.io | ~$5–10/month | Cheaper at idle; no Postgres included on free tier |
| A $5 VPS (Hetzner, DigitalOcean) | $5/month flat | Cheapest, but self-managed: backups, updates, SSL |
| Laravel Forge + a VPS | VPS cost + $12/month (Solo) | Managed deploys, but the management fee exceeds the server fee |
| Laravel Vapor (AWS Lambda) | ~$0.50–2/month at this scale | Cheapest per-request, but Lambda cold starts and DynamoDB sessions add operational complexity |

**Recommendation: Railway, matching suivre.** The Dockerfile, the deploy
workflow, and the operational patterns are already proven. The cost is a
lunch.

### The chain JSON

The published chain JSON can live:

- On S3 ($0.02/month for one file)
- On Netlify (free, alongside the front end's static assets)
- On Railway (served by the backstage as a static route)

The cheapest option is Netlify, because the front end already deploys there
and a static file in its `public/` directory costs nothing. The backstage
writes the file; a CI step or a webhook copies it to the front end's deploy.

---

## What blocks Milestone 2

One thing: the backstage repository does not exist yet. Creating it as a
private GitHub repo, scaffolding the Laravel app, and wiring up CI is the
first task of Milestone 2. Everything else — the PHP Decimal, the log10/pow10
port, the conformance test — depends on having a repo to put it in.
