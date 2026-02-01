import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbContext = { db: any };

// Helper to get authenticated user
async function getAuthenticatedUser(
  ctx: DbContext,
  token: string
): Promise<{ userId: Id<"users">; role: "user" | "admin" } | null> {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first() as Doc<"authSessions"> | null;

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  const user = await ctx.db.get(session.userId) as Doc<"users"> | null;
  if (!user || !user.isActive) {
    return null;
  }

  return { userId: user._id, role: user.role };
}

// Helper to verify admin access
async function requireAdmin(
  ctx: DbContext,
  token: string
): Promise<Id<"users">> {
  const auth = await getAuthenticatedUser(ctx, token);
  if (!auth) {
    throw new Error("Not authenticated");
  }
  if (auth.role !== "admin") {
    throw new Error("Admin access required");
  }
  return auth.userId;
}

// MUTATION: Claim a coupon (creates credit memo, locks coupon)
export const claimCoupon = mutation({
  args: {
    token: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    const couponCode = args.code.toUpperCase().trim();

    // Find the coupon
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", couponCode))
      .first() as Doc<"coupons"> | null;

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    // Check if coupon is available
    if (coupon.status !== "available") {
      if (coupon.status === "pending" && coupon.linkedUserId === auth.userId) {
        throw new Error("You have already claimed this coupon");
      }
      throw new Error("Coupon is not available");
    }

    // Check expiration
    if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
      await ctx.db.patch(coupon._id, { status: "expired", updatedAt: Date.now() });
      throw new Error("Coupon has expired");
    }

    // Check max uses
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      await ctx.db.patch(coupon._id, { status: "disabled", updatedAt: Date.now() });
      throw new Error("Coupon has reached maximum uses");
    }

    const now = Date.now();

    // Calculate discount amount
    // For percentage coupons, we need to calculate against current draft total
    let discountAmount = coupon.discountValue;

    if (coupon.discountType === "percentage") {
      // Get total of draft enrollments
      const draftEnrollments = await ctx.db
        .query("ledgerItems")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", auth.userId).eq("status", "draft")
        )
        .filter((q) => q.eq(q.field("type"), "enrollment"))
        .collect();

      const draftTotal = draftEnrollments.reduce((sum: number, e) => sum + e.amount, 0);
      discountAmount = Math.round(draftTotal * (coupon.discountValue / 100) * 100) / 100;

      if (discountAmount === 0) {
        throw new Error("No items in cart to apply percentage discount");
      }
    }

    // Create credit memo
    const creditMemoId = await ctx.db.insert("ledgerItems", {
      userId: auth.userId,
      type: "credit_memo",
      status: "draft",
      amount: -discountAmount, // Negative amount for credit
      description: `Coupon: ${couponCode}`,
      couponId: coupon._id,
      createdAt: now,
      updatedAt: now,
    });

    // Update coupon to pending status
    await ctx.db.patch(coupon._id, {
      status: "pending",
      linkedUserId: auth.userId,
      linkedLedgerItemId: creditMemoId,
      updatedAt: now,
    });

    return {
      creditMemoId,
      discountAmount,
      discountType: coupon.discountType,
    };
  },
});

// MUTATION: Release a claimed coupon (when removing credit memo)
export const releaseCoupon = mutation({
  args: {
    token: v.string(),
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    const coupon = await ctx.db.get(args.couponId) as Doc<"coupons"> | null;
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Only the user who claimed it can release it
    if (coupon.linkedUserId !== auth.userId) {
      throw new Error("Not authorized");
    }

    if (coupon.status !== "pending") {
      throw new Error("Coupon cannot be released");
    }

    // Delete the credit memo if it exists
    if (coupon.linkedLedgerItemId) {
      const creditMemo = await ctx.db.get(coupon.linkedLedgerItemId) as Doc<"ledgerItems"> | null;
      if (creditMemo && creditMemo.status === "draft") {
        await ctx.db.delete(coupon.linkedLedgerItemId);
      }
    }

    // Release the coupon
    await ctx.db.patch(args.couponId, {
      status: "available",
      linkedUserId: undefined,
      linkedLedgerItemId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ADMIN: Create coupon
export const createCoupon = mutation({
  args: {
    token: v.string(),
    code: v.string(),
    discountValue: v.number(),
    discountType: v.union(v.literal("fixed"), v.literal("percentage")),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const code = args.code.toUpperCase().trim();

    // Check if code already exists
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first() as Doc<"coupons"> | null;

    if (existing) {
      throw new Error("Coupon code already exists");
    }

    const now = Date.now();

    const couponId = await ctx.db.insert("coupons", {
      code,
      discountValue: args.discountValue,
      discountType: args.discountType,
      status: "available",
      description: args.description?.trim(),
      maxUses: args.maxUses,
      currentUses: 0,
      expiresAt: args.expiresAt,
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "coupon",
      targetId: couponId,
      action: "created",
      createdAt: now,
    });

    return { couponId };
  },
});

// ADMIN: Update coupon
export const updateCoupon = mutation({
  args: {
    token: v.string(),
    couponId: v.id("coupons"),
    discountValue: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const coupon = await ctx.db.get(args.couponId) as Doc<"coupons"> | null;
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    const updates: Partial<Doc<"coupons">> = {
      updatedAt: Date.now(),
    };

    if (args.discountValue !== undefined) updates.discountValue = args.discountValue;
    if (args.maxUses !== undefined) updates.maxUses = args.maxUses;
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;
    if (args.description !== undefined) updates.description = args.description?.trim();

    await ctx.db.patch(args.couponId, updates);

    return { success: true };
  },
});

// ADMIN: Disable coupon
export const disableCoupon = mutation({
  args: {
    token: v.string(),
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const coupon = await ctx.db.get(args.couponId) as Doc<"coupons"> | null;
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    await ctx.db.patch(args.couponId, {
      status: "disabled",
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "coupon",
      targetId: args.couponId,
      action: "disabled",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ADMIN: List all coupons
export const listCoupons = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const coupons = args.status
      ? await ctx.db.query("coupons").withIndex("by_status", (q: any) => q.eq("status", args.status)).order("desc").collect()
      : await ctx.db.query("coupons").order("desc").collect();

    return coupons.map((coupon) => ({
      id: coupon._id,
      code: coupon.code,
      discountValue: coupon.discountValue,
      discountType: coupon.discountType,
      status: coupon.status,
      description: coupon.description,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      expiresAt: coupon.expiresAt,
      createdAt: coupon.createdAt,
    }));
  },
});

// ADMIN: Get coupon details
export const getCoupon = query({
  args: {
    token: v.string(),
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const coupon = await ctx.db.get(args.couponId) as Doc<"coupons"> | null;
    if (!coupon) {
      return null;
    }

    // Get linked user if any
    let linkedUser = null;
    if (coupon.linkedUserId) {
      const user = await ctx.db.get(coupon.linkedUserId) as Doc<"users"> | null;
      if (user) {
        linkedUser = {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
    }

    return {
      id: coupon._id,
      code: coupon.code,
      discountValue: coupon.discountValue,
      discountType: coupon.discountType,
      status: coupon.status,
      description: coupon.description,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      expiresAt: coupon.expiresAt,
      linkedUser,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  },
});

// ADMIN: Get coupon stats
export const getCouponStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const coupons = await ctx.db.query("coupons").collect();

    const totalCoupons = coupons.length;
    const availableCoupons = coupons.filter((c) => c.status === "available").length;
    const pendingCoupons = coupons.filter((c) => c.status === "pending").length;
    const consumedCoupons = coupons.filter((c) => c.status === "consumed").length;
    const totalRedemptions = coupons.reduce((sum: number, c) => sum + c.currentUses, 0);

    return {
      totalCoupons,
      availableCoupons,
      pendingCoupons,
      consumedCoupons,
      totalRedemptions,
    };
  },
});
