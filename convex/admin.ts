import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getTieredDiscount,
  RETURNING_CREDIT_PER_WEEK,
  SIBLING_CREDIT_PER_WEEK,
  EARLY_BIRD_DISCOUNT_PERCENT,
} from "./constants";

// Helper to verify admin access
async function requireAdmin(
  ctx: { db: any },
  token: string
): Promise<Id<"users">> {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first() as Doc<"authSessions"> | null;

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(session.userId) as Doc<"users"> | null;
  if (!user || !user.isActive) {
    throw new Error("Not authenticated");
  }

  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }

  return user._id;
}

// MUTATION: Verify receipt (items → verified, snapshots discounts)
export const verifyReceipt = mutation({
  args: {
    token: v.string(),
    receiptId: v.id("receipts"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (receipt.status !== "pending") {
      throw new Error("Receipt is not pending");
    }

    const now = Date.now();

    // Get user for discount calculations
    const user = await ctx.db.get(receipt.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all user's non-cancelled enrollments for tier calculation
    const allEnrollments = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q: any) => q.eq("userId", receipt.userId))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("type"), "enrollment"),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .collect();

    const totalWeekCount = allEnrollments.length;
    const tieredDiscount = getTieredDiscount(totalWeekCount);

    // Calculate per-item discount share
    const itemCount = receipt.linkedLedgerItems.length;
    const perItemTieredDiscount = itemCount > 0 ? tieredDiscount / totalWeekCount : 0;

    // Update each linked ledger item
    for (const itemId of receipt.linkedLedgerItems) {
      const item = await ctx.db.get(itemId);
      if (!item) continue;

      // Calculate this item's early bird credit
      let earlyBirdCredit = 0;
      if (item.sessionId) {
        const session = await ctx.db.get(item.sessionId);
        if (session && session.earlyBirdDeadline) {
          if (item.createdAt < session.earlyBirdDeadline) {
            earlyBirdCredit = item.amount * (EARLY_BIRD_DISCOUNT_PERCENT / 100);
          }
        }
      }

      // Update item to verified with snapshotted discounts
      await ctx.db.patch(itemId, {
        status: "verified",
        snapshotTieredDiscount: perItemTieredDiscount,
        snapshotReturningCredit: user.isReturning ? RETURNING_CREDIT_PER_WEEK : 0,
        snapshotSiblingCredit: user.siblingGroupId ? SIBLING_CREDIT_PER_WEEK : 0,
        snapshotEarlyBirdCredit: earlyBirdCredit,
        verifiedAt: now,
        updatedAt: now,
      });

      // Increment session enrollment count for enrollment items
      if (item.type === "enrollment" && item.sessionId) {
        const session = await ctx.db.get(item.sessionId);
        if (session) {
          await ctx.db.patch(item.sessionId, {
            enrolledCount: session.enrolledCount + 1,
            updatedAt: now,
          });
        }
      }
    }

    // Consume any pending coupons linked to the verified items
    for (const itemId of receipt.linkedLedgerItems) {
      const item = await ctx.db.get(itemId);
      if (item && item.couponId) {
        const coupon = await ctx.db.get(item.couponId);
        if (coupon && coupon.status === "pending") {
          await ctx.db.patch(item.couponId, {
            status: "consumed",
            currentUses: coupon.currentUses + 1,
            updatedAt: now,
          });
        }
      }
    }

    // Update receipt
    await ctx.db.patch(args.receiptId, {
      status: "verified",
      verifiedBy: adminId,
      adminNotes: args.adminNotes?.trim(),
      verifiedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "receipt",
      targetId: args.receiptId,
      action: "verified",
      createdAt: now,
    });

    return { success: true };
  },
});

// MUTATION: Deny receipt (items → draft, releases coupons)
export const denyReceipt = mutation({
  args: {
    token: v.string(),
    receiptId: v.id("receipts"),
    denialReason: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (receipt.status !== "pending") {
      throw new Error("Receipt is not pending");
    }

    const now = Date.now();

    // Revert each linked ledger item to draft
    for (const itemId of receipt.linkedLedgerItems) {
      const item = await ctx.db.get(itemId);
      if (!item) continue;

      await ctx.db.patch(itemId, {
        status: "draft",
        receiptId: undefined,
        updatedAt: now,
      });

      // Release any pending coupons
      if (item.couponId) {
        const coupon = await ctx.db.get(item.couponId);
        if (coupon && coupon.status === "pending") {
          await ctx.db.patch(item.couponId, {
            status: "available",
            linkedUserId: undefined,
            linkedLedgerItemId: undefined,
            updatedAt: now,
          });
        }
      }
    }

    // Update receipt
    await ctx.db.patch(args.receiptId, {
      status: "denied",
      verifiedBy: adminId,
      denialReason: args.denialReason.trim(),
      adminNotes: args.adminNotes?.trim(),
      verifiedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "receipt",
      targetId: args.receiptId,
      action: "denied",
      details: args.denialReason,
      createdAt: now,
    });

    return { success: true };
  },
});

// QUERY: Get dashboard overview stats
export const getDashboardStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    // Get counts
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const receipts = await ctx.db.query("receipts").collect();
    const ledgerItems = await ctx.db.query("ledgerItems").collect();

    // Calculate stats
    const totalUsers = users.length;
    const activeUsers = users.filter((u: any) => u.isActive).length;

    const activeSessions = sessions.filter((s: any) => s.isActive).length;
    const totalEnrollments = ledgerItems.filter(
      (i: any) => i.type === "enrollment" && i.status === "verified"
    ).length;

    const pendingReceipts = receipts.filter((r: any) => r.status === "pending").length;
    const totalRevenue = receipts
      .filter((r: any) => r.status === "verified")
      .reduce((sum: number, r: any) => sum + r.amount, 0);

    // Recent activity
    const recentActivity = await ctx.db
      .query("activityLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);

    const enrichedActivity = await Promise.all(
      recentActivity.map(async (activity: any) => {
        let userName = "System";
        if (activity.userId) {
          const user = await ctx.db.get(activity.userId) as Doc<"users"> | null;
          if (user) {
            userName = `${user.firstName} ${user.lastName}`;
          }
        }

        return {
          id: activity._id,
          userName,
          action: activity.action,
          targetType: activity.targetType,
          createdAt: activity.createdAt,
        };
      })
    );

    return {
      totalUsers,
      activeUsers,
      activeSessions,
      totalEnrollments,
      pendingReceipts,
      totalRevenue,
      recentActivity: enrichedActivity,
    };
  },
});

// QUERY: Get activity log
export const getActivityLog = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
    targetType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const limit = args.limit || 50;

    let query;
    if (args.targetType) {
      query = ctx.db
        .query("activityLog")
        .withIndex("by_targetType", (q: any) => q.eq("targetType", args.targetType));
    } else {
      query = ctx.db.query("activityLog").withIndex("by_createdAt");
    }

    const activities = await query.order("desc").take(limit);

    return Promise.all(
      activities.map(async (activity: any) => {
        let userName = "System";
        if (activity.userId) {
          const user = await ctx.db.get(activity.userId) as Doc<"users"> | null;
          if (user) {
            userName = `${user.firstName} ${user.lastName}`;
          }
        }

        return {
          id: activity._id,
          userName,
          userId: activity.userId,
          action: activity.action,
          targetType: activity.targetType,
          targetId: activity.targetId,
          details: activity.details,
          createdAt: activity.createdAt,
        };
      })
    );
  },
});

// MUTATION: Create admin credit memo for a user
export const createCreditMemo = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    const itemId = await ctx.db.insert("ledgerItems", {
      userId: args.userId,
      type: "credit_memo",
      status: "verified", // Admin credits are immediately verified
      amount: -Math.abs(args.amount), // Ensure negative for credit
      description: args.description.trim(),
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "ledgerItem",
      targetId: itemId,
      action: "admin_credit",
      details: `$${args.amount} credit for ${user.email}: ${args.description}`,
      createdAt: now,
    });

    return { itemId };
  },
});

// ADMIN: Get all verified orders
export const getVerifiedOrders = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const limit = args.limit || 50;

    const items = await ctx.db
      .query("ledgerItems")
      .withIndex("by_status", (q: any) => q.eq("status", "verified"))
      .order("desc")
      .take(limit);

    return Promise.all(
      items.map(async (item: any) => {
        const user = await ctx.db.get(item.userId) as Doc<"users"> | null;
        const session = item.sessionId ? await ctx.db.get(item.sessionId) as Doc<"sessions"> | null : null;
        const child = item.childId ? await ctx.db.get(item.childId) as Doc<"children"> | null : null;

        return {
          id: item._id,
          type: item.type,
          amount: item.amount,
          description: item.description,
          verifiedAt: item.verifiedAt,
          snapshotTieredDiscount: item.snapshotTieredDiscount,
          snapshotReturningCredit: item.snapshotReturningCredit,
          snapshotSiblingCredit: item.snapshotSiblingCredit,
          snapshotEarlyBirdCredit: item.snapshotEarlyBirdCredit,
          user: user ? {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          } : null,
          session: session ? {
            id: session._id,
            name: session.name,
            startDate: session.startDate,
          } : null,
          child: child ? {
            id: child._id,
            firstName: child.firstName,
            lastName: child.lastName,
          } : null,
        };
      })
    );
  },
});
