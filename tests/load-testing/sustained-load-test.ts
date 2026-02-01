/**
 * Sustained Load Test - 1000 Users Over 30 Seconds
 *
 * Simulates realistic traffic patterns with random arrival times.
 *
 * Usage:
 *   npx tsx tests/load-testing/sustained-load-test.ts
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  totalUsers: 1000,
  durationMs: 30_000,        // 30 seconds
  sessionCapacity: 20,       // Only 20 spots available

  // Simulated delays
  minProcessingMs: 2,
  maxProcessingMs: 15,
};

// ============================================================================
// SIMULATED DATABASE
// ============================================================================

interface Session {
  id: string;
  capacity: number;
  enrolledCount: number;
}

interface LedgerItem {
  id: string;
  sessionId: string;
  userId: string;
  status: 'secured' | 'verified';
  timestamp: number;
}

const db = {
  session: null as Session | null,
  ledgerItems: [] as LedgerItem[],
  nextId: 1,
};

// ============================================================================
// METRICS
// ============================================================================

interface Metrics {
  requestsStarted: number;
  requestsCompleted: number;
  successes: number;
  failures: number;
  startTime: number;
  endTime: number;
  latencies: number[];
  timeline: { time: number; enrolled: number; requests: number }[];
}

const metrics: Metrics = {
  requestsStarted: 0,
  requestsCompleted: 0,
  successes: 0,
  failures: 0,
  startTime: 0,
  endTime: 0,
  latencies: [],
  timeline: [],
};

// ============================================================================
// UTILITIES
// ============================================================================

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function colorize(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'reset'): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// VULNERABLE ENROLLMENT (Same pattern as real code)
// ============================================================================

async function vulnerableEnroll(userId: string): Promise<{ success: boolean; error?: string }> {
  const requestStart = Date.now();
  metrics.requestsStarted++;

  // STEP 1: Read current enrollments
  const currentEnrollments = db.ledgerItems.filter(
    item => item.sessionId === db.session!.id &&
            (item.status === 'secured' || item.status === 'verified')
  );

  // Simulate database/network delay (RACE WINDOW)
  await randomDelay(CONFIG.minProcessingMs, CONFIG.maxProcessingMs);

  // STEP 2: Check capacity
  if (currentEnrollments.length >= db.session!.capacity) {
    metrics.requestsCompleted++;
    metrics.failures++;
    metrics.latencies.push(Date.now() - requestStart);
    return { success: false, error: 'Session full' };
  }

  // More processing delay (RACE WINDOW CONTINUES)
  await randomDelay(CONFIG.minProcessingMs, CONFIG.maxProcessingMs);

  // STEP 3: Insert enrollment
  const itemId = `item-${db.nextId++}`;
  db.ledgerItems.push({
    id: itemId,
    sessionId: db.session!.id,
    userId,
    status: 'secured',
    timestamp: Date.now(),
  });

  metrics.requestsCompleted++;
  metrics.successes++;
  metrics.latencies.push(Date.now() - requestStart);

  return { success: true };
}

// ============================================================================
// LOAD GENERATOR
// ============================================================================

async function runSustainedLoadTest() {
  console.log(colorize('╔══════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║         SUSTAINED LOAD TEST - 1000 Users / 30 Seconds           ║', 'blue'));
  console.log(colorize('╚══════════════════════════════════════════════════════════════════╝', 'blue'));

  console.log(`\nConfiguration:`);
  console.log(`  Total users:      ${CONFIG.totalUsers}`);
  console.log(`  Duration:         ${CONFIG.durationMs / 1000}s`);
  console.log(`  Session capacity: ${CONFIG.sessionCapacity}`);
  console.log(`  Avg arrival rate: ${(CONFIG.totalUsers / (CONFIG.durationMs / 1000)).toFixed(1)} users/sec`);

  // Initialize database
  db.session = {
    id: 'session-1',
    capacity: CONFIG.sessionCapacity,
    enrolledCount: 0,
  };
  db.ledgerItems = [];
  db.nextId = 1;

  // Reset metrics
  metrics.requestsStarted = 0;
  metrics.requestsCompleted = 0;
  metrics.successes = 0;
  metrics.failures = 0;
  metrics.latencies = [];
  metrics.timeline = [];

  console.log(colorize('\n▶ Starting load test...', 'yellow'));
  console.log(`  Spawning ${CONFIG.totalUsers} users with random arrival times over ${CONFIG.durationMs / 1000}s\n`);

  metrics.startTime = Date.now();

  // Progress display
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - metrics.startTime;
    const progress = Math.min(100, (elapsed / CONFIG.durationMs) * 100);
    const enrolled = db.ledgerItems.length;

    // Record timeline data point
    metrics.timeline.push({
      time: elapsed,
      enrolled,
      requests: metrics.requestsCompleted,
    });

    process.stdout.write(
      `\r  Progress: ${progress.toFixed(0).padStart(3)}% | ` +
      `Requests: ${metrics.requestsCompleted.toString().padStart(4)}/${CONFIG.totalUsers} | ` +
      `Enrolled: ${colorize(enrolled.toString().padStart(3), enrolled > CONFIG.sessionCapacity ? 'red' : 'green')}/${CONFIG.sessionCapacity} | ` +
      `Time: ${(elapsed / 1000).toFixed(1)}s`
    );
  }, 100);

  // Generate random arrival times for all users
  const arrivalTimes: number[] = [];
  for (let i = 0; i < CONFIG.totalUsers; i++) {
    arrivalTimes.push(Math.random() * CONFIG.durationMs);
  }
  arrivalTimes.sort((a, b) => a - b);

  // Schedule all user requests
  const allRequests: Promise<void>[] = [];

  for (let i = 0; i < CONFIG.totalUsers; i++) {
    const userId = `user-${i + 1}`;
    const arrivalTime = arrivalTimes[i];

    const request = (async () => {
      // Wait until arrival time
      const waitTime = arrivalTime - (Date.now() - metrics.startTime);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Execute enrollment
      await vulnerableEnroll(userId);
    })();

    allRequests.push(request);
  }

  // Wait for all requests to complete
  await Promise.all(allRequests);

  clearInterval(progressInterval);
  metrics.endTime = Date.now();

  // Final progress line
  console.log(
    `\r  Progress: 100% | ` +
    `Requests: ${metrics.requestsCompleted.toString().padStart(4)}/${CONFIG.totalUsers} | ` +
    `Enrolled: ${colorize(db.ledgerItems.length.toString().padStart(3), db.ledgerItems.length > CONFIG.sessionCapacity ? 'red' : 'green')}/${CONFIG.sessionCapacity} | ` +
    `Time: ${((metrics.endTime - metrics.startTime) / 1000).toFixed(1)}s`
  );

  // Print results
  printResults();
}

// ============================================================================
// RESULTS
// ============================================================================

function printResults() {
  const totalEnrolled = db.ledgerItems.length;
  const overbooked = totalEnrolled - CONFIG.sessionCapacity;
  const overbookingRate = ((overbooked / CONFIG.sessionCapacity) * 100).toFixed(1);

  const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
  const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

  console.log(colorize('\n\n╔══════════════════════════════════════════════════════════════════╗', 'blue'));
  console.log(colorize('║                         RESULTS                                  ║', 'blue'));
  console.log(colorize('╚══════════════════════════════════════════════════════════════════╝', 'blue'));

  console.log(`\n${colorize('Request Summary:', 'cyan')}`);
  console.log(`  Total requests:    ${metrics.requestsCompleted}`);
  console.log(`  Successful:        ${metrics.successes}`);
  console.log(`  Failed (full):     ${metrics.failures}`);
  console.log(`  Duration:          ${((metrics.endTime - metrics.startTime) / 1000).toFixed(2)}s`);
  console.log(`  Throughput:        ${(metrics.requestsCompleted / ((metrics.endTime - metrics.startTime) / 1000)).toFixed(1)} req/s`);

  console.log(`\n${colorize('Latency (ms):', 'cyan')}`);
  console.log(`  Average:           ${avgLatency.toFixed(1)}ms`);
  console.log(`  P50 (median):      ${p50}ms`);
  console.log(`  P95:               ${p95}ms`);
  console.log(`  P99:               ${p99}ms`);
  console.log(`  Min:               ${sortedLatencies[0]}ms`);
  console.log(`  Max:               ${sortedLatencies[sortedLatencies.length - 1]}ms`);

  console.log(`\n${colorize('Capacity Analysis:', 'cyan')}`);
  console.log(`  Session capacity:  ${CONFIG.sessionCapacity}`);
  console.log(`  Actually enrolled: ${colorize(String(totalEnrolled), totalEnrolled > CONFIG.sessionCapacity ? 'red' : 'green')}`);

  if (overbooked > 0) {
    console.log(colorize(`\n  ⚠️  OVERBOOKING DETECTED!`, 'red'));
    console.log(colorize(`  Extra enrollments: +${overbooked} (${overbookingRate}% over capacity)`, 'red'));

    console.log(`\n${colorize('Race Condition Impact:', 'yellow')}`);
    console.log(`  If this were real money:`);
    console.log(`    - ${CONFIG.sessionCapacity} spots × $300 = $${(CONFIG.sessionCapacity * 300).toLocaleString()} expected revenue`);
    console.log(`    - ${totalEnrolled} actual enrollments need to be honored or refunded`);
    console.log(`    - ${overbooked} customers would be angry (oversold)`);
  } else {
    console.log(colorize(`\n  ✓ No overbooking detected`, 'green'));
  }

  // ASCII chart of enrollment over time
  console.log(`\n${colorize('Enrollment Timeline:', 'cyan')}`);
  printAsciiChart();

  // Show when overbooking occurred
  if (overbooked > 0) {
    const firstOverbookTime = metrics.timeline.find(t => t.enrolled > CONFIG.sessionCapacity);
    if (firstOverbookTime) {
      console.log(`\n${colorize('First overbooking at:', 'yellow')} ${(firstOverbookTime.time / 1000).toFixed(2)}s into test`);
    }
  }
}

function printAsciiChart() {
  const width = 60;
  const height = 10;
  const maxEnrolled = Math.max(...metrics.timeline.map(t => t.enrolled), CONFIG.sessionCapacity);

  // Sample data points for chart
  const samples = 20;
  const step = Math.floor(metrics.timeline.length / samples) || 1;
  const chartData = metrics.timeline.filter((_, i) => i % step === 0).slice(0, samples);

  console.log(`\n  Enrolled`);
  console.log(`  ${maxEnrolled.toString().padStart(3)} ┤`);

  for (let row = height - 1; row >= 0; row--) {
    const threshold = (row / height) * maxEnrolled;
    let line = '      │';

    for (const point of chartData) {
      if (point.enrolled >= threshold) {
        line += point.enrolled > CONFIG.sessionCapacity ? colorize('█', 'red') : colorize('█', 'green');
      } else {
        line += ' ';
      }
    }

    if (row === Math.floor((CONFIG.sessionCapacity / maxEnrolled) * height)) {
      line += ` ← capacity (${CONFIG.sessionCapacity})`;
    }

    console.log(line);
  }

  console.log(`    0 ┼${'─'.repeat(chartData.length)}`);
  console.log(`      0s${' '.repeat(chartData.length - 6)}${(CONFIG.durationMs / 1000)}s`);
}

// ============================================================================
// MAIN
// ============================================================================

runSustainedLoadTest().catch(console.error);
