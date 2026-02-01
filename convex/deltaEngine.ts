import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthenticatedUser, requireAdmin } from "./authHelpers";
import {
  getTieredDiscount,
  RETURNING_CREDIT_PER_WEEK,
  SIBLING_CREDIT_PER_WEEK,
  EARLY_BIRD_DISCOUNT_PERCENT,
} from "./constants";

interface BalanceBreakdown {
  // Totals
  grossTuition: number;
  totalDiscounts: number;
  totalCredits: number;
  totalPaid: number;
  pendingPayments: number;
  balanceDue: number;

  // Breakdown
  tieredDiscount: number;
  returningCredit: number;
  siblingCredit: number;
  earlyBirdCredit: number;
  couponCredits: number;

  // Counts
  weekCount: number;
  draftWeekCount: number;
  reservedWeekCount: number;
  securedWeekCount: number;
  verifiedWeekCount: number;

  // Status
  hasEarlyBirdEligible: boolean;
  isReturning: boolean;
  hasSiblings: boolean;
}

// QUERY: Calculate reactive balance for current user
export const calculateBalance = query({
  args: {},
  handler: async (ctx): Promise<BalanceBreakdown | null> => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      return null;
    }

    const user = await ctx.db.get(auth.userId);
    if (!user) {
      return null;
    }

    // Get all non-cancelled ledger items
    const allItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Separate enrollments and credits
    const enrollments = allItems.filter((item) => item.type === "enrollment");
    const creditMemos = allItems.filter((item) => item.type === "credit_memo");

    // Count weeks by status
    const draftEnrollments = enrollments.filter((e) => e.status === "draft");
    const reservedEnrollments = enrollments.filter((e) => e.status === "reserved");
    const securedEnrollments = enrollments.filter((e) => e.status === "secured");
    const verifiedEnrollments = enrollments.filter((e) => e.status === "verified");

    const draftWeekCount = draftEnrollments.length;
    const reservedWeekCount = reservedEnrollments.length;
    const securedWeekCount = securedEnrollments.length;
    const verifiedWeekCount = verifiedEnrollments.length;
    const weekCount = draftWeekCount + reservedWeekCount + securedWeekCount + verifiedWeekCount;

    // Calculate gross tuition (draft + secured + verified)
    const grossTuition = enrollments.reduce((sum: number, e) => sum + e.amount, 0);

    // Calculate tiered discount based on total week count
    const tieredDiscount = getTieredDiscount(weekCount);

    // Calculate per-week credits
    const returningCredit = user.isReturning ? weekCount * RETURNING_CREDIT_PER_WEEK : 0;
    const siblingCredit = user.siblingGroupId ? weekCount * SIBLING_CREDIT_PER_WEEK : 0;

    // Calculate early bird credit
    let earlyBirdCredit = 0;
    let hasEarlyBirdEligible = false;

    for (const enrollment of enrollments) {
      if (enrollment.sessionId) {
        const session = await ctx.db.get(enrollment.sessionId);
        if (session && session.earlyBirdDeadline) {
          if (enrollment.createdAt < session.earlyBirdDeadline) {
            hasEarlyBirdEligible = true;
            const discount = enrollment.amount * (EARLY_BIRD_DISCOUNT_PERCENT / 100);
            earlyBirdCredit += discount;
          }
        }
      }
    }

    // Calculate coupon credits from credit memos
    const couponCredits = creditMemos.reduce((sum: number, c) => sum + Math.abs(c.amount), 0);

    // Calculate total paid from verified receipts
    const verifiedReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", auth.userId).eq("status", "verified")
      )
      .collect();

    const totalPaid = verifiedReceipts.reduce((sum: number, r) => sum + r.amount, 0);

    // Calculate pending payments (submitted but not yet verified)
    const pendingReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", auth.userId).eq("status", "pending")
      )
      .collect();

    const pendingPayments = pendingReceipts.reduce((sum: number, r) => sum + r.amount, 0);

    // Calculate totals
    const totalDiscounts = tieredDiscount;
    const totalCredits = returningCredit + siblingCredit + earlyBirdCredit + couponCredits;
    // Subtract both verified and pending payments from balance due
    const balanceDue = Math.max(0, grossTuition - totalDiscounts - totalCredits - totalPaid - pendingPayments);

    return {
      grossTuition,
      totalDiscounts,
      totalCredits,
      totalPaid,
      pendingPayments,
      balanceDue,

      tieredDiscount,
      returningCredit,
      siblingCredit,
      earlyBirdCredit,
      couponCredits,

      weekCount,
      draftWeekCount,
      reservedWeekCount,
      securedWeekCount,
      verifiedWeekCount,

      hasEarlyBirdEligible,
      isReturning: user.isReturning ?? false,
      hasSiblings: !!user.siblingGroupId,
    };
  },
});

// QUERY: Calculate balance for a specific user (admin view)
export const calculateUserBalance = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<BalanceBreakdown | null> => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Get all non-cancelled ledger items
    const allItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Separate enrollments and credits
    const enrollments = allItems.filter((item) => item.type === "enrollment");
    const creditMemos = allItems.filter((item) => item.type === "credit_memo");

    // Count weeks by status
    const draftEnrollments = enrollments.filter((e) => e.status === "draft");
    const reservedEnrollments = enrollments.filter((e) => e.status === "reserved");
    const securedEnrollments = enrollments.filter((e) => e.status === "secured");
    const verifiedEnrollments = enrollments.filter((e) => e.status === "verified");

    const draftWeekCount = draftEnrollments.length;
    const reservedWeekCount = reservedEnrollments.length;
    const securedWeekCount = securedEnrollments.length;
    const verifiedWeekCount = verifiedEnrollments.length;
    const weekCount = draftWeekCount + reservedWeekCount + securedWeekCount + verifiedWeekCount;

    // Calculate gross tuition
    const grossTuition = enrollments.reduce((sum: number, e) => sum + e.amount, 0);

    // Calculate tiered discount
    const tieredDiscount = getTieredDiscount(weekCount);

    // Calculate per-week credits
    const returningCredit = user.isReturning ? weekCount * RETURNING_CREDIT_PER_WEEK : 0;
    const siblingCredit = user.siblingGroupId ? weekCount * SIBLING_CREDIT_PER_WEEK : 0;

    // Calculate early bird credit
    let earlyBirdCredit = 0;
    let hasEarlyBirdEligible = false;

    for (const enrollment of enrollments) {
      if (enrollment.sessionId) {
        const session = await ctx.db.get(enrollment.sessionId);
        if (session && session.earlyBirdDeadline) {
          if (enrollment.createdAt < session.earlyBirdDeadline) {
            hasEarlyBirdEligible = true;
            const discount = enrollment.amount * (EARLY_BIRD_DISCOUNT_PERCENT / 100);
            earlyBirdCredit += discount;
          }
        }
      }
    }

    // Calculate coupon credits
    const couponCredits = creditMemos.reduce((sum: number, c) => sum + Math.abs(c.amount), 0);

    // Calculate total paid
    const verifiedReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", args.userId).eq("status", "verified")
      )
      .collect();

    const totalPaid = verifiedReceipts.reduce((sum: number, r) => sum + r.amount, 0);

    // Calculate pending payments
    const pendingReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending")
      )
      .collect();

    const pendingPayments = pendingReceipts.reduce((sum: number, r) => sum + r.amount, 0);

    // Calculate totals
    const totalDiscounts = tieredDiscount;
    const totalCredits = returningCredit + siblingCredit + earlyBirdCredit + couponCredits;
    const balanceDue = Math.max(0, grossTuition - totalDiscounts - totalCredits - totalPaid - pendingPayments);

    return {
      grossTuition,
      totalDiscounts,
      totalCredits,
      totalPaid,
      pendingPayments,
      balanceDue,

      tieredDiscount,
      returningCredit,
      siblingCredit,
      earlyBirdCredit,
      couponCredits,

      weekCount,
      draftWeekCount,
      reservedWeekCount,
      securedWeekCount,
      verifiedWeekCount,

      hasEarlyBirdEligible,
      isReturning: user.isReturning ?? false,
      hasSiblings: !!user.siblingGroupId,
    };
  },
});

// QUERY: Get tiered discount preview for adding more weeks
export const getDiscountPreview = query({
  args: {
    additionalWeeks: v.number(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      return null;
    }

    // Get current week count
    const enrollments = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "enrollment"),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .collect();

    const currentWeeks = enrollments.length;
    const projectedWeeks = currentWeeks + args.additionalWeeks;

    const currentDiscount = getTieredDiscount(currentWeeks);
    const projectedDiscount = getTieredDiscount(projectedWeeks);
    const additionalDiscount = projectedDiscount - currentDiscount;

    return {
      currentWeeks,
      projectedWeeks,
      currentDiscount,
      projectedDiscount,
      additionalDiscount,
    };
  },
});
