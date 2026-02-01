import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getTieredDiscount,
  RETURNING_CREDIT_PER_WEEK,
  SIBLING_CREDIT_PER_WEEK,
  EARLY_BIRD_DISCOUNT_PERCENT,
} from "./constants";

// Helper to get authenticated user
async function getAuthenticatedUser(
  ctx: { db: any },
  token: string
): Promise<{ userId: Id<"users">; role: "user" | "admin" } | null> {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  const user = await ctx.db.get(session.userId);
  if (!user || !user.isActive) {
    return null;
  }

  return { userId: user._id, role: user.role };
}

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
  args: { token: v.string() },
  handler: async (ctx, args): Promise<BalanceBreakdown | null> => {
    const auth = await getAuthenticatedUser(ctx, args.token);
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
      .withIndex("by_userId", (q: any) => q.eq("userId", auth.userId))
      .filter((q: any) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Separate enrollments and credits
    const enrollments = allItems.filter((item: any) => item.type === "enrollment");
    const creditMemos = allItems.filter((item: any) => item.type === "credit_memo");

    // Count weeks by status
    const draftEnrollments = enrollments.filter((e: any) => e.status === "draft");
    const reservedEnrollments = enrollments.filter((e: any) => e.status === "reserved");
    const securedEnrollments = enrollments.filter((e: any) => e.status === "secured");
    const verifiedEnrollments = enrollments.filter((e: any) => e.status === "verified");

    const draftWeekCount = draftEnrollments.length;
    const reservedWeekCount = reservedEnrollments.length;
    const securedWeekCount = securedEnrollments.length;
    const verifiedWeekCount = verifiedEnrollments.length;
    const weekCount = draftWeekCount + reservedWeekCount + securedWeekCount + verifiedWeekCount;

    // Calculate gross tuition (draft + secured + verified)
    const grossTuition = enrollments.reduce((sum: number, e: any) => sum + e.amount, 0);

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
    const couponCredits = creditMemos.reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0);

    // Calculate total paid from verified receipts
    const verifiedReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q: any) =>
        q.eq("userId", auth.userId).eq("status", "verified")
      )
      .collect();

    const totalPaid = verifiedReceipts.reduce((sum: number, r: any) => sum + r.amount, 0);

    // Calculate pending payments (submitted but not yet verified)
    const pendingReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q: any) =>
        q.eq("userId", auth.userId).eq("status", "pending")
      )
      .collect();

    const pendingPayments = pendingReceipts.reduce((sum: number, r: any) => sum + r.amount, 0);

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
      isReturning: user.isReturning,
      hasSiblings: !!user.siblingGroupId,
    };
  },
});

// QUERY: Calculate balance for a specific user (admin view)
export const calculateUserBalance = query({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<BalanceBreakdown | null> => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth || auth.role !== "admin") {
      throw new Error("Admin access required");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Get all non-cancelled ledger items
    const allItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Separate enrollments and credits
    const enrollments = allItems.filter((item: any) => item.type === "enrollment");
    const creditMemos = allItems.filter((item: any) => item.type === "credit_memo");

    // Count weeks by status
    const draftEnrollments = enrollments.filter((e: any) => e.status === "draft");
    const reservedEnrollments = enrollments.filter((e: any) => e.status === "reserved");
    const securedEnrollments = enrollments.filter((e: any) => e.status === "secured");
    const verifiedEnrollments = enrollments.filter((e: any) => e.status === "verified");

    const draftWeekCount = draftEnrollments.length;
    const reservedWeekCount = reservedEnrollments.length;
    const securedWeekCount = securedEnrollments.length;
    const verifiedWeekCount = verifiedEnrollments.length;
    const weekCount = draftWeekCount + reservedWeekCount + securedWeekCount + verifiedWeekCount;

    // Calculate gross tuition
    const grossTuition = enrollments.reduce((sum: number, e: any) => sum + e.amount, 0);

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
    const couponCredits = creditMemos.reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0);

    // Calculate total paid
    const verifiedReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q: any) =>
        q.eq("userId", args.userId).eq("status", "verified")
      )
      .collect();

    const totalPaid = verifiedReceipts.reduce((sum: number, r: any) => sum + r.amount, 0);

    // Calculate pending payments
    const pendingReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_userId_status", (q: any) =>
        q.eq("userId", args.userId).eq("status", "pending")
      )
      .collect();

    const pendingPayments = pendingReceipts.reduce((sum: number, r: any) => sum + r.amount, 0);

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
      isReturning: user.isReturning,
      hasSiblings: !!user.siblingGroupId,
    };
  },
});

// QUERY: Get tiered discount preview for adding more weeks
export const getDiscountPreview = query({
  args: {
    token: v.string(),
    additionalWeeks: v.number(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth) {
      return null;
    }

    // Get current week count
    const enrollments = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q: any) => q.eq("userId", auth.userId))
      .filter((q: any) =>
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
