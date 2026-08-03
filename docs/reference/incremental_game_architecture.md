# Incremental Game Architecture - Starter Document

## Project Overview
Browser-based incremental/idle game with cross-device sync and offline progress tracking. Future mobile app expansion planned.

**Core Requirements:**
- Offline progress calculation
- Cross-device synchronization (web + mobile)
- Cheat prevention
- Minimal code duplication across platforms

## Architecture Decision: Backend-Centric

**Approach:** Server manages game logic and calculations; client handles rendering and user input.

### Why Backend-Centric?
- **Cheat Prevention:** Single source of truth, server-validated actions
- **Consistency:** Same game logic across all platforms
- **Maintainability:** Easier to balance and patch game mechanics
- **Cross-Platform:** Simplified porting to mobile

## Tech Stack

### Backend
- **Framework:** Laravel (API mode)
- **WebSockets:** Laravel Echo / Pusher
- **Database:** PostgreSQL (JSONB support for flexible state)
- **Caching:** Redis
- **Authentication:** JWT or Laravel Sanctum

### Frontend (Web)
- **Framework:** React with TypeScript
- **Build Tool:** Next.js or Vite
- **State Management:** Zustand
- **Server Sync:** React Query or TanStack Query
- **WebSocket Client:** Socket.io-client
- **UI Framework:** Tailwind CSS
- **Game Rendering:** Phaser.js (optional, for visual elements)

### Frontend (Mobile - Future)
- **Framework:** React Native or Expo
- **Shared Logic:** Monorepo with shared TypeScript packages

### Additional Libraries
- `decimal.js` - Precise resource calculations (avoids floating-point errors)
- `immer` - Immutable state updates
- `uuid` - Unique identifiers

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Game Configurations Table
```sql
CREATE TABLE game_configurations (
    id UUID PRIMARY KEY,
    config_type VARCHAR(50),
    configuration_json JSONB,
    version VARCHAR(50),
    created_at TIMESTAMP
);
```

### Player Game States Table
```sql
CREATE TABLE player_game_states (
    user_id UUID REFERENCES users(id),
    game_version VARCHAR(50),
    state_type VARCHAR(50), -- 'resources', 'upgrades', 'achievements'
    state_data JSONB,
    last_updated TIMESTAMP,
    PRIMARY KEY (user_id, game_version, state_type)
);

CREATE INDEX idx_user_last_updated ON player_game_states(user_id, last_updated);
```

### Player Progress Logs (Analytics)
```sql
CREATE TABLE player_progress_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    timestamp TIMESTAMP,
    event_type VARCHAR(100),
    event_details JSONB
);

CREATE INDEX idx_user_timestamp ON player_progress_logs(user_id, timestamp);
```

## Game State Structure

```typescript
interface GameState {
  userId: string;
  version: string;
  lastInteractionTimestamp: number;
  resources: {
    [resourceType: string]: string; // Use string for Decimal.js precision
  };
  upgrades: {
    [upgradeId: string]: {
      level: number;
      multiplier: number;
      purchased: boolean;
    };
  };
  achievements: string[];
  statistics: {
    totalClicks: number;
    totalResourcesGenerated: string;
    playTimeSeconds: number;
  };
}
```

## Core Architecture Flow

### 1. Connection & Authentication
Player connects → WebSocket authentication → Load game state → Calculate offline progress

### 2. Active Gameplay
Player action → Client sends to server → Server validates →
Server calculates → Server updates state → Server broadcasts update →
Client renders new state

### 3. Disconnection
Socket closes → Server persists state → Update last_interaction_timestamp

## Key Implementation Patterns

### Server-Side Game State Manager
```typescript
class GameStateManager {
  // Calculate resources accumulated while offline
  calculateOfflineProgress(
    lastPlayedTimestamp: number,
    currentTimestamp: number,
    gameState: GameState
  ): GameState {
    const elapsedSeconds = (currentTimestamp - lastPlayedTimestamp) / 1000;
    // Apply production rates, caps, and bonuses
    return updatedState;
  }

  // Validate and apply player actions
  validateAndApplyAction(
    userId: string,
    action: PlayerAction,
    currentState: GameState
  ): { valid: boolean; newState?: GameState; error?: string } {
    // Verify action is valid
    // Check resource costs
    // Apply changes
    // Return updated state or error
  }

  // Calculate passive resource generation
  calculatePassiveIncome(gameState: GameState, deltaTime: number): GameState {
    // Apply all multipliers and bonuses
    return updatedState;
  }
}
```

### Client-Side Optimistic Updates
```typescript
class GameClient {
  // Predictive rendering for responsiveness
  optimisticUpdate(action: PlayerAction) {
    // Immediately update local UI
    this.localState = applyActionLocally(action);
    this.sendToServer(action);
  }

  // Handle server reconciliation
  handleServerUpdate(serverState: GameState) {
    if (this.localState !== serverState) {
      // Server is authority - replace local state
      this.reconcileState(serverState);
    }
  }

  // Queue actions when offline
  queueOfflineAction(action: PlayerAction) {
    this.offlineQueue.push(action);
    // Sync when connection restored
  }
}
```

## WebSocket Event Structure

### Client → Server Events
```typescript
{
  "event": "player_action",
  "data": {
    "action": "purchase_upgrade",
    "upgradeId": "auto_clicker_1",
    "timestamp": 1234567890
  }
}

{
  "event": "manual_click",
  "data": {
    "clickCount": 1,
    "timestamp": 1234567890
  }
}
```

### Server → Client Events
```typescript
{
  "event": "state_update",
  "data": {
    "resources": { "cookies": "1500.50" },
    "upgrades": { /* ... */ }
  }
}

{
  "event": "offline_progress",
  "data": {
    "offlineTime": 3600,
    "resourcesEarned": { "cookies": "450.25" },
    "newState": { /* ... */ }
  }
}
```

## Security Considerations

1. **Server-Side Validation:** Never trust client input
2. **Rate Limiting:** Prevent action spam
3. **State Checksums:** Detect tampering attempts
4. **Resource Caps:** Prevent overflow exploits
5. **Action Cooldowns:** Server-enforced timing

## Offline & Cross-Device Sync Strategy

### Offline Mode
1. Cache last known good state in localStorage
2. Queue player actions
3. Apply optimistic local updates
4. Sync queue when connection restores
5. Server reconciles and returns authoritative state

### Multi-Device Sync
1. Use userId as state identifier
2. Server maintains single source of truth
3. Last-write-wins for most fields
4. Additive merge for certain stats (total clicks, achievements)
5. Version tracking to detect conflicts

## Performance Optimizations

1. **Database Indexing:** Index on user_id and last_updated
2. **Caching:** Redis for active player states
3. **Connection Pooling:** Efficient database connections
4. **Batch Updates:** Group multiple state changes
5. **Efficient Serialization:** Use MessagePack or Protocol Buffers for WebSocket

## Monorepo Structure (Code Sharing)
incremental-game/
├── packages/
│   ├── shared-types/          # TypeScript interfaces
│   ├── game-engine/            # Shared game logic
│   ├── backend-api/            # Laravel API
│   ├── web-client/             # React web app
│   └── mobile-client/          # React Native app (future)
├── package.json
└── README.md

## Development Roadmap

### Phase 1: Core Backend
- [ ] Set up Laravel API
- [ ] Implement authentication
- [ ] Create database schema
- [ ] Build GameStateManager class
- [ ] Implement WebSocket connection handling
- [ ] Develop offline progress calculation

### Phase 2: Web Client
- [ ] Set up React + TypeScript project
- [ ] Implement WebSocket client
- [ ] Build basic game UI
- [ ] Implement optimistic updates
- [ ] Add offline queue handling
- [ ] Create game rendering (Phaser or CSS)

### Phase 3: Game Mechanics
- [ ] Define resource types
- [ ] Implement upgrade system
- [ ] Create achievement system
- [ ] Balance game economy
- [ ] Add prestige/reset mechanics

### Phase 4: Polish & Testing
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Cross-device testing
- [ ] Analytics integration
- [ ] User feedback implementation

### Phase 5: Mobile Expansion
- [ ] React Native setup
- [ ] Reuse shared packages
- [ ] Platform-specific UI
- [ ] App store deployment

## Common Pitfalls to Avoid

1. **Floating-Point Math:** Use Decimal.js for all resource calculations
2. **State Desync:** Always treat server as source of truth
3. **Over-Optimistic Updates:** Implement rollback for rejected actions
4. **Database Bottlenecks:** Use Redis caching aggressively
5. **WebSocket Overhead:** Batch updates when possible
6. **Time Manipulation:** Server-side timestamps only
7. **Save Scumming:** Implement autosave, server-side state only

## Testing Strategy

1. **Unit Tests:** Game logic calculations
2. **Integration Tests:** API endpoints
3. **WebSocket Tests:** Connection handling
4. **Load Tests:** Concurrent users
5. **Offline Tests:** Network interruption scenarios
6. **Cross-Device Tests:** Multi-device sync

## Resources & References

- **Game Design Patterns:** Robert Nystrom
- **Laravel Documentation:** https://laravel.com/docs
- **React Query:** https://tanstack.com/query
- **Phaser.js:** https://phaser.io/
- **Decimal.js:** https://mikemcl.github.io/decimal.js/

## Questions to Answer During Development

1. What is the core game loop?
2. What resources exist in the game?
3. What upgrades/purchases are available?
4. How do production rates scale?
5. What is the prestige/reset mechanic?
6. How are achievements unlocked?
7. What are the balance constraints?
8. How frequently should state sync occur?

---

**Next Steps:** Start with Phase 1 - build the Laravel backend with authentication, database schema, and basic WebSocket handling. Then move to Phase 2 for the web client prototype.