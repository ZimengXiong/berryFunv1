import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAdmin, requireAuth } from "./authHelpers";
import type { Doc } from "./_generated/dataModel";

// QUERY: Get current user profile
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      return null;
    }

    const user = await ctx.db.get(auth.userId) as Doc<"users"> | null;
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      isReturning: user.isReturning,
      siblingGroupId: user.siblingGroupId,
      referralCode: user.referralCode,
      referralClaimed: user.referralClaimed,
      hasUsedReferral: user.hasUsedReferral,
      emailVerified: !!user.emailVerificationTime,
      createdAt: user.createdAt,
      image: user.image,
    };
  },
});

// MUTATION: Update current user profile
export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const updates: Partial<Doc<"users">> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
    if (args.phone !== undefined) updates.phone = args.phone?.trim();
    if (args.address !== undefined) updates.address = args.address;

    await ctx.db.patch(auth.userId, updates);

    return { success: true };
  },
});

// ADMIN: List all users with pagination
export const listUsers = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit || 20;

    const users = args.role
      ? await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", args.role!)).order("desc").take(limit + 1)
      : await ctx.db.query("users").order("desc").take(limit + 1);

    const hasMore = users.length > limit;
    const results = hasMore ? users.slice(0, limit) : users;

    // Filter by search if provided
    let filteredResults = results;
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredResults = results.filter((user) =>
        (user.email?.toLowerCase().includes(searchLower)) ||
        (user.firstName?.toLowerCase().includes(searchLower)) ||
        (user.lastName?.toLowerCase().includes(searchLower))
      );
    }

    return {
      users: filteredResults.map((user) => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        isReturning: user.isReturning,
        createdAt: user.createdAt,
      })),
      hasMore,
    };
  },
});

// ADMIN: Get single user details
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId) as Doc<"users"> | null;
    if (!user) {
      throw new Error("User not found");
    }

    // Get user's children
    const children = await ctx.db
      .query("children")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.userId))
      .collect();

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      isReturning: user.isReturning,
      siblingGroupId: user.siblingGroupId,
      referralCode: user.referralCode,
      referralClaimed: user.referralClaimed,
      hasUsedReferral: user.hasUsedReferral,
      emailVerified: !!user.emailVerificationTime,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      children: children.map((child) => ({
        id: child._id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
      })),
    };
  },
});

// ADMIN: Update user details
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    isReturning: v.optional(v.boolean()),
    siblingGroupId: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId) as Doc<"users"> | null;
    if (!user) {
      throw new Error("User not found");
    }

    const updates: Partial<Doc<"users">> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
    if (args.phone !== undefined) updates.phone = args.phone?.trim();
    if (args.isReturning !== undefined) updates.isReturning = args.isReturning;
    if (args.siblingGroupId !== undefined) updates.siblingGroupId = args.siblingGroupId;
    if (args.role !== undefined) updates.role = args.role;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.userId, updates);

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "user",
      targetId: args.userId,
      action: "updated",
      details: JSON.stringify(updates),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Get user stats for admin dashboard
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allUsers = await ctx.db.query("users").collect();

    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter((u) => u.isActive !== false).length;
    const adminUsers = allUsers.filter((u) => u.role === "admin").length;
    const returningUsers = allUsers.filter((u) => u.isReturning).length;

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      returningUsers,
    };
  },
});

// QUERY: Get current user for auth context
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      return null;
    }

    const user = await ctx.db.get(auth.userId);
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      role: user.role ?? "user",
      isReturning: user.isReturning ?? false,
      siblingGroupId: user.siblingGroupId,
      referralCode: user.referralCode,
      phone: user.phone,
      address: user.address,
      image: user.image,
    };
  },
});
