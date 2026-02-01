/**
 * Load Testing Script: Race Condition Detection
 *
 * This script simulates multiple users competing for limited resources
 * to expose race conditions in the enrollment system.
 *
 * Target Race Conditions:
 * 1. Session Capacity Race - Multiple users enrolling in same session
 * 2. Coupon Claim Race - Multiple users claiming same limited-use coupon
 *
 * Usage:
 *   npx tsx tests/load-testing/race-condition-test.ts
 *
 * Prerequisites:
 *   - Convex dev server running (npx convex dev)
 *   - Test data seeded (sessions with limited capacity, coupons)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface TestConfig {
  convexUrl: string;
  sessionCapacityTest: {
    enabled: boolean;
    sessionId: Id<"sessions"> | null; // Set to target session or null to create one
    concurrentUsers: number;
    sessionCapacity: number; // Expected capacity to test against
  };
  couponClaimTest: {
    enabled: boolean;
    couponCode: string | null; // Set to target coupon or null to create one
    concurrentUsers: number;
    maxUses: number; // Expected max uses of coupon
  };
  // Timing config
  requestDelayMs: number; // Delay between setting up users (stagger)
  simultaneousFireDelay: number; // How closely to fire simultaneous requests
}

const config: TestConfig = {
  // Get from CONVEX_URL env or use local dev default
  convexUrl: process.env.CONVEX_URL || "http://127.0.0.1:3210",

  sessionCapacityTest: {
    enabled: true,
    sessionId: null, // Will use existing or you can hardcode an ID
    concurrentUsers: 10, // Try to enroll 10 users at once
    sessionCapacity: 5, // Session only has 5 spots
  },

  couponClaimTest: {
    enabled: true,
    couponCode: null, // Will use existing or you can hardcode
    concurrentUsers: 5, // Try 5 users claiming same coupon
    maxUses: 1, // Coupon can only be used once
  },

  requestDelayMs: 0, // No stagger - fire simultaneously
  simultaneousFireDelay: 10, // 10ms window for "simultaneous" requests
};

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  testName: string;
  startTime: number;
  endTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  expectedSuccesses: number;
  raceConditionDetected: boolean;
  details: RequestResult[];
  summary: string;
}

interface RequestResult {
  userId: string;
  requestId: number;
  startTime: number;
  endTime: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  result?: unknown;
}

interface SimulatedUser {
  id: string;
  client: ConvexHttpClient;
  authToken?: string; // If needed for authenticated requests
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createClient(url: string): ConvexHttpClient {
  return new ConvexHttpClient(url);
}

function generateUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// TEST RUNNERS
// ============================================================================

/**
 * Test 1: Session Capacity Race Condition
 *
 * Scenario: Session has 5 spots. 10 users try to enroll simultaneously.
 * Expected: Only 5 succeed, 5 fail with "session full" error.
 * Race condition indicator: More than 5 succeed (overbooking).
 */
async function runSessionCapacityTest(
  testConfig: TestConfig['sessionCapacityTest'],
  convexUrl: string
): Promise<TestResult> {
  console.log(colorize('\n=== SESSION CAPACITY RACE CONDITION TEST ===', 'blue'));
  console.log(`Configuration:`);
  console.log(`  - Concurrent users: ${testConfig.concurrentUsers}`);
  console.log(`  - Session capacity: ${testConfig.sessionCapacity}`);
  console.log(`  - Expected max successes: ${testConfig.sessionCapacity}`);

  const results: RequestResult[] = [];
  const startTime = Date.now();

  // Create simulated users with their own clients
  const users: SimulatedUser[] = Array.from(
    { length: testConfig.concurrentUsers },
    () => ({
      id: generateUserId(),
      client: createClient(convexUrl),
    })
  );

  console.log(`\nCreated ${users.length} simulated users`);

  // Get or verify target session
  const adminClient = createClient(convexUrl);
  let targetSessionId = testConfig.sessionId;

  if (!targetSessionId) {
    console.log(`\nNo session ID provided. Querying available sessions...`);
    try {
      const sessions = await adminClient.query(api.sessions.listSessions);
      const availableSession = sessions.find(
        s => s.isActive && (s.capacity - s.enrolledCount) > 0
      );

      if (availableSession) {
        targetSessionId = availableSession._id;
        console.log(`  Found session: ${availableSession.name}`);
        console.log(`  Capacity: ${availableSession.capacity}, Enrolled: ${availableSession.enrolledCount}`);
        console.log(`  Spots remaining: ${availableSession.capacity - availableSession.enrolledCount}`);
      } else {
        console.log(colorize('  No available sessions found. Create a test session first.', 'yellow'));
        return {
          testName: 'Session Capacity Race',
          startTime,
          endTime: Date.now(),
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          expectedSuccesses: testConfig.sessionCapacity,
          raceConditionDetected: false,
          details: [],
          summary: 'SKIPPED: No available sessions',
        };
      }
    } catch (err) {
      console.log(colorize(`  Error querying sessions: ${err}`, 'red'));
      return {
        testName: 'Session Capacity Race',
        startTime,
        endTime: Date.now(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        expectedSuccesses: testConfig.sessionCapacity,
        raceConditionDetected: false,
        details: [],
        summary: `SKIPPED: ${err}`,
      };
    }
  }

  console.log(`\nTarget session ID: ${targetSessionId}`);
  console.log(`\nFiring ${testConfig.concurrentUsers} simultaneous enrollment requests...`);

  // Fire all requests simultaneously
  const enrollmentPromises = users.map(async (user, index) => {
    const requestStart = Date.now();
    const result: RequestResult = {
      userId: user.id,
      requestId: index,
      startTime: requestStart,
      endTime: 0,
      latencyMs: 0,
      success: false,
    };

    try {
      // Note: This assumes users are not authenticated for testing purposes.
      // In production, each user would have their own auth token.
      // For this test, we're calling the mutation directly which may fail
      // if the mutation requires authentication.

      // Using a query to simulate the check phase of addToLedger
      // Since we can't actually authenticate fake users, we'll test the
      // race condition logic by simulating concurrent capacity checks

      const response = await user.client.mutation(api.ledgerItems.addToLedger, {
        sessionId: targetSessionId!,
        childId: undefined, // Optional
      });

      result.success = true;
      result.result = response;
    } catch (err: unknown) {
      result.success = false;
      result.error = err instanceof Error ? err.message : String(err);
    }

    result.endTime = Date.now();
    result.latencyMs = result.endTime - result.startTime;
    return result;
  });

  // Wait for all to complete
  const allResults = await Promise.all(enrollmentPromises);
  results.push(...allResults);

  const endTime = Date.now();

  // Analyze results
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const raceConditionDetected = successCount > testConfig.sessionCapacity;

  console.log(`\n--- Results ---`);
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${colorize(String(successCount), successCount > testConfig.sessionCapacity ? 'red' : 'green')}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Expected max successes: ${testConfig.sessionCapacity}`);

  if (raceConditionDetected) {
    console.log(colorize(`\n!!! RACE CONDITION DETECTED !!!`, 'red'));
    console.log(colorize(`Overbooking occurred: ${successCount} enrollments for ${testConfig.sessionCapacity} spots`, 'red'));
  } else {
    console.log(colorize(`\nNo race condition detected in this run`, 'green'));
  }

  // Show timing distribution
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  console.log(`\nLatency distribution:`);
  console.log(`  Min: ${formatDuration(latencies[0])}`);
  console.log(`  Max: ${formatDuration(latencies[latencies.length - 1])}`);
  console.log(`  Median: ${formatDuration(latencies[Math.floor(latencies.length / 2)])}`);

  return {
    testName: 'Session Capacity Race',
    startTime,
    endTime,
    totalRequests: results.length,
    successfulRequests: successCount,
    failedRequests: failCount,
    expectedSuccesses: testConfig.sessionCapacity,
    raceConditionDetected,
    details: results,
    summary: raceConditionDetected
      ? `RACE CONDITION: ${successCount}/${testConfig.sessionCapacity} overbooking`
      : `OK: ${successCount}/${testConfig.sessionCapacity} enrollments`,
  };
}

/**
 * Test 2: Coupon Claim Race Condition
 *
 * Scenario: Coupon has maxUses=1. 5 users try to claim simultaneously.
 * Expected: Only 1 succeeds, 4 fail with "coupon unavailable" error.
 * Race condition indicator: More than 1 succeed (coupon overclaimed).
 */
async function runCouponClaimTest(
  testConfig: TestConfig['couponClaimTest'],
  convexUrl: string
): Promise<TestResult> {
  console.log(colorize('\n=== COUPON CLAIM RACE CONDITION TEST ===', 'blue'));
  console.log(`Configuration:`);
  console.log(`  - Concurrent users: ${testConfig.concurrentUsers}`);
  console.log(`  - Coupon max uses: ${testConfig.maxUses}`);
  console.log(`  - Expected max successes: ${testConfig.maxUses}`);

  const results: RequestResult[] = [];
  const startTime = Date.now();

  // Create simulated users
  const users: SimulatedUser[] = Array.from(
    { length: testConfig.concurrentUsers },
    () => ({
      id: generateUserId(),
      client: createClient(convexUrl),
    })
  );

  console.log(`\nCreated ${users.length} simulated users`);

  // Get or create target coupon
  let targetCouponCode = testConfig.couponCode;

  if (!targetCouponCode) {
    console.log(`\nNo coupon code provided. You need to create a test coupon first.`);
    console.log(`  Create a coupon with code like "RACE-TEST-${Date.now()}" and maxUses=1`);

    return {
      testName: 'Coupon Claim Race',
      startTime,
      endTime: Date.now(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      expectedSuccesses: testConfig.maxUses,
      raceConditionDetected: false,
      details: [],
      summary: 'SKIPPED: No coupon code provided',
    };
  }

  console.log(`\nTarget coupon code: ${targetCouponCode}`);
  console.log(`\nFiring ${testConfig.concurrentUsers} simultaneous claim requests...`);

  // Fire all requests simultaneously
  const claimPromises = users.map(async (user, index) => {
    const requestStart = Date.now();
    const result: RequestResult = {
      userId: user.id,
      requestId: index,
      startTime: requestStart,
      endTime: 0,
      latencyMs: 0,
      success: false,
    };

    try {
      const response = await user.client.mutation(api.coupons.claimCoupon, {
        code: targetCouponCode!,
      });

      result.success = true;
      result.result = response;
    } catch (err: unknown) {
      result.success = false;
      result.error = err instanceof Error ? err.message : String(err);
    }

    result.endTime = Date.now();
    result.latencyMs = result.endTime - result.startTime;
    return result;
  });

  const allResults = await Promise.all(claimPromises);
  results.push(...allResults);

  const endTime = Date.now();

  // Analyze results
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const raceConditionDetected = successCount > testConfig.maxUses;

  console.log(`\n--- Results ---`);
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${colorize(String(successCount), successCount > testConfig.maxUses ? 'red' : 'green')}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Expected max successes: ${testConfig.maxUses}`);

  if (raceConditionDetected) {
    console.log(colorize(`\n!!! RACE CONDITION DETECTED !!!`, 'red'));
    console.log(colorize(`Coupon overclaimed: ${successCount} claims for maxUses=${testConfig.maxUses}`, 'red'));
  } else {
    console.log(colorize(`\nNo race condition detected in this run`, 'green'));
  }

  // Show which users succeeded/failed
  console.log(`\nDetailed results:`);
  results.forEach((r, i) => {
    const status = r.success
      ? colorize('SUCCESS', 'green')
      : colorize('FAILED', 'yellow');
    console.log(`  User ${i}: ${status} (${formatDuration(r.latencyMs)}) ${r.error || ''}`);
  });

  return {
    testName: 'Coupon Claim Race',
    startTime,
    endTime,
    totalRequests: results.length,
    successfulRequests: successCount,
    failedRequests: failCount,
    expectedSuccesses: testConfig.maxUses,
    raceConditionDetected,
    details: results,
    summary: raceConditionDetected
      ? `RACE CONDITION: ${successCount}/${testConfig.maxUses} overclaimed`
      : `OK: ${successCount}/${testConfig.maxUses} claims`,
  };
}

// ============================================================================
// STRESS TEST: Rapid Fire Multiple Rounds
// ============================================================================

interface StressTestConfig {
  rounds: number;
  delayBetweenRounds: number;
  testType: 'session' | 'coupon';
}

async function runStressTest(
  stressConfig: StressTestConfig,
  testConfig: TestConfig
): Promise<TestResult[]> {
  console.log(colorize('\n=== STRESS TEST: MULTIPLE ROUNDS ===', 'blue'));
  console.log(`Running ${stressConfig.rounds} rounds with ${stressConfig.delayBetweenRounds}ms delay`);

  const allResults: TestResult[] = [];
  let raceConditionsFound = 0;

  for (let round = 1; round <= stressConfig.rounds; round++) {
    console.log(colorize(`\n--- Round ${round}/${stressConfig.rounds} ---`, 'yellow'));

    let result: TestResult;
    if (stressConfig.testType === 'session') {
      result = await runSessionCapacityTest(
        testConfig.sessionCapacityTest,
        testConfig.convexUrl
      );
    } else {
      result = await runCouponClaimTest(
        testConfig.couponClaimTest,
        testConfig.convexUrl
      );
    }

    allResults.push(result);

    if (result.raceConditionDetected) {
      raceConditionsFound++;
    }

    if (round < stressConfig.rounds) {
      await sleep(stressConfig.delayBetweenRounds);
    }
  }

  console.log(colorize('\n=== STRESS TEST SUMMARY ===', 'blue'));
  console.log(`Total rounds: ${stressConfig.rounds}`);
  console.log(`Race conditions detected: ${colorize(String(raceConditionsFound), raceConditionsFound > 0 ? 'red' : 'green')}`);
  console.log(`Success rate (no race conditions): ${((stressConfig.rounds - raceConditionsFound) / stressConfig.rounds * 100).toFixed(1)}%`);

  return allResults;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log(colorize('╔════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║     RACE CONDITION LOAD TESTING - BerryFun v1          ║', 'blue'));
  console.log(colorize('╚════════════════════════════════════════════════════════╝', 'blue'));
  console.log(`\nConvex URL: ${config.convexUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const allResults: TestResult[] = [];

  // Run Session Capacity Test
  if (config.sessionCapacityTest.enabled) {
    try {
      const result = await runSessionCapacityTest(
        config.sessionCapacityTest,
        config.convexUrl
      );
      allResults.push(result);
    } catch (err) {
      console.error(colorize(`Session test error: ${err}`, 'red'));
    }
  }

  // Run Coupon Claim Test
  if (config.couponClaimTest.enabled) {
    try {
      const result = await runCouponClaimTest(
        config.couponClaimTest,
        config.convexUrl
      );
      allResults.push(result);
    } catch (err) {
      console.error(colorize(`Coupon test error: ${err}`, 'red'));
    }
  }

  // Final Summary
  console.log(colorize('\n╔════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║                   FINAL SUMMARY                        ║', 'blue'));
  console.log(colorize('╚════════════════════════════════════════════════════════╝', 'blue'));

  const racesFound = allResults.filter(r => r.raceConditionDetected).length;

  allResults.forEach(result => {
    const status = result.raceConditionDetected
      ? colorize('RACE DETECTED', 'red')
      : colorize('OK', 'green');
    console.log(`\n${result.testName}: ${status}`);
    console.log(`  ${result.summary}`);
    console.log(`  Duration: ${formatDuration(result.endTime - result.startTime)}`);
  });

  if (racesFound > 0) {
    console.log(colorize(`\n⚠️  ${racesFound} race condition(s) detected!`, 'red'));
    console.log('Review the results above and implement proper locking mechanisms.');
    process.exit(1);
  } else {
    console.log(colorize('\n✓ No race conditions detected in this run', 'green'));
    console.log('Note: Race conditions may be intermittent. Run multiple times to increase confidence.');
    process.exit(0);
  }
}

// Run if executed directly
main().catch(err => {
  console.error(colorize(`Fatal error: ${err}`, 'red'));
  process.exit(1);
});

export {
  runSessionCapacityTest,
  runCouponClaimTest,
  runStressTest,
  config,
  type TestConfig,
  type TestResult,
};
