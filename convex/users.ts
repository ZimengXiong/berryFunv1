import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAdmin, requireAuth } from "./authHelpers";
import type { Doc } from "./_generated/dataModel";

// Security: Input validation constants
const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 20;
const MAX_ADDRESS_FIELD_LENGTH = 200;
const MAX_SEARCH_LENGTH = 100;
const MAX_SIBLING_GROUP_ID_LENGTH = 50;

/**
 * Validate and sanitize string input
 */
function sanitizeString(input: string | undefined, maxLength: number): string | undefined {
  if (input === undefined) return undefined;
  return input.trim().slice(0, maxLength);
}

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

    // Validate and sanitize inputs
    if (args.firstName !== undefined) {
      updates.firstName = sanitizeString(args.firstName, MAX_NAME_LENGTH);
    }
    if (args.lastName !== undefined) {
      updates.lastName = sanitizeString(args.lastName, MAX_NAME_LENGTH);
    }
    if (args.phone !== undefined) {
      updates.phone = sanitizeString(args.phone, MAX_PHONE_LENGTH);
    }
    if (args.address !== undefined) {
      updates.address = {
        street: args.address.street.trim().slice(0, MAX_ADDRESS_FIELD_LENGTH),
        city: args.address.city.trim().slice(0, MAX_ADDRESS_FIELD_LENGTH),
        state: args.address.state.trim().slice(0, MAX_ADDRESS_FIELD_LENGTH),
        zip: args.address.zip.trim().slice(0, 20),
      };
    }

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

    // Validate limit to prevent resource exhaustion
    const limit = Math.min(Math.max(args.limit || 20, 1), 100);

    // Sanitize search input
    const search = args.search?.trim().slice(0, MAX_SEARCH_LENGTH);

    const users = args.role
      ? await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", args.role!)).order("desc").take(limit + 1)
      : await ctx.db.query("users").order("desc").take(limit + 1);

    const hasMore = users.length > limit;
    const results = hasMore ? users.slice(0, limit) : users;

    // Filter by search if provided (using sanitized search)
    let filteredResults = results;
    if (search) {
      const searchLower = search.toLowerCase();
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

    // Validate and sanitize inputs
    if (args.firstName !== undefined) {
      updates.firstName = sanitizeString(args.firstName, MAX_NAME_LENGTH);
    }
    if (args.lastName !== undefined) {
      updates.lastName = sanitizeString(args.lastName, MAX_NAME_LENGTH);
    }
    if (args.phone !== undefined) {
      updates.phone = sanitizeString(args.phone, MAX_PHONE_LENGTH);
    }
    if (args.isReturning !== undefined) updates.isReturning = args.isReturning;
    if (args.siblingGroupId !== undefined) {
      updates.siblingGroupId = sanitizeString(args.siblingGroupId, MAX_SIBLING_GROUP_ID_LENGTH);
    }
    if (args.role !== undefined) updates.role = args.role;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.userId, updates);

    // Log activity (redact sensitive data from logs)
    const logDetails: Record<string, unknown> = {};
    if (args.isReturning !== undefined) logDetails.isReturning = args.isReturning;
    if (args.role !== undefined) logDetails.role = args.role;
    if (args.isActive !== undefined) logDetails.isActive = args.isActive;
    if (args.firstName !== undefined) logDetails.firstNameUpdated = true;
    if (args.lastName !== undefined) logDetails.lastNameUpdated = true;
    if (args.phone !== undefined) logDetails.phoneUpdated = true;

    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "user",
      targetId: args.userId,
      action: "updated",
      details: JSON.stringify(logDetails),
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
