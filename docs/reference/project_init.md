# Project Init: Dark Lord Idle

## 1. Project Purpose

Dark Lord Idle is a browser-based incremental/idle game where the player grows from an aspiring dark lord into the ruler of a cascading evil empire. The game must support offline progress, cross-device synchronization, server-authoritative calculations, and future mobile expansion.

This document is the canonical startup guide for the project. It combines the game design, technical architecture, implementation priorities, and early project-management structure needed for a new agent or developer to scaffold the app and begin development.

## 2. Product Summary

The player accumulates **Evil**, the primary currency, by owning and expanding resource generators. Generators form a production chain where higher-tier generators produce lower-tier generators, and lower-tier generators produce resources.

Initial production chain:

```text
Fortresses -> Dark Legions -> Slums -> Minions -> Evil
```

The game is idle-first: players should make meaningful progress while offline. Offline progress must be simulated as a sequence of discrete production events so that newly produced generators affect later cycles within the same offline period.

## 3. Core Goals

- Build a server-authoritative incremental game.
- Support accurate offline progress calculation.
- Allow future cross-device play with one shared player state.
- Prevent common client-side cheating and save tampering.
- Keep game logic maintainable as new generator tiers, upgrades, achievements, and prestige systems are added.
- Minimize future code duplication between web and mobile clients.

## 4. Non-Goals For Initial MVP

- Native mobile app.
- Full prestige/reset system.
- Final game balance for late-game tiers.
- Rich animated rendering or Phaser-based scene work.
- Complex guild/social systems.
- Player trading or multiplayer economy.

These can be added later after the core simulator and server-authoritative loop are reliable.

## 5. Architecture Decision

Use a **backend-centric architecture**.

The backend owns game state, production calculations, purchases, timestamps, validation, and persistence. The client renders the current state, sends player intent, and may use optimistic UI for responsiveness, but the server remains the source of truth.

### Why Backend-Centric

- **Cheat prevention:** The server validates all actions and resource changes.
- **Consistency:** Web and future mobile clients consume the same authoritative game logic.
- **Maintainability:** Economy balancing and bug fixes happen in one place.
- **Cross-device sync:** A player account maps to one canonical game state.
- **Offline integrity:** Time elapsed is calculated from server timestamps, not client-submitted time.

## 6. Recommended Tech Stack

### Backend

- **Framework:** Laravel API.
- **Auth:** Laravel Sanctum.
- **Admin interface:** Filament.
- **Database:** PostgreSQL.
- **Caching:** Redis for active player state and hot reads.
- **Realtime:** Laravel Echo / Pusher or another Laravel-compatible WebSocket layer.
- **Queueing:** Laravel queues for analytics/logging or later background tasks.
- **Auditing:** `owen-it/laravel-auditing` for model-level audit trails, especially game configuration changes and sensitive player-state mutations.

### Laravel Backend Packages And Tooling

- **Admin:** Filament for the internal admin/control plane.
- **Auditing:** `owen-it/laravel-auditing`.
- **Authorization:** Laravel policies first; consider `spatie/laravel-permission` if admin roles grow beyond a single owner/admin role.
- **Data objects:** Consider `spatie/laravel-data` for typed request/response/config DTOs once contracts stabilize.
- **Math:** Prefer PHP integer/string math or a decimal-safe package such as `brick/math` for large economy calculations. Avoid floats for resource values.
- **Testing:** Pest or PHPUnit are both acceptable; choose one early and use Laravel feature tests heavily.
- **Code style:** Laravel Pint.

### Web Frontend

- **Framework:** React with TypeScript.
- **Build tool:** Prefer Vite for a focused SPA MVP, or Next.js if server-rendered pages/auth flows are desired.
- **State management:** Zustand.
- **Server state/sync:** TanStack Query.
- **Realtime client:** Compatible WebSocket client for the backend choice.
- **Styling:** Tailwind CSS.
- **Rendering:** Plain React/CSS for MVP. Phaser can be introduced later if the game needs animated scenes.

### Future Mobile

- **Framework:** React Native or Expo.
- **Shared code approach:** Monorepo with shared TypeScript packages for API types, constants, and client-safe helpers.

### Important Libraries

- `decimal.js` for precise resource calculations where values may exceed safe integer or decimal limits.
- `immer` for immutable state updates on the client if useful.
- `uuid` for identifiers.
- PHP backed enums for server-side domain constants such as resource types, generator types, action types, config types, and audit event categories.

## 7. Suggested Repository Shape

Use a monorepo so shared types and future client packages can evolve together.

```text
dark-lord-idle/
├── apps/
│   ├── api/                 # Laravel API
│   └── web/                 # React TypeScript web client
├── packages/
│   ├── shared-types/        # TypeScript interfaces and generated API contracts
│   └── game-config/         # Versioned economy/config data, if useful
├── docs/
│   ├── project_init.md
│   └── decisions/
├── package.json
└── README.md
```

If Laravel tooling makes a strict monorepo awkward early on, keep the backend and frontend in sibling app folders and introduce shared packages once contracts stabilize.

## 8. Admin And Configuration Strategy

Use **Filament** as the internal admin interface for managing game configuration and operational visibility.

The admin interface should allow the solo developer/admin to configure and review:

- Generator definitions.
- Base costs.
- Cost scaling rates.
- Production rates.
- Cycle durations.
- Resource relationships, such as `Slums -> Minions`.
- Active/inactive game configuration versions.
- Player state inspection for debugging.
- Progress logs and suspicious action logs.
- Audit history for configuration changes.

Expected Filament resources:

- `GameConfigurationResource` for versioned economy/generator configuration.
- `PlayerGameStateResource` for read-mostly player state inspection and limited corrective actions.
- `PlayerProgressLogResource` for filtering/debugging resource changes and suspicious behavior.
- Audit views exposed through the auditing package or a custom Filament page/resource.

Game balance values should not be hardcoded once the MVP scaffolding is in place. The first version can seed Minion and Slum values from migrations or seeders, but the architecture should move toward versioned, database-backed configuration edited through Filament.

Configuration changes must be audited. A future production workflow should require publishing a new configuration version rather than mutating live balance values invisibly. This keeps player behavior explainable and makes balance regressions easier to diagnose.

## 9. Game Domain Model

### Resources

- **Evil:** Primary currency used to buy early generators.
- **Dark Artifacts:** Premium or rare currency. Included in the model now, but not required for the first playable MVP.

### Generators

Generators produce either a resource or a lower-tier generator.

| Generator | Produces | Production Rate | Cycle Duration | Base Cost | Cost Scaling |
| --- | --- | ---: | ---: | ---: | ---: |
| Minions | Evil | 15 Evil per minion per cycle | 24 seconds | 90 Evil | 1.089x per owned |
| Slums | Minions | 100 Minions per slum per cycle | 60 seconds | 1500 Evil | 1.089x per owned |
| Dark Legions | Slums | TBD | TBD | TBD | 1.089x per owned |
| Fortresses | Dark Legions | TBD | TBD | TBD | 1.089x per owned |

Cost formula:

```text
next_cost = floor(base_cost * (1.089 ^ current_count))
```

For bulk purchases, calculate cumulative cost by summing each next purchase cost, unless a closed-form implementation is introduced and tested against the iterative formula.

## 10. Critical Simulation Requirement

Production must be simulated as **discrete chronological events**, not as a single aggregate formula.

This is essential because produced generators can affect later production cycles during the same active or offline interval.

Example: a player is offline for 120 seconds with 1 slum and 5 minions.

```text
t=24s:  5 minions produce 75 Evil
t=48s:  5 minions produce 75 Evil
t=60s:  1 slum produces 100 Minions; player now has 105 Minions
t=72s:  105 minions produce 1,575 Evil
t=96s:  105 minions produce 1,575 Evil
t=120s: 105 minions produce 1,575 Evil, and 1 slum produces 100 Minions
```

The simulator must process events in chronological order and apply state changes before later events are evaluated.

### Event Shape

Each production cycle should be representable as an event:

```ts
interface ProductionEvent {
  logicalTimestamp: number;
  elapsedSeconds: number;
  generatorType: 'minion' | 'slum' | 'dark_legion' | 'fortress';
  generatorCount: string;
  producedResource: 'evil' | 'minion' | 'slum' | 'dark_legion';
  producedAmount: string;
}
```

Use strings for large values and decimal-safe arithmetic where needed.

### Event Ordering

When multiple generator types complete at the same elapsed second, the simulator needs deterministic ordering. Recommended ordering:

1. Process higher-tier generators first.
2. Then process lower-tier generators.

This means if slums and minions both complete at `t=120s`, slums add minions before minion production at that same timestamp. If a different rule is chosen for balance reasons, document it and lock it with tests.

## 11. Offline Progress Flow

When a player returns after being offline:

1. Server loads the authoritative player state.
2. Server calculates elapsed time from `last_progressed_at` or `last_login_timestamp` to the current server time.
3. Server runs the event-based production simulator across that elapsed interval.
4. Server applies all generated production events in order.
5. Server persists the updated state in a transaction.
6. Server updates the last-progress timestamp.
7. Server returns an offline progress summary and the new authoritative state.

The client must never submit elapsed time or resource totals as trusted values.

## 12. Active Gameplay Flow

### Initial Load

1. Client authenticates.
2. Client requests current player state.
3. Server applies any pending offline progress before returning state.
4. Client renders the authoritative state.

### Player Action

1. Client sends an intent, such as `purchase_generator`.
2. Server validates current state, cost, cooldowns, and rate limits.
3. Server applies the action in a database transaction.
4. Server returns or broadcasts the new authoritative state.
5. Client reconciles local UI with server state.

### Realtime Updates

Realtime updates are useful but not required for the earliest MVP. Polling or explicit sync can work first. Add WebSockets after the state model and simulator are stable.

## 13. Client Offline Behavior

For the MVP, offline gameplay should be server-calculated when the player reconnects. The client may cache the last known state for display, but it should clearly treat it as stale until sync completes.

Later client behavior:

- Cache last known good state in `localStorage` or IndexedDB.
- Queue player intents while disconnected.
- Apply optimistic local updates for responsiveness.
- Sync queued intents when the connection returns.
- Accept server reconciliation as authoritative.
- Roll back or explain rejected actions.

Queued offline actions are higher-risk than passive offline production. Implement passive production first, then add offline action queues only after validation and reconciliation are solid.

## 14. Data Model

Use Laravel migrations, Eloquent models, casts, policies, factories, seeders, and Filament resources as the primary backend building blocks. Avoid raw SQL-first planning unless a specific PostgreSQL feature requires it.

The early project can choose between a normalized table layout and a JSON/JSONB state layout. The recommendation is a hybrid:

- Keep identity/auth in normal Laravel tables.
- Keep player state in a dedicated game-state table with explicit frequently queried fields plus JSONB for extensibility.
- Keep economy configuration versioned and data-driven.
- Keep audit/progress logs append-only.
- Represent domain strings with PHP backed enums and Eloquent enum casts.

### Users

Laravel will own the standard user fields. Additional game-specific columns can be avoided on `users` to keep auth separate from game state.

### Player Game States

Minimum fields:

```php
Schema::create('player_game_states', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('game_version', 50);
    $table->decimal('evil_currency', 40, 0)->default(0);
    $table->unsignedBigInteger('dark_artifacts')->default(0);
    $table->decimal('minion_count', 40, 0)->default(0);
    $table->decimal('slum_count', 40, 0)->default(0);
    $table->decimal('dark_legion_count', 40, 0)->default(0);
    $table->decimal('fortress_count', 40, 0)->default(0);
    $table->jsonb('state_data');
    $table->timestamp('last_progressed_at');
    $table->timestamps();

    $table->unique(['user_id', 'game_version']);
    $table->index(['user_id', 'updated_at']);
});
```

Notes:

- Use `NUMERIC` or string-backed decimal handling for resources/generator counts that can grow beyond integer limits.
- `state_data` can hold achievements, upgrades, statistics, feature flags, and future mechanics.
- Initialize `state_data` through factories, seeders, or the player-state creation service rather than relying on cross-database JSON defaults.
- If the game later needs multiple save slots or seasons, add explicit identifiers rather than overloading `game_version`.
- The Eloquent model should use `HasUuids`, guarded/fillable fields intentionally, date casts for timestamps, and array/object casts for `state_data`.
- Consider custom casts or value objects for large numeric strings if Laravel decimal casts become awkward for game math.

### Game Configurations

```php
Schema::create('game_configurations', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->string('type', 50);
    $table->string('version', 50);
    $table->string('name');
    $table->boolean('is_active')->default(false);
    $table->jsonb('configuration');
    $table->timestamp('published_at')->nullable();
    $table->timestamps();

    $table->unique(['type', 'version']);
    $table->index(['type', 'is_active']);
});
```

Store generator definitions, costs, cycle durations, production amounts, and economy tuning here once the simulator is data-driven.

Expected Eloquent model shape:

- Model name: `GameConfiguration`.
- Uses `HasUuids`.
- Implements `OwenIt\Auditing\Contracts\Auditable`.
- Uses enum cast for `type`, such as `GameConfigurationType::class`.
- Casts `configuration` to a typed data object if using `spatie/laravel-data`, otherwise to `array`.
- Exposes a query scope such as `activeFor(GameConfigurationType $type)`.
- Publishes through an action class such as `PublishGameConfigurationAction`, not directly from a controller.

Recommended generator configuration shape:

```json
{
  "generators": {
    "minion": {
      "produces": "evil",
      "baseCostResource": "evil",
      "baseCost": "90",
      "costScalingRate": "1.089",
      "productionAmount": "15",
      "cycleDurationSeconds": 24
    },
    "slum": {
      "produces": "minion",
      "baseCostResource": "evil",
      "baseCost": "1500",
      "costScalingRate": "1.089",
      "productionAmount": "100",
      "cycleDurationSeconds": 60
    }
  }
}
```

Filament should manage this data through forms with validation, not raw JSON editing as the primary workflow. Raw JSON can remain available for advanced debugging if carefully permissioned.

### Player Progress Logs

```php
Schema::create('player_progress_logs', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('event_type', 100);
    $table->jsonb('event_details');
    $table->timestamp('occurred_at');
    $table->timestamps();

    $table->index(['user_id', 'occurred_at']);
    $table->index('event_type');
});
```

Use this for debugging, anti-cheat analysis, balance analysis, and audit trails. Do not log every tiny production event forever without retention or aggregation rules.

Expected model shape:

- Model name: `PlayerProgressLog`.
- Uses `HasUuids`.
- Casts `event_type` to `ProgressEventType::class`.
- Casts `event_details` to `array`.
- Uses factories for tests and seed data.

### Laravel Model Relationships

Expected relationships:

```php
// User
public function gameStates(): HasMany;
public function progressLogs(): HasMany;

// PlayerGameState
public function user(): BelongsTo;

// PlayerProgressLog
public function user(): BelongsTo;
```

Filament resources should be built around these Eloquent models rather than separate admin-only abstractions.

## 15. API Surface

Initial REST endpoints:

```text
GET  /api/player-state
POST /api/sync-resources
POST /api/purchase-generator
```

Laravel implementation expectations:

- API routes live in `routes/api.php`.
- Controllers live under `App\Http\Controllers\Api`.
- Input validation uses Form Request classes.
- Output formatting uses Laravel API Resource classes.
- Controllers delegate to action classes and do not contain game math.
- Endpoint tests should use Laravel feature tests and model factories.

### GET /api/player-state

Returns the current authoritative state. The server may first apply pending offline progress.

### POST /api/sync-resources

Calculates and applies passive production since the last progress timestamp. The server uses its own current time.

Response should include:

- New authoritative player state.
- Offline seconds processed.
- Summary of resources and generators produced.
- Optional capped/truncated event preview for UI display.

### POST /api/purchase-generator

Request contains intent only:

```json
{
  "generatorType": "minion",
  "quantity": 1
}
```

Server validates:

- Authenticated user.
- Generator exists in the active config.
- Quantity is allowed.
- Player has enough Evil or required cost resource.
- State row is locked/transactional during the purchase.

Server returns:

- Purchase success/failure.
- New authoritative state.
- Cost paid.
- New generator count.
- Next cost.

## 16. Realtime Event Surface

Realtime can be deferred, but when introduced use server-originated state updates and client-originated intents.

Client to server:

```json
{
  "event": "player_action",
  "data": {
    "action": "purchase_generator",
    "generatorType": "slum",
    "quantity": 1,
    "clientTimestamp": 1234567890
  }
}
```

Server to client:

```json
{
  "event": "state_update",
  "data": {
    "resources": {
      "evil": "1500"
    },
    "generators": {
      "minion": "12",
      "slum": "1"
    }
  }
}
```

Offline progress event:

```json
{
  "event": "offline_progress",
  "data": {
    "offlineSeconds": 3600,
    "resourcesEarned": {
      "evil": "45025"
    },
    "generatorsProduced": {
      "minion": "6000"
    },
    "newState": {}
  }
}
```

## 17. Shared State Shape

Recommended TypeScript representation for the web client and generated/shared contracts:

```ts
interface GameState {
  userId: string;
  version: string;
  lastProgressedAt: string;
  resources: {
    evil: string;
    darkArtifacts: string;
  };
  generators: {
    minion: string;
    slum: string;
    darkLegion: string;
    fortress: string;
  };
  upgrades: Record<string, {
    level: number;
    multiplier: string;
    purchased: boolean;
  }>;
  achievements: string[];
  statistics: {
    totalClicks: number;
    totalResourcesGenerated: string;
    playTimeSeconds: number;
  };
}
```

The backend may use PHP DTOs or Laravel resources, but the external contract should remain explicit and versioned.

## 18. Backend Architectural Patterns

The Laravel backend should use strong domain boundaries from the start. This is a solo project, but the code should still make illegal game states hard to represent.

Recommended backend organization:

```text
app/
├── Actions/
│   └── Game/
├── Data/
│   └── Game/
├── Enums/
├── Filament/
│   └── Resources/
├── Http/
│   ├── Controllers/Api/
│   ├── Requests/
│   └── Resources/
├── Models/
├── Policies/
└── Services/
    └── Game/
```

Recommended patterns:

- Use PHP backed enums for core domain concepts.
- Use typed DTOs or data objects for simulator inputs and outputs.
- Use action/service classes for state transitions.
- Keep controllers thin.
- Use Form Request classes for endpoint validation.
- Use API Resource classes for response shaping.
- Use policies for admin and player-state authorization.
- Keep Eloquent models focused on persistence concerns.
- Keep game math in dedicated services with dense unit coverage.
- Validate admin-edited configuration before it can become active.
- Prefer explicit config versioning over silent mutation of live rules.

Core enums to define early:

```text
ResourceType
GeneratorType
GameActionType
GameConfigurationType
ProgressEventType
AuditEventType
```

Example enum values:

```text
ResourceType: evil, dark_artifact
GeneratorType: minion, slum, dark_legion, fortress
GameActionType: sync_resources, purchase_generator
GameConfigurationType: generator_config, economy_config
```

Enum values should match API/config slugs wherever practical. This reduces translation code and makes Filament forms, API validation, and simulator logic easier to keep aligned.

## 19. Game Engine Responsibilities

Create a focused server-side game engine/service layer. Do not scatter calculations directly across controllers.

Core responsibilities:

- Load active economy configuration.
- Calculate generator purchase costs.
- Validate purchases.
- Simulate production events.
- Apply offline progress.
- Apply active production ticks if needed.
- Return state diffs and summaries.

Possible PHP service classes:

```text
GameStateService
ProductionSimulator
GeneratorCostService
PurchaseGeneratorAction
OfflineProgressAction
GameConfigurationRepository
```

Controllers should stay thin and delegate to services/actions.

State-changing actions should use Laravel transactions and row locks. For example, purchases and offline sync should load the relevant `PlayerGameState` with `lockForUpdate()` inside `DB::transaction()` before applying changes. This prevents two browser tabs or devices from spending the same resources or applying offline progress twice.

## 20. Security And Integrity Principles

- Never trust client-submitted resource values.
- Never trust client-submitted elapsed time.
- Enforce server-side validation for every action.
- Use database transactions for all resource and generator changes.
- Lock the player state row during purchase and sync operations.
- Add rate limits to action endpoints.
- Enforce cooldowns server-side if click/manual actions are added.
- Use state checksums or revision numbers later to detect stale updates.
- Add resource caps or numeric safety checks to prevent overflow behavior.
- Persist audit logs for significant resource changes and suspicious rejects.
- Use `owen-it/laravel-auditing` on game configuration models and selected operational models.
- Capture who changed configuration values, what changed, and when the change became active.
- Treat server state as authoritative during cross-device conflicts.

## 21. Cross-Device Sync Strategy

- Use authenticated `user_id` as the owner of the canonical state.
- Maintain one authoritative state per user and game version.
- Server resolves state before returning it to any device.
- For most fields, server state wins.
- For additive statistics, use explicit merge logic.
- For achievements, use set-union semantics.
- Use a state revision number later if simultaneous multi-device sessions become common.

Initial conflict policy:

```text
Passive production: calculated once by server against last_progressed_at.
Purchases: transactionally applied in arrival order.
Client state: render-only cache, never authoritative.
```

## 22. Performance Requirements

The production simulator must handle multi-hour offline sessions with thousands of cycles. It should be correct first, then optimized.

Optimization considerations:

- Use efficient event scheduling rather than per-second simulation.
- Jump from one cycle completion time to the next.
- Avoid materializing every event for very long offline windows unless needed for debugging/UI.
- Return aggregate summaries to the client and optionally a capped event preview.
- Use Redis for active player state after correctness is proven.
- Batch frequent state updates.
- Index by `user_id` and update timestamps.

## 23. Testing Strategy

### Highest Priority Tests

- Minions produce Evil every 24 seconds.
- Slums produce Minions every 60 seconds.
- Slum-produced Minions affect subsequent Minion production cycles.
- Deterministic behavior when multiple cycles complete at the same timestamp.
- Cost calculation follows `floor(base_cost * 1.089 ^ current_count)`.
- Cost and production calculations use configured values rather than hardcoded constants.
- Enum-backed validation rejects unknown resources, generators, actions, and config types.
- Filament-managed configuration cannot be published when required generator fields are missing or invalid.
- Auditing records game configuration changes.
- Purchase validation rejects insufficient resources.
- Offline progress updates `last_progressed_at`.
- Re-running sync immediately after a sync does not duplicate production.

### Broader Test Categories

- Unit tests for simulator and cost service.
- Integration tests for API endpoints.
- Transaction/concurrency tests for purchase and sync operations.
- Authentication tests.
- Authorization tests for Filament admin access.
- Feature tests for configuration CRUD and publish workflow.
- Model tests for casts, relationships, scopes, and audited fields.
- Factory and seeder tests for bootstrapping a playable state.
- Client state reconciliation tests.
- Offline/reconnect tests.
- Later: WebSocket tests and load tests.

## 24. Early Project Epochs

Use these epochs as the initial project-management structure. The wording can be translated into Linear cycles, GitHub milestones, Jira epics, or another PM tool.

### Epoch 0: Project Foundation

Goal: create the repo, tooling, and development baseline.

Deliverables:

- Initialize repository structure.
- Scaffold Laravel API app.
- Install and configure Filament.
- Install and configure `owen-it/laravel-auditing`.
- Scaffold React TypeScript web app.
- Configure PostgreSQL and Redis for local development.
- Add environment examples.
- Add Laravel Pint and backend test commands.
- Choose and configure Pest or PHPUnit.
- Add basic CI for backend and frontend tests.
- Document local setup in `README.md`.

Suggested tickets:

- Create monorepo/app folder structure.
- Scaffold Laravel API in `apps/api`.
- Add Filament admin panel baseline.
- Add auditing package and baseline config.
- Scaffold React TypeScript web client in `apps/web`.
- Add Docker Compose or documented local services for PostgreSQL and Redis.
- Configure backend test database.
- Add Laravel Pint.
- Configure Pest or PHPUnit with factories and feature-test baseline.
- Configure frontend test runner.
- Add first CI workflow.

### Epoch 1: Core Game Simulation

Goal: prove the production model independently of UI.

Deliverables:

- Enum classes for resources, generators, actions, and configuration types.
- Data-driven generator definitions for Minions and Slums.
- Production simulator that processes discrete chronological events.
- Cost service with scaling formula.
- Unit tests covering compound offline production.

Suggested tickets:

- Define PHP backed enums for game domain constants.
- Define generator config structure.
- Implement `GeneratorCostService`.
- Implement `ProductionSimulator`.
- Add minion-to-evil simulation tests.
- Add slum-to-minion compound simulation tests.
- Add same-timestamp ordering tests.
- Add multi-hour offline simulation performance test.

### Epoch 2: Player State And Persistence

Goal: persist authoritative player state and mutate it safely.

Deliverables:

- Player game state migration/model.
- Game configuration migration/model.
- Progress log migration/model.
- Filament resources for game configuration management.
- Auditing enabled for configuration changes.
- Transactional services for sync and purchase.

Suggested tickets:

- Create `PlayerGameState` migration, model, factory, and policy.
- Create `GameConfiguration` migration, model, factory, policy, and audit config.
- Create `PlayerProgressLog` migration, model, and factory.
- Seed initial generator configuration.
- Build Filament resource for generator/economy configuration.
- Add validation and publish workflow for active game configuration.
- Add audit coverage for configuration edits.
- Implement `GameStateService`.
- Implement offline progress persistence.
- Implement audit/progress logging for sync and purchases.

### Epoch 3: API MVP

Goal: expose authenticated server-authoritative gameplay endpoints.

Deliverables:

- Laravel Sanctum auth.
- `GET /api/player-state`.
- `POST /api/sync-resources`.
- `POST /api/purchase-generator`.
- Integration tests for endpoint behavior.

Suggested tickets:

- Configure Sanctum auth.
- Add player state bootstrap on first login.
- Build player-state endpoint.
- Build sync-resources endpoint.
- Build purchase-generator endpoint.
- Add endpoint validation and rate limits.
- Add API integration tests.

### Epoch 4: Web Playable MVP

Goal: create a simple playable web UI.

Deliverables:

- Authenticated web app shell.
- Display resources and generator counts.
- Purchase buttons for Minions and Slums.
- Manual sync/refresh flow.
- Basic optimistic UI or loading states.
- Server reconciliation through TanStack Query.

Suggested tickets:

- Create web app layout.
- Add API client/auth handling.
- Add player state query.
- Add resource display.
- Add generator purchase controls.
- Add offline progress summary modal/panel.
- Add stale-state/loading/error states.

### Epoch 5: Hardening And Balance

Goal: make the MVP durable enough for repeated testing.

Deliverables:

- Better anti-cheat logging.
- Concurrency handling verified.
- Initial economy balance pass.
- Dark Legions and Fortresses added or explicitly deferred.
- Basic analytics for progression.

Suggested tickets:

- Add suspicious action logging.
- Add transaction/concurrency tests.
- Add resource cap or numeric safety checks.
- Tune Minion and Slum economy.
- Define Dark Legion production values.
- Define Fortress production values.
- Add progress analytics views or export.

### Epoch 6: Realtime And Offline Client Enhancements

Goal: improve responsiveness and cross-session experience.

Deliverables:

- WebSocket state updates.
- Optimistic purchase flow with rollback.
- Local cached state.
- Offline action queue if still desired.

Suggested tickets:

- Configure Laravel broadcasting.
- Add state update event.
- Add frontend WebSocket subscription.
- Add optimistic purchase updates.
- Add server reconciliation handling.
- Add local state cache.
- Evaluate and implement offline intent queue.

### Epoch 7: Extended Game Systems

Goal: add the systems that make the game feel long-lived.

Candidate systems:

- Upgrade tree.
- Achievements.
- Prestige/reset mechanic.
- Dark Artifacts use cases.
- More generator tiers.
- Visual polish and animation.
- Mobile client planning.

## 25. MVP Definition

The first true MVP is complete when:

- A user can create/log into an account.
- The server creates and stores their game state.
- The player can view Evil, Minions, and Slums.
- The player can buy Minions and Slums if they can afford them.
- Costs scale using the agreed formula.
- The server calculates passive production.
- Offline progress is applied exactly once per elapsed interval.
- Slum-produced Minions affect later Minion production during offline simulation.
- Tests prove the core production examples.
- The web UI can recover from refresh and show the authoritative state.

## 26. Open Design Questions

These should be answered during early development:

- What are the production rate, cycle duration, and base cost for Dark Legions?
- What are the production rate, cycle duration, and base cost for Fortresses?
- Should same-timestamp events process higher-tier first, lower-tier first, or by fixed config order?
- Are manual clicks part of the MVP, or is the game purely generator-driven at first?
- What is the first use case for Dark Artifacts?
- What is the target length of the first progression arc?
- Should offline production have a cap, such as 8, 12, or 24 hours?
- What admin roles/permissions are needed in Filament beyond the solo developer account?
- How often should active client state refresh before WebSockets are introduced?
- When should prestige/reset mechanics enter the roadmap?

## 27. Common Pitfalls To Avoid

- Using aggregate offline formulas that miss compound generator production.
- Hardcoding economy variables that should be configurable through Filament.
- Trusting client timestamps or resource totals.
- Using floating-point arithmetic for large resources.
- Letting controllers own game logic.
- Using loose strings across the backend instead of enum-backed domain values.
- Allowing unaudited balance/configuration edits.
- Applying offline progress twice because timestamps are not updated transactionally.
- Forgetting row locks or transactions around purchases.
- Logging every production event indefinitely without retention strategy.
- Adding WebSockets before the state and simulator contracts are stable.
- Overbuilding mobile support before the web MVP proves the game loop.

## 28. Recommended Immediate Next Steps

1. Create the repository and scaffold Laravel API plus React TypeScript web app.
2. Install Filament and `owen-it/laravel-auditing` during backend foundation work.
3. Set up PostgreSQL, Redis, test runners, and CI.
4. Define enum classes for core domain constants.
5. Implement configurable generator definitions before building UI.
6. Implement the production simulator and lock the minion/slum example in tests.
7. Implement player state persistence and transactional offline sync.
8. Expose the three MVP API endpoints.
9. Build the simplest playable web interface around authoritative server state.

The first development agent should prioritize correctness of the simulator and persistence model above visual polish. The heart of this project is the event-based production engine; once that is reliable, the rest of the app can grow around it cleanly.
