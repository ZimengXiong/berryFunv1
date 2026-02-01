# Load Testing - Race Condition Detection

This directory contains load testing scripts to identify and demonstrate race conditions in the BerryFun enrollment system.

## Identified Race Conditions

### 1. Session Capacity Race (Critical)
**Location:** `convex/ledgerItems.ts:addToLedger()`

**Pattern:** Check-then-act
```
Thread 1: Read count (19)    → Check < 20 ✓ → Insert
Thread 2: Read count (19)    → Check < 20 ✓ → Insert
Result: 21 enrollments for 20 spots
```

### 2. Coupon Claim Race (Critical)
**Location:** `convex/coupons.ts:claimCoupon()`

**Pattern:** Check-then-act with state transition
```
User 1: Read status="available" → Check ✓ → Update to "pending"
User 2: Read status="available" → Check ✓ → Update to "pending" (overwrites)
Result: User 1's claim lost, both think they succeeded
```

## Test Files

| File | Description | Requires Backend |
|------|-------------|------------------|
| `race-simulation.ts` | Pure logic simulation | No |
| `race-condition-test.ts` | Live backend testing | Yes |
| `seed-test-data.ts` | Test data helper | Yes |

## Quick Start

### 1. Run Simulation (No backend needed)
```bash
npx tsx tests/load-testing/race-simulation.ts
```

This simulates the race condition patterns using in-memory state to demonstrate the vulnerability.

### 2. Run Live Tests (Requires Convex dev server)
```bash
# Terminal 1: Start Convex
npx convex dev

# Terminal 2: Run tests
npx tsx tests/load-testing/race-condition-test.ts
```

## Test Configuration

Edit `race-condition-test.ts` to configure:

```typescript
const config = {
  convexUrl: "http://127.0.0.1:3210",

  sessionCapacityTest: {
    enabled: true,
    sessionId: null, // or specific ID
    concurrentUsers: 10,
    sessionCapacity: 5,
  },

  couponClaimTest: {
    enabled: true,
    couponCode: "TEST-COUPON",
    concurrentUsers: 5,
    maxUses: 1,
  },
};
```

## Expected Results

### Race Condition Detected
```
Session Capacity Race: RACE CONDITION
  Overbooking: 7/5 enrollments

Coupon Claim Race: RACE CONDITION
  Overclaimed: 3/1 claims
```

### No Race Condition (this run)
```
Session Capacity Race: OK
  5/5 enrollments (at capacity)

Coupon Claim Race: OK
  1/1 claims
```

Note: Race conditions are probabilistic. Run multiple iterations for confidence.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Test Runner                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   User 1    │  │   User 2    │  │   User N    │     │
│  │   Client    │  │   Client    │  │   Client    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│                          ▼                              │
│              ┌───────────────────────┐                  │
│              │   Simultaneous Fire   │                  │
│              │   (Promise.all)       │                  │
│              └───────────┬───────────┘                  │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │    Convex Backend     │
              │                       │
              │  ┌─────────────────┐  │
              │  │ addToLedger()   │  │ ← Race window
              │  │ claimCoupon()   │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

## Recommended Fixes

### For Session Capacity
```typescript
// Option 1: Database constraint
// Add unique index on (sessionId, userId) with count check

// Option 2: Optimistic locking
const session = await ctx.db.get(sessionId);
const expectedVersion = session.version;

// ... do checks ...

await ctx.db.patch(sessionId, {
  enrolledCount: session.enrolledCount + 1,
  version: expectedVersion + 1,
  // Convex will fail if version changed
});

// Option 3: Use atomic counter
await ctx.db.patch(sessionId, {
  enrolledCount: { $inc: 1 }, // If Convex supported this
});
```

### For Coupon Claims
```typescript
// Option 1: Unique constraint on (couponId, status='pending')
// Option 2: Use scheduled function for serialization
// Option 3: Optimistic locking with version field
```

## Stress Testing

Run multiple rounds to increase detection probability:

```typescript
import { runStressTest } from './race-condition-test';

await runStressTest({
  rounds: 20,
  delayBetweenRounds: 1000,
  testType: 'session',
}, config);
```
