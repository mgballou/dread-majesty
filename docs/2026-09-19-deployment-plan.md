# Dread Majesty deployment plan

Status: design only. No host, project, database, domain, account, or deployment
workflow is created by this document.

## Evidence order

This plan was written in two passes:

1. **Wiki first.** The Dread Majesty project page says the player-facing game is
   already a static Netlify build, feature-frozen, and that the new Laravel app
   is an operator backstage for authoring and publishing chain data. The
   `suivre` page identifies Laravel 13, Filament 5, Postgres, Inertia/React and
   Railway as the house deployment shape. The hostile-read page says the
   deployment finding for the old game is closed; this plan is for the new
   backstage, not for reopening the game launch.
2. **Raw sources.** The settled operator plan, the existing deployment note,
   `netlify.toml`, the backstage scaffold, `suivre/docs/deployment.md`, and
   `suivre/.github/workflows/{tests,lint,deploy}.yml` were then read directly.
   The raw sources confirm that the front end is Vite output, the backstage is
   Laravel 13/Filament 5 with SQLite only in local development, and `suivre`
   deploys a FrankenPHP image to Railway with CI-gated deployment.

The wiki is an index and can be stale. The raw source is authoritative for the
current repository shape. Where the two disagree, this plan follows the raw
source and calls out the remaining question.

## Decision 1 — the contract comes first

**Decision:** the backstage publishes an immutable, versioned chain JSON file;
the front end fetches that public file at startup and falls back to its baked
`CURRENT` content when the fetch fails, times out, is invalid, or is not newer.
There is no shared database, authenticated API, server-to-server call, or
player account.

**Why:** the backstage authors and validates the chain, while the game only
needs read-only content. A static file is cacheable, observable, replayable and
deploy-independent. The fallback preserves the already-settled property that
the game works with no account and no network.

**What is traded away:** a schema change crosses two repositories and needs two
coordinated changes. That is preferable to hiding a breaking change inside a
shared database or API. The schema must therefore be treated as a versioned
contract: the publisher validates before release, and the client validates
before activation.

**Rejected alternative:** a shared Postgres database. It would make publishing
look immediate, but it couples a public client to operator storage, exposes a
runtime dependency the game does not need, and makes rollback less explicit.

**Rejected alternative:** a live Laravel API. It adds auth, uptime, CORS and
request-versioning concerns for one small immutable document.

### Release sequence

1. An operator edits a draft in Filament.
2. `ValidateChain` checks the graph, numeric fields, ordering and references.
3. `PublishChain` creates an immutable `Release` snapshot and writes
   `chain-v<N>.json` plus a small `current.json` pointer/object.
4. The object is served over HTTPS with a long cache lifetime for the versioned
   file and revalidation for `current.json`.
5. The front end fetches `current.json`, validates the content shape and only
   activates a strictly newer version. Otherwise it keeps `CURRENT`.
6. The operator can roll back by pointing `current.json` at an older immutable
   release; the baked client remains a second rollback boundary.

**Question to settle during implementation:** should the public object live in
S3 or in a dedicated static bucket attached to the chosen host? The answer must
preserve anonymous HTTPS GET, immutable versioned keys, CORS for the game
origin, and a way to publish atomically. It must not turn the front-end deploy
into the publication transaction.

## Decision 2 — where the backstage runs

**Decision:** a separate Railway project, one web service running the
`suivre`-style FrankenPHP image, with managed PostgreSQL. Add a worker only when
the app has a real asynchronous queue workload; the initial author/publish
flow is synchronous and does not justify an always-on second service.

**Why:** this is a private operator surface with one or a few users and no
public player traffic. Railway matches the established Laravel deployment shape
already exercised by `suivre`: Dockerfile-built FrankenPHP, private database
networking, a pre-deploy migration command and GitHub Actions as the CI gate.
The separate project keeps the operator app's credentials, logs and database
apart from the player site.

**What is traded away:** Railway is a hosted dependency and its usage bill is
not a fixed server quote. It is less operational work than maintaining a VPS,
and the existing house pattern reduces resume risk. Measure actual usage after
the first week rather than presenting a fabricated monthly estimate.

**Rejected alternative:** co-locating `/admin` and the game in one Laravel
deployment. It would couple a static client build to PHP, database and
migration health, while adding no capability to the game.

**Rejected alternative:** Forge plus a VPS. Forge is a good Laravel operations
tool, but the operator-only workload does not need a self-managed server when a
working Railway shape already exists. Reconsider it if Railway's usage or
database limits become the measured problem.

**Rejected alternative:** Vapor. Serverless Laravel is a poor fit for an
operator panel with a relational database and long-lived administrative
requests; the platform fee is also disproportionate before AWS costs.

### Backstage runtime shape

- PHP 8.4, Laravel 13, Filament 5, and the existing PHPStan/Pest/Pint checks.
- FrankenPHP/Octane web service built from a committed Dockerfile.
- Managed PostgreSQL on the private network.
- No public registration; Filament authentication protects `/admin`.
- Queue worker deferred until a scheduled conformance run or another job is
  implemented. When it exists, run it as a second Railway service from the
  same image, as `suivre` does.
- Published chain files use object storage or a static public output, not the
  app's writable local disk, so a deploy cannot erase the public release.

## Decision 3 — where the player-facing front end runs

**Decision:** keep the Vite/React front end on Netlify, separately from the
backstage. Its deploy is `pnpm build` with `apps/web/dist` as the publish
directory, matching the committed `netlify.toml`.

**Why:** the product is static HTML, JavaScript and CSS. It has no request-time
PHP, database, session, queue or player account. Netlify already serves it and
provides CDN delivery, deploy previews, HTTPS and atomic static deploys.

**What is traded away:** there are two release surfaces and the chain URL is a
build-time configuration value. That is acceptable because chain publication
is a runtime data release with a baked client fallback, not a reason to rebuild
the game for every operator edit.

**Rejected alternative:** move the game into the Laravel image. It adds a
server runtime and couples the public asset deploy to backstage migrations.

### Front-end configuration

`VITE_CHAIN_URL` is a build-time, non-secret value containing the HTTPS URL of
`current.json`. It is safe to expose in a browser bundle. Do not put database
credentials, object-store write credentials or an operator token in the front
end. With the variable unset, the client must use `CURRENT` exactly as it does
today.

## Decision 4 — database

**Decision:** SQLite remains the local-development and test default; production
uses managed PostgreSQL in Railway.

**Why:** SQLite is already the scaffold's low-friction local default, but a
deployed operator app needs durable storage, backups, concurrent requests and
safe migration behavior. The release snapshots and chain authoring records are
relational data, not a reason for the client to connect to a database.

**What is traded away:** local and production use different database engines,
so the CI matrix must include PostgreSQL. The benefit is that production tests
the production engine, while a contributor can still run the app without
provisioning a server.

**Rejected alternative:** SQLite on a Railway volume. It is simpler to start,
but makes persistence, backups, volume attachment and concurrent writes the
operator's problem. It also makes a second web/worker service unsafe without a
shared filesystem discipline.

### Database rules

- Set `DB_CONNECTION=pgsql` and use Railway's private `DATABASE_URL` mapping.
- Run migrations as the single Railway pre-deploy command:
  `php artisan migrate --force`.
- Never run migrations from the web boot command and never seed production
  accounts from an every-boot script.
- Make migrations additive and deploy-safe: add nullable/new structures first,
  backfill, then remove old structures in a later release.
- Take or verify a database backup before any destructive migration. A rollback
  of application code is not a rollback of schema.
- Keep `Release.chain_snapshot` as the immutable audit record even if the
  normalized authoring rows change later.

## Decision 5 — secrets and migrations

### Backstage secrets

Set these in Railway's encrypted environment configuration, never in Git:

- `APP_KEY`
- `APP_ENV=production`, `APP_DEBUG=false`, and the canonical app URL
- `DATABASE_URL` or the project's explicit PostgreSQL connection variables
- object-store write credentials and bucket/path configuration, if S3 is chosen
- mail/notification credentials only if a future feature actually needs mail
- the initial operator credential through a one-time setup path, then rotate it

The client receives only `VITE_CHAIN_URL`; it receives no secret. GitHub Actions
gets one narrowly scoped deployment secret for Railway, following `suivre`'s
`RAILWAY_TOKEN` pattern. It must be an environment/repository secret, not a
committed variable or command-line literal.

### Migration and deploy order

1. Merge the backstage change only after `composer check` and the production
   build pass.
2. CI deploys the exact tested commit, not the moving branch tip.
3. Railway runs the additive migration pre-deploy while the old image remains
   available.
4. Railway switches traffic to the new web image only after the migration
   command succeeds.
5. Smoke-check `/admin` health/auth and a read of the current published chain.
6. Publish a chain only after the new schema and publisher tests pass.

**Question to settle before the first production migration:** what backup and
restore target is available on the chosen Railway Postgres plan, and what is
the manual restore command? Record the answer beside the migration runbook;
the plan cannot infer a recovery guarantee from the platform name.

## Decision 6 — CI at merge

Each repository keeps its own gate, with one explicit cross-repository contract
fixture.

### Front-end repository

On pull requests and pushes to `main`:

- install the pinned pnpm/Node toolchain;
- run `pnpm check` (typecheck, lint/format and Vitest);
- run `pnpm build`;
- run the chain contract tests against a checked-in representative published
  JSON fixture, including valid-newer, invalid, older and fetch-failure fallback
  cases;
- pin GitHub Actions to commit SHAs, set `permissions: contents: read`, use
  `persist-credentials: false`, and cancel superseded check runs.

After a green merge to `main`, Netlify deploys the tested commit. The deploy
must not be responsible for publishing a new chain; it only ships the client
and its configured `VITE_CHAIN_URL`.

### Backstage repository

On pull requests and pushes to `main`:

- run Pint check;
- run PHPStan level 9;
- run Pest against PostgreSQL in CI, not only SQLite;
- build the production Docker image and run its health/auth smoke check;
- validate a published chain fixture with the same schema rules used by the
  publisher;
- run the PHP conformance suite against the committed TypeScript vectors;
- use the same action pinning, read-only permissions, credential persistence
  and concurrency rules as `suivre`.

After the tests workflow succeeds on a push to `main`, a separate deploy
workflow should deploy the exact workflow SHA to Railway. It should classify
changed paths inside the workflow (because `workflow_run` has no useful path
filter), skip docs-only changes, and fail closed to deploying when the changed
path cannot be classified. Keep deploy concurrency non-cancelling once a
deployment has started.

### Cross-repository contract handoff

The engine repository remains the source of the conformance vectors. When the
content schema changes:

1. engine emits a new versioned vector/fixture;
2. backstage updates its fixture and its PHP validator/conformance tests;
3. front end updates its fixture and client validator tests;
4. both repositories merge their green checks before the new publisher output
   is made current.

This is a deliberate release checklist, not an implicit package dependency.

## Cost envelope read on 19 September 2026

These are published plan prices, not a forecast of actual usage:

| Surface | Published price read | What it means here |
|---|---:|---|
| Netlify Free | $0/month, 300 credits/month | Keep the existing static front end here while usage fits the published limit. |
| Railway Hobby | $5/month minimum, including $5 usage; overage is usage-based | Start the private backstage here; measure the real bill after a week. |
| Railway Pro | $20/month minimum, including $20 usage | Upgrade only if production limits/support require it. |
| Forge Hobby | $12/month, plus the VPS/cloud bill | Rejected for now because it adds a server to manage. |
| Vapor Unlimited Monthly | $39/month, plus AWS costs | Rejected for now because it adds a platform fee and serverless/database complexity. |
| S3 Standard | usage-based; AWS says storage, requests and transfer are separate | Suitable for the tiny public chain objects, but do not call it $0 without a region/request estimate. |

Sources: [Netlify pricing](https://www.netlify.com/pricing/), [Railway
pricing](https://docs.railway.com/pricing), [Forge pricing](https://marketing.forge.laravel.com/pricing),
[Vapor pricing](https://vapor.laravel.com/), and [S3 pricing](https://aws.amazon.com/s3/pricing/),
all read 19 September 2026.

The important cost question is not whether the operator panel has public
traffic; it is whether Railway's always-on web service and managed Postgres
remain within the Hobby included usage. Measure that after seven days, then
record the observed invoice before choosing Pro, Forge or another host.

## Implementation checklist

- [ ] Add a Dockerfile and Railway service configuration to the backstage repo,
      copying the proven `suivre` FrankenPHP shape without copying its app data.
- [ ] Add Postgres CI and the `composer check`/build gates.
- [ ] Implement `PublishChain` with immutable versioned output and an atomic
      current pointer.
- [ ] Implement the client fetch/validate/fallback path behind `VITE_CHAIN_URL`.
- [ ] Add contract fixtures and tests in both repositories.
- [ ] Choose and document the object-storage answer, CORS policy, cache headers,
      backup target and restore procedure before production setup.
- [ ] Create hosting accounts/projects and deployment workflows only in a later
      execution task; this document intentionally does not do so.
