/**
 * Race Condition Simulation - Pure Logic Test
 *
 * This test simulates the exact race condition patterns found in the codebase
 * WITHOUT requiring a running Convex backend. It demonstrates how concurrent
 * operations can lead to data inconsistency.
 *
 * Usage:
 *   npx tsx tests/load-testing/race-simulation.ts
 *
 * This helps understand the race conditions before testing against real backend.
 */

// ============================================================================
// SIMULATED DATABASE STATE
// ============================================================================

interface Session {
  id: string;
  name: string;
  capacity: number;
  enrolledCount: number;
}

interface LedgerItem {
  id: string;
  sessionId: string;
  userId: string;
  status: 'draft' | 'reserved' | 'secured' | 'verified' | 'cancelled';
  createdAt: number;
}

interface Coupon {
  id: string;
  code: string;
  status: 'available' | 'pending' | 'consumed' | 'expired' | 'disabled';
  maxUses: number;
  currentUses: number;
  linkedUserId: string | null;
}

// Simulated database
const db = {
  sessions: new Map<string, Session>(),
  ledgerItems: new Map<string, LedgerItem>(),
  coupons: new Map<string, Coupon>(),
  nextId: 1,
};

// Simulated network delay (makes race conditions more visible)
const SIMULATED_DELAY_MS = 5;

async function simulateNetworkDelay(): Promise<void> {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * SIMULATED_DELAY_MS)
  );
}

// ============================================================================
// SIMULATED MUTATIONS (Mimics actual codebase logic)
// ============================================================================

/**
 * Simulates addToLedger from ledgerItems.ts
 *
 * VULNERABLE CODE PATTERN (check-then-act):
 *   1. Query existing enrollments
 *   2. Check if count < capacity
 *   3. Insert new enrollment
 *
 * Race window: Between step 2 and 3, other requests can also pass the check
 */
async function vulnerableAddToLedger(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  await simulateNetworkDelay();

  // Step 1: Query session
  const session = db.sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // Step 2: Count existing enrollments (simulates the vulnerable query)
  const enrolledItems = Array.from(db.ledgerItems.values()).filter(
    item =>
      item.sessionId === sessionId &&
      (item.status === 'verified' || item.status === 'secured')
  );

  // RACE WINDOW STARTS HERE - other requests can read the same count

  await simulateNetworkDelay(); // Simulates time to process

  // Step 3: Check capacity
  if (enrolledItems.length >= session.capacity) {
    return { success: false, error: 'Session is full' };
  }

  // RACE WINDOW CONTINUES - multiple requests pass the check

  await simulateNetworkDelay(); // More processing time

  // Step 4: Insert new item (too late - damage is done)
  const itemId = `item-${db.nextId++}`;
  db.ledgerItems.set(itemId, {
    id: itemId,
    sessionId,
    userId,
    status: 'secured', // Simplified - skip draft/reserve
    createdAt: Date.now(),
  });

  return { success: true, itemId };
}

/**
 * Simulates claimCoupon from coupons.ts
 *
 * VULNERABLE CODE PATTERN (check-then-act with state transition):
 *   1. Query coupon by code
 *   2. Check if status === 'available'
 *   3. Check if currentUses < maxUses
 *   4. Update coupon to 'pending'
 *
 * Race window: Between check and update, coupon state can be stale
 */
async function vulnerableClaimCoupon(
  code: string,
  userId: string
): Promise<{ success: boolean; couponId?: string; error?: string }> {
  await simulateNetworkDelay();

  // Step 1: Find coupon by code
  const coupon = Array.from(db.coupons.values()).find(c => c.code === code);
  if (!coupon) {
    return { success: false, error: 'Invalid coupon code' };
  }

  // RACE WINDOW STARTS - multiple users read same coupon state

  await simulateNetworkDelay();

  // Step 2: Check availability
  if (coupon.status !== 'available') {
    return { success: false, error: 'Coupon not available' };
  }

  // Step 3: Check max uses
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return { success: false, error: 'Coupon exhausted' };
  }

  // RACE WINDOW CONTINUES - all concurrent users pass checks

  await simulateNetworkDelay();

  // Step 4: Update coupon (second write wins, first user's claim is lost)
  coupon.status = 'pending';
  coupon.linkedUserId = userId;
  coupon.currentUses += 1;

  return { success: true, couponId: coupon.id };
}

/**
 * Fixed version using optimistic locking simulation
 */
async function fixedAddToLedgerWithLock(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  await simulateNetworkDelay();

  const session = db.sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // ATOMIC operation: check AND insert in single step
  // Simulates what should happen with proper locking

  const enrolledCount = Array.from(db.ledgerItems.values()).filter(
    item =>
      item.sessionId === sessionId &&
      (item.status === 'verified' || item.status === 'secured')
  ).length;

  // In a real fix, this would be an atomic compare-and-swap
  // or use database-level constraints

  // Simulate atomic check-and-insert
  if (enrolledCount >= session.capacity) {
    return { success: false, error: 'Session is full' };
  }

  const itemId = `item-${db.nextId++}`;
  db.ledgerItems.set(itemId, {
    id: itemId,
    sessionId,
    userId,
    status: 'secured',
    createdAt: Date.now(),
  });

  return { success: true, itemId };
}

// ============================================================================
// TEST RUNNERS
// ============================================================================

function resetDatabase() {
  db.sessions.clear();
  db.ledgerItems.clear();
  db.coupons.clear();
  db.nextId = 1;
}

function colorize(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'reset'): string {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Test 1: Session Capacity Race Condition
 */
async function testSessionCapacityRace() {
  console.log(colorize('\n═══════════════════════════════════════════════════════', 'blue'));
  console.log(colorize('TEST 1: SESSION CAPACITY RACE CONDITION', 'blue'));
  console.log(colorize('═══════════════════════════════════════════════════════', 'blue'));

  resetDatabase();

  // Create a session with 3 spots
  const sessionId = 'session-1';
  db.sessions.set(sessionId, {
    id: sessionId,
    name: 'Summer Camp Week 1',
    capacity: 3,
    enrolledCount: 0,
  });

  console.log('\nScenario: Session has 3 spots, 10 users try to enroll simultaneously');
  console.log('Expected: Only 3 should succeed');

  // 10 concurrent enrollment attempts
  const userCount = 10;
  const promises = Array.from({ length: userCount }, (_, i) =>
    vulnerableAddToLedger(sessionId, `user-${i + 1}`)
  );

  const results = await Promise.all(promises);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\nResults:`);
  console.log(`  Successful enrollments: ${colorize(String(successCount), successCount > 3 ? 'red' : 'green')}`);
  console.log(`  Failed enrollments: ${failCount}`);
  console.log(`  Actual items in DB: ${db.ledgerItems.size}`);

  if (successCount > 3) {
    console.log(colorize(`\n⚠️  RACE CONDITION DETECTED!`, 'red'));
    console.log(colorize(`   Overbooking: ${successCount} enrollments for 3 spots`, 'red'));
    return true;
  } else {
    console.log(colorize(`\n✓ No race condition in this run`, 'green'));
    return false;
  }
}

/**
 * Test 2: Coupon Claim Race Condition
 */
async function testCouponClaimRace() {
  console.log(colorize('\n═══════════════════════════════════════════════════════', 'blue'));
  console.log(colorize('TEST 2: COUPON CLAIM RACE CONDITION', 'blue'));
  console.log(colorize('═══════════════════════════════════════════════════════', 'blue'));

  resetDatabase();

  // Create a single-use coupon
  const couponId = 'coupon-1';
  db.coupons.set(couponId, {
    id: couponId,
    code: 'SINGLE-USE',
    status: 'available',
    maxUses: 1,
    currentUses: 0,
    linkedUserId: null,
  });

  console.log('\nScenario: Coupon has maxUses=1, 5 users try to claim simultaneously');
  console.log('Expected: Only 1 should succeed');

  // 5 concurrent claim attempts
  const userCount = 5;
  const promises = Array.from({ length: userCount }, (_, i) =>
    vulnerableClaimCoupon('SINGLE-USE', `user-${i + 1}`)
  );

  const results = await Promise.all(promises);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const coupon = db.coupons.get(couponId)!;

  console.log(`\nResults:`);
  console.log(`  Successful claims: ${colorize(String(successCount), successCount > 1 ? 'red' : 'green')}`);
  console.log(`  Failed claims: ${failCount}`);
  console.log(`  Coupon currentUses: ${coupon.currentUses}`);
  console.log(`  Coupon linkedUserId: ${coupon.linkedUserId}`);

  if (successCount > 1) {
    console.log(colorize(`\n⚠️  RACE CONDITION DETECTED!`, 'red'));
    console.log(colorize(`   Overclaimed: ${successCount} claims for 1 coupon use`, 'red'));

    // Show which users think they got the coupon
    const winners = results
      .map((r, i) => ({ userId: `user-${i + 1}`, ...r }))
      .filter(r => r.success);
    console.log(`   Users who think they claimed it: ${winners.map(w => w.userId).join(', ')}`);
    console.log(`   Actual linked user: ${coupon.linkedUserId}`);

    return true;
  } else {
    console.log(colorize(`\n✓ No race condition in this run`, 'green'));
    return false;
  }
}

/**
 * Test 3: Enrollment Count Increment Race (simulates admin verification)
 */
async function testEnrollmentCountRace() {
  console.log(colorize('\n═══════════════════════════════════════════════════════', 'blue'));
  console.log(colorize('TEST 3: ENROLLMENT COUNT INCREMENT RACE', 'blue'));
  console.log(colorize('═══════════════════════════════════════════════════════', 'blue'));

  resetDatabase();

  const sessionId = 'session-1';
  db.sessions.set(sessionId, {
    id: sessionId,
    name: 'Summer Camp Week 1',
    capacity: 20,
    enrolledCount: 0,
  });

  console.log('\nScenario: Admin verifies 5 receipts simultaneously');
  console.log('Expected: enrolledCount should be 5');

  // Simulate vulnerable read-modify-write pattern
  async function vulnerableVerifyReceipt(sessionId: string): Promise<void> {
    await simulateNetworkDelay();

    const session = db.sessions.get(sessionId)!;

    // RACE: Read current count
    const currentCount = session.enrolledCount;

    await simulateNetworkDelay();

    // RACE: Write incremented count (other reads happened with old value)
    session.enrolledCount = currentCount + 1;
  }

  // 5 concurrent verifications
  const promises = Array.from({ length: 5 }, () =>
    vulnerableVerifyReceipt(sessionId)
  );

  await Promise.all(promises);

  const session = db.sessions.get(sessionId)!;

  console.log(`\nResults:`);
  console.log(`  Final enrolledCount: ${colorize(String(session.enrolledCount), session.enrolledCount < 5 ? 'red' : 'green')}`);
  console.log(`  Expected: 5`);

  if (session.enrolledCount < 5) {
    console.log(colorize(`\n⚠️  RACE CONDITION DETECTED!`, 'red'));
    console.log(colorize(`   Lost updates: Only ${session.enrolledCount} counted instead of 5`, 'red'));
    return true;
  } else {
    console.log(colorize(`\n✓ No race condition in this run`, 'green'));
    return false;
  }
}

/**
 * Run multiple iterations to increase race condition detection probability
 */
async function runMultipleIterations(
  testFn: () => Promise<boolean>,
  testName: string,
  iterations: number
): Promise<{ detected: number; total: number }> {
  let detected = 0;

  console.log(colorize(`\n\n▶ Running ${testName} x${iterations} iterations...`, 'yellow'));

  for (let i = 0; i < iterations; i++) {
    const raceDetected = await testFn();
    if (raceDetected) detected++;
  }

  return { detected, total: iterations };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(colorize('╔════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║        RACE CONDITION SIMULATION - Logic Verification          ║', 'blue'));
  console.log(colorize('║                                                                ║', 'blue'));
  console.log(colorize('║  This simulates the vulnerable patterns in the codebase to    ║', 'blue'));
  console.log(colorize('║  demonstrate how race conditions occur in concurrent access.  ║', 'blue'));
  console.log(colorize('╚════════════════════════════════════════════════════════════════╝', 'blue'));

  // Run each test multiple times
  const iterations = 10;

  const sessionResults = await runMultipleIterations(
    testSessionCapacityRace,
    'Session Capacity Race',
    iterations
  );

  const couponResults = await runMultipleIterations(
    testCouponClaimRace,
    'Coupon Claim Race',
    iterations
  );

  const countResults = await runMultipleIterations(
    testEnrollmentCountRace,
    'Enrollment Count Race',
    iterations
  );

  // Final summary
  console.log(colorize('\n\n╔════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║                      FINAL SUMMARY                             ║', 'blue'));
  console.log(colorize('╚════════════════════════════════════════════════════════════════╝', 'blue'));

  console.log(`\nSession Capacity Race:`);
  console.log(`  Detected: ${colorize(`${sessionResults.detected}/${sessionResults.total}`, sessionResults.detected > 0 ? 'red' : 'green')} runs`);
  console.log(`  Rate: ${((sessionResults.detected / sessionResults.total) * 100).toFixed(0)}%`);

  console.log(`\nCoupon Claim Race:`);
  console.log(`  Detected: ${colorize(`${couponResults.detected}/${couponResults.total}`, couponResults.detected > 0 ? 'red' : 'green')} runs`);
  console.log(`  Rate: ${((couponResults.detected / couponResults.total) * 100).toFixed(0)}%`);

  console.log(`\nEnrollment Count Race:`);
  console.log(`  Detected: ${colorize(`${countResults.detected}/${countResults.total}`, countResults.detected > 0 ? 'red' : 'green')} runs`);
  console.log(`  Rate: ${((countResults.detected / countResults.total) * 100).toFixed(0)}%`);

  const totalRaces = sessionResults.detected + couponResults.detected + countResults.detected;
  const totalTests = sessionResults.total + couponResults.total + countResults.total;

  console.log(colorize('\n────────────────────────────────────────────────────────────────', 'yellow'));
  console.log(`Total race conditions detected: ${colorize(`${totalRaces}/${totalTests}`, totalRaces > 0 ? 'red' : 'green')} test runs`);

  if (totalRaces > 0) {
    console.log(colorize('\n⚠️  Race conditions confirmed. These patterns exist in:', 'red'));
    console.log('   - convex/ledgerItems.ts:addToLedger() - line ~50-80');
    console.log('   - convex/coupons.ts:claimCoupon() - line ~60-100');
    console.log('   - convex/admin.ts:verifyReceipt() - line ~200-250');
    console.log('\nRecommended fixes:');
    console.log('   1. Use database-level unique constraints');
    console.log('   2. Implement optimistic locking with version fields');
    console.log('   3. Use atomic increment operations');
    console.log('   4. Consider Convex scheduled functions for serialization');
  }
}

main().catch(console.error);
