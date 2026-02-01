// Tiered Discount Schedule
// Maps number of weeks to discount amount
export const TIERED_DISCOUNTS: Record<number, number> = {
  3: 50,
  4: 80,
  5: 120,
  6: 170,
  7: 200,
  8: 240,
  9: 280,
  10: 310,
  11: 340,
  12: 370,
};

// Get tiered discount for a given week count
export function getTieredDiscount(weekCount: number): number {
  if (weekCount < 3) return 0;
  if (weekCount > 12) return TIERED_DISCOUNTS[12];
  return TIERED_DISCOUNTS[weekCount] || 0;
}

// Per-week credits
export const RETURNING_CREDIT_PER_WEEK = 25;
export const SIBLING_CREDIT_PER_WEEK = 15;

// Early bird discount percentage
export const EARLY_BIRD_DISCOUNT_PERCENT = 5;

// Deposit amount per week (required for both cash and zelle options)
export const DEPOSIT_PER_WEEK = 50;

// Reservation expiry (30 minutes)
export const RESERVATION_EXPIRY_MS = 30 * 60 * 1000;

// Session token expiry (7 days in milliseconds)
export const SESSION_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Password requirements
export const MIN_PASSWORD_LENGTH = 8;
