import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./authHelpers";
import type { Doc } from "./_generated/dataModel";
import {
  getTieredDiscount,
  RETURNING_CREDIT_PER_WEEK,
  SIBLING_CREDIT_PER_WEEK,
  EARLY_BIRD_DISCOUNT_PERCENT,
} from "./constants";

// MUTATION: Verify receipt (items → verified, snapshots discounts)
// For paired receipts (Zelle + Cash), only the first verification processes ledger items
export const verifyReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (receipt.status !== "pending") {
      throw new Error("Receipt is not pending");
    }

    const now = Date.now();

    // Check if ledger items are already verified (by related receipt)
    // This happens when: Zelle verified first, then cash; or vice versa
    const firstItem = receipt.linkedLedgerItems.length > 0
      ? await ctx.db.get(receipt.linkedLedgerItems[0])
      : null;
    const itemsAlreadyVerified = firstItem?.status === "verified";

    if (!itemsAlreadyVerified) {
      // Get user for discount calculations
      const user = await ctx.db.get(receipt.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get all user's non-cancelled enrollments for tier calculation
      const allEnrollments = await ctx.db
        .query("ledgerItems")
        .withIndex("by_userId", (q) => q.eq("userId", receipt.userId))
        .filter((q) =>
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
      details: itemsAlreadyVerified ? "Payment tracking only (items already verified)" : undefined,
      createdAt: now,
    });

    return { success: true };
  },
});

// MUTATION: Deny receipt (items → draft, releases coupons)
// For paired receipts, denying the Zelle deposit also denies the cash receipt
export const denyReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    denialReason: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

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

    // If this is a Zelle receipt, also deny the related cash receipt
    // (Cash receipts point to Zelle via relatedReceiptId, so we search for any receipt pointing to this one)
    if (receipt.receiptType === "zelle" || !receipt.receiptType) {
      const relatedCashReceipts = await ctx.db
        .query("receipts")
        .filter((q) =>
          q.and(
            q.eq(q.field("relatedReceiptId"), args.receiptId),
            q.eq(q.field("status"), "pending")
          )
        )
        .collect();

      for (const cashReceipt of relatedCashReceipts) {
        await ctx.db.patch(cashReceipt._id, {
          status: "denied",
          verifiedBy: adminId,
          denialReason: "Related Zelle deposit was denied",
          adminNotes: args.adminNotes?.trim(),
          verifiedAt: now,
        });

        // Log activity for cash receipt denial
        await ctx.db.insert("activityLog", {
          userId: adminId,
          targetType: "receipt",
          targetId: cashReceipt._id,
          action: "denied",
          details: "Auto-denied: Related Zelle deposit was denied",
          createdAt: now,
        });
      }
    }

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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get counts
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const receipts = await ctx.db.query("receipts").collect();
    const ledgerItems = await ctx.db.query("ledgerItems").collect();

    // Calculate stats
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive !== false).length;

    const activeSessions = sessions.filter((s) => s.isActive).length;
    const totalEnrollments = ledgerItems.filter(
      (i) => i.type === "enrollment" && i.status === "verified"
    ).length;

    const pendingReceipts = receipts.filter((r) => r.status === "pending").length;
    const totalRevenue = receipts
      .filter((r) => r.status === "verified")
      .reduce((sum: number, r) => sum + r.amount, 0);

    // Recent activity
    const recentActivity = await ctx.db
      .query("activityLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);

    const enrichedActivity = await Promise.all(
      recentActivity.map(async (activity) => {
        let userName = "System";
        if (activity.userId) {
          const user = await ctx.db.get(activity.userId) as Doc<"users"> | null;
          if (user) {
            userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User";
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
    limit: v.optional(v.number()),
    targetType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit || 50;

    let queryBuilder;
    if (args.targetType) {
      queryBuilder = ctx.db
        .query("activityLog")
        .withIndex("by_targetType", (q) => q.eq("targetType", args.targetType!));
    } else {
      queryBuilder = ctx.db.query("activityLog").withIndex("by_createdAt");
    }

    const activities = await queryBuilder.order("desc").take(limit);

    return Promise.all(
      activities.map(async (activity) => {
        let userName = "System";
        if (activity.userId) {
          const user = await ctx.db.get(activity.userId) as Doc<"users"> | null;
          if (user) {
            userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User";
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
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit || 50;

    const items = await ctx.db
      .query("ledgerItems")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .order("desc")
      .take(limit);

    return Promise.all(
      items.map(async (item) => {
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
