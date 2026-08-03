# Dark Lord Idle Game - Technical Specification

## Game Overview
An incremental/idle game where the player is an aspiring dark lord. Players unlock and manage resource generators that produce resources in a cascading chain.

## Core Resources
- **Evil**: Primary currency
- **Dark Artifacts**: Premium currency (rarer)

## Resource Generator Chain
Generators produce lower-tier resources in a cascading chain:

Fortresses → Dark Legions → Slums → Minions → Evil

### Generator Details

| Generator | Produces | Production Rate | Cycle Duration | Base Cost | Cost Scaling |
|-----------|----------|----------------|----------------|-----------|-------------|
| Minions | Evil | 15 per cycle | 24 seconds | 90 evil | 1.089x per owned |
| Slums | Minions | 100 per cycle | 60 seconds | 1500 evil | 1.089x per owned |
| Dark Legions | Slums | TBD | TBD | TBD | 1.089x per owned |
| Fortresses | Dark Legions | TBD | TBD | TBD | 1.089x per owned |

**Cost Formula**: next_cost = floor(base_cost * (1.089 ^ current_count))

## Critical Calculation Requirements

### Event-Based Production Simulation
Production must be calculated as discrete events with logical timestamps, NOT as simple totals.

**Why**: When a slum completes a 60-second cycle and produces 100 minions, those new minions should immediately start producing evil in subsequent minion cycles. A simple multiplication would miss this compound effect.

### Event Structure
Each production cycle generates an event:

- logical_timestamp (int): Position in event sequence
- generator_type (string)
- generator_count (int): How many generators of this type existed
- produced_amount (int): How many resources produced
- produces_resource (string): What resource type was produced

### Offline Production
When a player logs back in after being offline:
1. Calculate time elapsed since last login
2. Simulate ALL production cycles that would have occurred
3. Generate events for each cycle completion in chronological order
4. Apply compound effects (new generators from higher tiers affect lower tier production)
5. Return total accumulated resources

**Example**: Player offline for 120 seconds with 1 slum and 5 minions
- At t=24s: 5 minions produce 75 evil
- At t=48s: 5 minions produce 75 evil  
- At t=60s: 1 slum produces 100 minions (NOW player has 105 minions)
- At t=72s: 105 minions produce 1575 evil
- At t=96s: 105 minions produce 1575 evil
- At t=120s: 105 minions produce 1575 evil, 1 slum produces 100 minions

## Technical Architecture

### Backend: Laravel API
- API-first design for future mobile portability
- Server-authoritative: ALL calculations happen server-side
- Never trust client-submitted resource values
- Use Laravel Sanctum for authentication

### Key Endpoints Needed
- POST /api/sync-resources - Calculate and apply offline production
- POST /api/purchase-generator - Buy a new generator (server validates cost/updates)
- GET /api/player-state - Current resources and generator counts

### Database Schema (Minimum)
users table:
- evil_currency (bigint)
- dark_artifacts (int)
- minion_count (int)
- slum_count (int)
- dark_legion_count (int)
- fortress_count (int)
- last_login_timestamp (timestamp)

### Critical Principles
1. **Server-side validation**: Client sends intent, server calculates result
2. **Atomic updates**: Use database transactions for all resource changes
3. **Audit trail**: Log significant resource changes for debugging/anti-cheat
4. **No client trust**: Even time elapsed is calculated server-side from timestamps
5. **Event-driven simulation**: Model offline production as discrete events, not totals

## Implementation Priority
1. Build production event simulator with logical timestamps
2. Implement offline production calculation for minions → evil
3. Add slums → minions with compound effect verification
4. Extend to dark legions and fortresses
5. Add purchase validation and cost scaling
6. Build frontend sync mechanism

## Success Criteria
The simulation must correctly handle:
- Minions producing evil at 24-second intervals
- Slums producing minions at 60-second intervals
- New minions from slum production affecting subsequent evil production cycles
- Accurate cost calculation with 1.089x scaling
- Multi-hour offline sessions with thousands of cycles
- Extension to 4+ tiers of generators without code rewrites