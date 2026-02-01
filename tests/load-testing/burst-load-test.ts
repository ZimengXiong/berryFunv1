/**
 * Burst Load Test - Simulates realistic "flash sale" scenarios
 *
 * Creates periodic bursts of users arriving simultaneously,
 * mimicking when a session goes live or announcement is made.
 *
 * Usage:
 *   npx tsx tests/load-testing/burst-load-test.ts
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Capacity
  sessionCapacity: 20,

  // Burst settings
  totalBursts: 10,              // Number of bursts over the test
  usersPerBurst: 100,           // Users arriving in each burst
  burstWindowMs: 50,            // All users in burst arrive within 50ms
  timeBetweenBurstsMs: 3000,    // 3 seconds between bursts

  // Simulated processing (longer = more race window)
  minProcessingMs: 10,
  maxProcessingMs: 50,          // Longer delays = bigger race window
};

// Calculated totals
const TOTAL_USERS = CONFIG.totalBursts * CONFIG.usersPerBurst;
const TOTAL_DURATION_MS = CONFIG.totalBursts * CONFIG.timeBetweenBurstsMs;

// ============================================================================
// SIMULATED DATABASE
// ============================================================================

const db = {
  session: { id: 'session-1', capacity: CONFIG.sessionCapacity },
  ledgerItems: [] as { id: string; userId: string; timestamp: number }[],
  nextId: 1,
};

// ============================================================================
// METRICS
// ============================================================================

const metrics = {
  requestsCompleted: 0,
  successes: 0,
  failures: 0,
  latencies: [] as number[],
  burstResults: [] as { burst: number; successes: number; totalEnrolled: number }[],
};

// ============================================================================
// UTILITIES
// ============================================================================

function randomDelay(min: number, max: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
}

function colorize(text: string, color: string): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', reset: '\x1b[0m',
  };
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// VULNERABLE ENROLLMENT
// ============================================================================

async function vulnerableEnroll(userId: string): Promise<boolean> {
  const start = Date.now();

  // READ: Count current enrollments
  const currentCount = db.ledgerItems.length;

  // RACE WINDOW - simulated processing delay
  await randomDelay(CONFIG.minProcessingMs, CONFIG.maxProcessingMs);

  // CHECK: Is there capacity?
  if (currentCount >= db.session.capacity) {
    metrics.requestsCompleted++;
    metrics.failures++;
    metrics.latencies.push(Date.now() - start);
    return false;
  }

  // More processing
  await randomDelay(CONFIG.minProcessingMs, CONFIG.maxProcessingMs);

  // WRITE: Insert enrollment
  db.ledgerItems.push({
    id: `item-${db.nextId++}`,
    userId,
    timestamp: Date.now(),
  });

  metrics.requestsCompleted++;
  metrics.successes++;
  metrics.latencies.push(Date.now() - start);
  return true;
}

// ============================================================================
// BURST GENERATOR
// ============================================================================

async function runBurst(burstNumber: number): Promise<void> {
  const burstStart = db.ledgerItems.length;

  // Generate random arrival times within burst window
  const arrivals: number[] = Array.from(
    { length: CONFIG.usersPerBurst },
    () => Math.random() * CONFIG.burstWindowMs
  );

  // Schedule all users in this burst
  const promises = arrivals.map(async (delay, i) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return vulnerableEnroll(`burst${burstNumber}-user${i + 1}`);
  });

  await Promise.all(promises);

  const burstSuccesses = db.ledgerItems.length - burstStart;
  metrics.burstResults.push({
    burst: burstNumber,
    successes: burstSuccesses,
    totalEnrolled: db.ledgerItems.length,
  });
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function runBurstLoadTest() {
  console.log(colorize('╔══════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║            BURST LOAD TEST - Flash Sale Simulation               ║', 'blue'));
  console.log(colorize('╚══════════════════════════════════════════════════════════════════╝', 'blue'));

  console.log(`\nConfiguration:`);
  console.log(`  Session capacity:    ${CONFIG.sessionCapacity} spots`);
  console.log(`  Total bursts:        ${CONFIG.totalBursts}`);
  console.log(`  Users per burst:     ${CONFIG.usersPerBurst}`);
  console.log(`  Burst window:        ${CONFIG.burstWindowMs}ms (all users arrive within this)`);
  console.log(`  Time between bursts: ${CONFIG.timeBetweenBurstsMs}ms`);
  console.log(`  Processing delay:    ${CONFIG.minProcessingMs}-${CONFIG.maxProcessingMs}ms`);
  console.log(`  Total users:         ${TOTAL_USERS}`);

  console.log(colorize('\n▶ Starting burst test...\n', 'yellow'));

  const startTime = Date.now();

  for (let i = 1; i <= CONFIG.totalBursts; i++) {
    const enrolledBefore = db.ledgerItems.length;

    process.stdout.write(`  Burst ${i.toString().padStart(2)}/${CONFIG.totalBursts}: `);
    process.stdout.write(`${CONFIG.usersPerBurst} users arriving... `);

    await runBurst(i);

    const enrolledAfter = db.ledgerItems.length;
    const newEnrollments = enrolledAfter - enrolledBefore;

    const status = enrolledAfter > CONFIG.sessionCapacity
      ? colorize(`+${newEnrollments} (OVERBOOKED: ${enrolledAfter}/${CONFIG.sessionCapacity})`, 'red')
      : colorize(`+${newEnrollments} (total: ${enrolledAfter}/${CONFIG.sessionCapacity})`, 'green');

    console.log(status);

    if (i < CONFIG.totalBursts) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.timeBetweenBurstsMs));
    }
  }

  const endTime = Date.now();

  // Results
  printResults(startTime, endTime);
}

function printResults(startTime: number, endTime: number) {
  const totalEnrolled = db.ledgerItems.length;
  const overbooked = Math.max(0, totalEnrolled - CONFIG.sessionCapacity);

  console.log(colorize('\n╔══════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║                         RESULTS                                  ║', 'blue'));
  console.log(colorize('╚══════════════════════════════════════════════════════════════════╝', 'blue'));

  console.log(`\n${colorize('Request Summary:', 'cyan')}`);
  console.log(`  Total requests:    ${metrics.requestsCompleted}`);
  console.log(`  Successful:        ${metrics.successes}`);
  console.log(`  Failed (full):     ${metrics.failures}`);
  console.log(`  Duration:          ${((endTime - startTime) / 1000).toFixed(2)}s`);

  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  console.log(`\n${colorize('Latency:', 'cyan')}`);
  console.log(`  Average:           ${(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(1)}ms`);
  console.log(`  P50:               ${sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]}ms`);
  console.log(`  P99:               ${sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]}ms`);

  console.log(`\n${colorize('Capacity Analysis:', 'cyan')}`);
  console.log(`  Session capacity:  ${CONFIG.sessionCapacity}`);
  console.log(`  Actually enrolled: ${colorize(String(totalEnrolled), totalEnrolled > CONFIG.sessionCapacity ? 'red' : 'green')}`);

  if (overbooked > 0) {
    console.log(colorize(`\n  ⚠️  OVERBOOKING DETECTED!`, 'red'));
    console.log(colorize(`  Extra enrollments: +${overbooked} (${((overbooked / CONFIG.sessionCapacity) * 100).toFixed(0)}% over capacity)`, 'red'));

    // Show burst-by-burst breakdown
    console.log(`\n${colorize('Burst Breakdown:', 'yellow')}`);
    metrics.burstResults.forEach(b => {
      const indicator = b.totalEnrolled > CONFIG.sessionCapacity ? colorize('⚠️', 'red') : '  ';
      console.log(`  ${indicator} Burst ${b.burst.toString().padStart(2)}: +${b.successes.toString().padStart(2)} → total ${b.totalEnrolled.toString().padStart(3)}`);
    });

    // Show who got overbooked
    console.log(`\n${colorize('Overbooking Details:', 'yellow')}`);
    console.log(`  First ${CONFIG.sessionCapacity} enrollments are valid.`);
    console.log(`  Enrollments ${CONFIG.sessionCapacity + 1}-${totalEnrolled} are OVERBOOKINGS.`);

    const overboookedUsers = db.ledgerItems.slice(CONFIG.sessionCapacity);
    console.log(`\n  Overbooked users:`);
    overboookedUsers.slice(0, 10).forEach((item, i) => {
      console.log(`    ${CONFIG.sessionCapacity + i + 1}. ${item.userId}`);
    });
    if (overboookedUsers.length > 10) {
      console.log(`    ... and ${overboookedUsers.length - 10} more`);
    }
  } else {
    console.log(colorize(`\n  ✓ No overbooking detected`, 'green'));
  }
}

// ============================================================================
// RUN
// ============================================================================

runBurstLoadTest().catch(console.error);
