import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAdmin } from "./authHelpers";
import type { Doc } from "./_generated/dataModel";

// Security: Input validation constants
const MAX_COUPON_CODE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;

// MUTATION: Claim a coupon (creates credit memo, locks coupon)
export const claimCoupon = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Input validation
    if (args.code.length > MAX_COUPON_CODE_LENGTH) {
      throw new Error("Invalid coupon code");
    }

    const couponCode = args.code.toUpperCase().trim();

    // Prevent empty codes
    if (couponCode.length === 0) {
      throw new Error("Invalid coupon code");
    }

    // Find the coupon
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", couponCode))
      .first() as Doc<"coupons"> | null;

    // Security: Use consistent error message to prevent coupon enumeration
    const genericError = "Coupon code is invalid or unavailable";

    if (!coupon) {
      throw new Error(genericError);
    }

    // Check if user already claimed this coupon
    if (coupon.status === "pending" && coupon.linkedUserId === auth.userId) {
      throw new Error("You have already claimed this coupon");
    }

    // Check if coupon is available (use generic error to prevent status enumeration)
    if (coupon.status !== "available") {
      throw new Error(genericError);
    }

    // Check expiration (use generic error)
    if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
      await ctx.db.patch(coupon._id, { status: "expired", updatedAt: Date.now() });
      throw new Error(genericError);
    }

    // Check max uses (use generic error)
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      await ctx.db.patch(coupon._id, { status: "disabled", updatedAt: Date.now() });
      throw new Error(genericError);
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
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

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
    code: v.string(),
    discountValue: v.number(),
    discountType: v.union(v.literal("fixed"), v.literal("percentage")),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    // Input validation
    if (args.code.length > MAX_COUPON_CODE_LENGTH) {
      throw new Error(`Coupon code must be ${MAX_COUPON_CODE_LENGTH} characters or less`);
    }
    if (args.description && args.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
    }
    if (args.discountValue <= 0) {
      throw new Error("Discount value must be positive");
    }
    if (args.discountType === "percentage" && args.discountValue > 100) {
      throw new Error("Percentage discount cannot exceed 100%");
    }
    if (args.maxUses !== undefined && args.maxUses <= 0) {
      throw new Error("Max uses must be positive");
    }

    const code = args.code.toUpperCase().trim();

    if (code.length === 0) {
      throw new Error("Coupon code cannot be empty");
    }

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
      description: args.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH),
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
    couponId: v.id("coupons"),
    discountValue: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

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
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const coupons = args.status
      ? await ctx.db.query("coupons").withIndex("by_status", (q) => q.eq("status", args.status as "available" | "pending" | "consumed" | "expired" | "disabled")).order("desc").collect()
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
    couponId: v.id("coupons"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

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
