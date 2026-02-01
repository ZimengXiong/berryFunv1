import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAuth, requireAdmin } from "./authHelpers";
import type { Doc, Id } from "./_generated/dataModel";
import { RESERVATION_EXPIRY_MS, DEPOSIT_PER_WEEK } from "./constants";

// QUERY: Get current user's ledger items
export const getLedgerItems = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("secured"),
      v.literal("verified"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const items = args.status
      ? await ctx.db
          .query("ledgerItems")
          .withIndex("by_userId_status", (q) =>
            q.eq("userId", auth.userId).eq("status", args.status!)
          )
          .collect()
      : await ctx.db
          .query("ledgerItems")
          .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
          .collect();

    return Promise.all(
      items.map(async (item) => {
        const session = item.sessionId ? await ctx.db.get(item.sessionId) as Doc<"sessions"> | null : null;
        const child = item.childId ? await ctx.db.get(item.childId) as Doc<"children"> | null : null;
        const coupon = item.couponId ? await ctx.db.get(item.couponId) as Doc<"coupons"> | null : null;

        return {
          id: item._id,
          type: item.type,
          status: item.status,
          amount: item.amount,
          description: item.description,
          createdAt: item.createdAt,
          verifiedAt: item.verifiedAt,
          snapshotTieredDiscount: item.snapshotTieredDiscount,
          snapshotReturningCredit: item.snapshotReturningCredit,
          snapshotSiblingCredit: item.snapshotSiblingCredit,
          snapshotEarlyBirdCredit: item.snapshotEarlyBirdCredit,
          session: session ? {
            id: session._id,
            name: session.name,
            startDate: session.startDate,
            endDate: session.endDate,
            basePrice: session.basePrice,
          } : null,
          child: child ? {
            id: child._id,
            firstName: child.firstName,
            lastName: child.lastName,
          } : null,
          coupon: coupon ? {
            id: coupon._id,
            code: coupon.code,
            discountValue: coupon.discountValue,
            discountType: coupon.discountType,
          } : null,
        };
      })
    );
  },
});

// QUERY: Get draft items count (for floating action button)
export const getDraftCount = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) return 0;

    const draftItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", auth.userId).eq("status", "draft")
      )
      .collect();

    return draftItems.filter((item) => item.type === "enrollment").length;
  },
});

// MUTATION: Add session to draft ledger
export const addToLedger = mutation({
  args: {
    sessionId: v.id("sessions"),
    childId: v.optional(v.id("children")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Get session
    const session = await ctx.db.get(args.sessionId) as Doc<"sessions"> | null;
    if (!session) {
      throw new Error("Session not found");
    }

    if (!session.isActive) {
      throw new Error("Session is not available");
    }

    // Check capacity (including secured items)
    const enrolledItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "verified"),
          q.eq(q.field("status"), "secured")
        )
      )
      .collect();

    if (enrolledItems.length >= session.capacity) {
      throw new Error("Session is full");
    }

    // Check if user already has this session in their ledger
    const existingItem = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("sessionId"), args.sessionId),
          q.neq(q.field("status"), "cancelled"),
          args.childId
            ? q.eq(q.field("childId"), args.childId)
            : q.eq(q.field("childId"), undefined)
        )
      )
      .first();

    if (existingItem) {
      throw new Error("Session already in ledger");
    }

    // Verify child ownership if provided
    if (args.childId) {
      const child = await ctx.db.get(args.childId) as Doc<"children"> | null;
      if (!child || child.parentId !== auth.userId) {
        throw new Error("Child not found");
      }
    }

    const now = Date.now();

    const itemId = await ctx.db.insert("ledgerItems", {
      userId: auth.userId,
      childId: args.childId,
      sessionId: args.sessionId,
      type: "enrollment",
      status: "draft",
      amount: session.basePrice,
      createdAt: now,
      updatedAt: now,
    });

    return { itemId };
  },
});

// MUTATION: Remove item from draft ledger
export const removeFromLedger = mutation({
  args: {
    itemId: v.id("ledgerItems"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const item = await ctx.db.get(args.itemId) as Doc<"ledgerItems"> | null;
    if (!item) {
      throw new Error("Item not found");
    }

    if (item.userId !== auth.userId) {
      throw new Error("Not authorized");
    }

    if (item.status !== "draft") {
      throw new Error("Can only remove draft items");
    }

    // If it's a credit memo from a coupon, release the coupon
    if (item.type === "credit_memo" && item.couponId) {
      const coupon = await ctx.db.get(item.couponId) as Doc<"coupons"> | null;
      if (coupon && coupon.status === "pending") {
        await ctx.db.patch(item.couponId, {
          status: "available",
          linkedUserId: undefined,
          linkedLedgerItemId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(args.itemId);

    return { success: true };
  },
});

// MUTATION: Reserve draft items (locks spots, sets expiration)
export const reserveItems = mutation({
  args: {
    itemIds: v.array(v.id("ledgerItems")),
    paymentMethod: v.union(v.literal("zelle"), v.literal("cash")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const now = Date.now();
    const expiresAt = now + RESERVATION_EXPIRY_MS;
    const reservedItems: Id<"ledgerItems">[] = [];

    for (const itemId of args.itemIds) {
      const item = await ctx.db.get(itemId) as Doc<"ledgerItems"> | null;
      if (!item) {
        throw new Error("Item not found");
      }
      if (item.userId !== auth.userId) {
        throw new Error("Not authorized");
      }
      if (item.status !== "draft") {
        // Skip items that are already reserved/secured/verified
        continue;
      }

      // Check session capacity (including reserved and secured items)
      if (item.sessionId) {
        const session = await ctx.db.get(item.sessionId) as Doc<"sessions"> | null;
        if (session) {
          // Count all reserved and secured items for this session
          const reservedCount = await ctx.db
            .query("ledgerItems")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", item.sessionId))
            .filter((q) =>
              q.or(
                q.eq(q.field("status"), "reserved"),
                q.eq(q.field("status"), "secured"),
                q.eq(q.field("status"), "verified")
              )
            )
            .collect();

          if (reservedCount.length >= session.capacity) {
            throw new Error(`Session "${session.name}" is full`);
          }
        }
      }

      // Reserve the item
      await ctx.db.patch(itemId, {
        status: "reserved",
        paymentMethod: args.paymentMethod,
        reservedAt: now,
        reservationExpiresAt: expiresAt,
        updatedAt: now,
      });

      reservedItems.push(itemId);
    }

    // Calculate deposit amount
    const depositAmount = reservedItems.length * DEPOSIT_PER_WEEK;

    return {
      reservedItems,
      depositAmount,
      expiresAt,
      paymentMethod: args.paymentMethod,
    };
  },
});

// MUTATION: Release expired reservations (run periodically)
export const releaseExpiredReservations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired reservations
    const expiredItems = await ctx.db
      .query("ledgerItems")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "reserved"),
          q.lt(q.field("reservationExpiresAt"), now)
        )
      )
      .collect();

    for (const item of expiredItems) {
      await ctx.db.patch(item._id, {
        status: "draft",
        paymentMethod: undefined,
        reservedAt: undefined,
        reservationExpiresAt: undefined,
        updatedAt: now,
      });
    }

    return { releasedCount: expiredItems.length };
  },
});

// MUTATION: Cancel a verified item (admin only typically, or with restrictions)
export const cancelItem = mutation({
  args: {
    itemId: v.id("ledgerItems"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const item = await ctx.db.get(args.itemId) as Doc<"ledgerItems"> | null;
    if (!item) {
      throw new Error("Item not found");
    }

    // Users can only cancel their own items, admins can cancel any
    if (item.userId !== auth.userId && auth.role !== "admin") {
      throw new Error("Not authorized");
    }

    if (item.status === "cancelled") {
      throw new Error("Item already cancelled");
    }

    const now = Date.now();

    // Update the item status
    await ctx.db.patch(args.itemId, {
      status: "cancelled",
      description: args.reason
        ? `${item.description || ""} [Cancelled: ${args.reason}]`
        : item.description,
      updatedAt: now,
    });

    // If it was verified, decrement the session enrollment count
    if (item.status === "verified" && item.sessionId) {
      const session = await ctx.db.get(item.sessionId) as Doc<"sessions"> | null;
      if (session) {
        await ctx.db.patch(item.sessionId, {
          enrolledCount: Math.max(0, session.enrolledCount - 1),
          updatedAt: now,
        });
      }
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: auth.userId,
      targetType: "ledgerItem",
      targetId: args.itemId,
      action: "cancelled",
      details: args.reason,
      createdAt: now,
    });

    return { success: true };
  },
});

// QUERY: Get user's ledger for admin view
export const getUserLedger = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId) as Doc<"users"> | null;
    if (!user) {
      throw new Error("User not found");
    }

    const items = await ctx.db
      .query("ledgerItems")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const session = item.sessionId ? await ctx.db.get(item.sessionId) as Doc<"sessions"> | null : null;
        const child = item.childId ? await ctx.db.get(item.childId) as Doc<"children"> | null : null;

        return {
          id: item._id,
          type: item.type,
          status: item.status,
          amount: item.amount,
          description: item.description,
          createdAt: item.createdAt,
          verifiedAt: item.verifiedAt,
          snapshotTieredDiscount: item.snapshotTieredDiscount,
          snapshotReturningCredit: item.snapshotReturningCredit,
          snapshotSiblingCredit: item.snapshotSiblingCredit,
          snapshotEarlyBirdCredit: item.snapshotEarlyBirdCredit,
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

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isReturning: user.isReturning,
        siblingGroupId: user.siblingGroupId,
      },
      items: enrichedItems,
    };
  },
});
