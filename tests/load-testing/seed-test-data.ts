/**
 * Test Data Seeder for Race Condition Testing
 *
 * Creates test sessions and coupons with limited capacity
 * for use with the race condition load tests.
 *
 * Usage:
 *   npx tsx tests/load-testing/seed-test-data.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

interface TestData {
  sessionName: string;
  sessionCapacity: number;
  couponCode: string;
  couponMaxUses: number;
  couponDiscount: number;
}

const testData: TestData = {
  sessionName: `Race Test Session - ${new Date().toISOString().split('T')[0]}`,
  sessionCapacity: 3, // Very limited capacity for testing
  couponCode: `RACE-${Date.now().toString(36).toUpperCase()}`,
  couponMaxUses: 1,
  couponDiscount: 10, // $10 discount
};

async function seedTestData() {
  console.log('🌱 Seeding test data for race condition testing...\n');
  console.log(`Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    // Note: These mutations require admin authentication
    // In a real test setup, you'd need to configure admin tokens

    console.log('📅 Creating test session...');
    console.log(`   Name: ${testData.sessionName}`);
    console.log(`   Capacity: ${testData.sessionCapacity}`);

    // This will fail without admin auth - that's expected
    // The output shows what data to create manually
    console.log('\n⚠️  Note: Creating sessions requires admin authentication.');
    console.log('   Create this session manually via the admin UI:\n');
    console.log('   Session Details:');
    console.log(`   - Name: "${testData.sessionName}"`);
    console.log(`   - Capacity: ${testData.sessionCapacity}`);
    console.log(`   - Start Date: Today or future date`);
    console.log(`   - Price: Any (e.g., $100)`);

    console.log('\n🎟️  Creating test coupon...');
    console.log(`   Code: ${testData.couponCode}`);
    console.log(`   Max Uses: ${testData.couponMaxUses}`);
    console.log(`   Discount: $${testData.couponDiscount}`);

    console.log('\n⚠️  Note: Creating coupons requires admin authentication.');
    console.log('   Create this coupon manually via the admin UI:\n');
    console.log('   Coupon Details:');
    console.log(`   - Code: "${testData.couponCode}"`);
    console.log(`   - Max Uses: ${testData.couponMaxUses}`);
    console.log(`   - Discount Amount: $${testData.couponDiscount}`);
    console.log(`   - Status: Available`);

    console.log('\n✅ Test data configuration generated.');
    console.log('\nAfter creating the test data manually, update the config in:');
    console.log('   tests/load-testing/race-condition-test.ts');
    console.log('\nWith these values:');
    console.log(`   sessionId: "<paste session ID here>"`);
    console.log(`   couponCode: "${testData.couponCode}"`);

  } catch (err) {
    console.error('Error:', err);
  }
}

seedTestData();
