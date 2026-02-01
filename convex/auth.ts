import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
import { generateToken, generateReferralCode, isValidEmail } from "./helpers";
import { SESSION_TOKEN_EXPIRY_MS, MIN_PASSWORD_LENGTH } from "./constants";

// ACTION: Hash password using bcrypt (runs in Node.js)
export const hashPassword = action({
  args: { password: v.string() },
  handler: async (_, args) => {
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const bcrypt = await import("bcryptjs");
    return await bcrypt.hash(args.password, 12);
  },
});

// ACTION: Verify password
export const verifyPassword = action({
  args: { password: v.string(), hash: v.string() },
  handler: async (_, args) => {
    const bcrypt = await import("bcryptjs");
    return await bcrypt.compare(args.password, args.hash);
  },
});

// ACTION: Login with password (full flow)
export const loginWithPassword = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{
    userId: string;
    token: string;
    expiresAt: number;
    user: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isReturning: boolean;
      siblingGroupId?: string;
      referralCode?: string;
    };
  }> => {
    const { internal } = await import("./_generated/api");
    const bcrypt = await import("bcryptjs");

    // Get user by email
    const userData = await ctx.runQuery(internal.auth.getUserByEmailInternal, {
      email: args.email,
    }) as { userId: string; passwordHash: string; isActive: boolean } | null;

    if (!userData) {
      throw new Error("Invalid credentials");
    }

    if (!userData.isActive) {
      throw new Error("Account is disabled");
    }

    // Verify password
    const isValid = await bcrypt.compare(args.password, userData.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    // Create session
    const result = await ctx.runMutation(internal.auth.loginInternal, {
      email: args.email,
    });

    return result;
  },
});

// MUTATION: Register new user
export const register = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    if (!isValidEmail(email)) {
      throw new Error("Invalid email format");
    }

    // Check if email exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", email))
      .first();

    if (existing) {
      throw new Error("Email already registered");
    }

    const now = Date.now();

    // Handle referral
    let referredBy = undefined;
    if (args.referralCode) {
      const referrer = await ctx.db
        .query("users")
        .withIndex("by_referralCode", q => q.eq("referralCode", args.referralCode))
        .first();
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Generate unique referral code
    const userReferralCode = generateReferralCode();

    const userId = await ctx.db.insert("users", {
      email,
      passwordHash: args.passwordHash,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      phone: args.phone?.trim(),
      role: "user",
      isReturning: false,
      referralCode: userReferralCode,
      referralClaimed: false,
      hasUsedReferral: false,
      referredBy,
      isActive: true,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create session token
    const token = generateToken();
    const expiresAt = now + SESSION_TOKEN_EXPIRY_MS;

    await ctx.db.insert("authSessions", {
      userId,
      token,
      expiresAt,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId,
      targetType: "user",
      targetId: userId,
      action: "registered",
      createdAt: now,
    });

    return { userId, token, expiresAt };
  },
});

// QUERY: Get user by email (for login flow)
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase().trim()))
      .first();

    if (!user) return null;

    return {
      userId: user._id,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
    };
  },
});

// INTERNAL QUERY: Get user by email (for loginWithPassword action)
export const getUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase().trim()))
      .first();

    if (!user) return null;

    return {
      userId: user._id,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
    };
  },
});

// MUTATION: Login (after password verification)
export const login = mutation({
  args: {
    email: v.string(),
    isPasswordValid: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase().trim()))
      .first();

    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    const now = Date.now();
    const token = generateToken();
    const expiresAt = now + SESSION_TOKEN_EXPIRY_MS;

    await ctx.db.insert("authSessions", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: user._id,
      targetType: "user",
      targetId: user._id,
      action: "logged_in",
      createdAt: now,
    });

    return {
      userId: user._id,
      token,
      expiresAt,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isReturning: user.isReturning,
        siblingGroupId: user.siblingGroupId,
        referralCode: user.referralCode,
      },
    };
  },
});

// INTERNAL MUTATION: Login (for loginWithPassword action)
export const loginInternal = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase().trim()))
      .first();

    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    const now = Date.now();
    const token = generateToken();
    const expiresAt = now + SESSION_TOKEN_EXPIRY_MS;

    await ctx.db.insert("authSessions", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: user._id,
      targetType: "user",
      targetId: user._id,
      action: "logged_in",
      createdAt: now,
    });

    return {
      userId: user._id,
      token,
      expiresAt,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isReturning: user.isReturning,
        siblingGroupId: user.siblingGroupId,
        referralCode: user.referralCode,
      },
    };
  },
});

// QUERY: Validate session token
export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return {
      userId: user._id,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isReturning: user.isReturning,
        siblingGroupId: user.siblingGroupId,
        referralCode: user.referralCode,
        phone: user.phone,
        address: user.address,
      },
    };
  },
});

// MUTATION: Logout
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// MUTATION: Logout all sessions for a user
export const logoutAll = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .first();

    if (!session) {
      throw new Error("Invalid session");
    }

    const allSessions = await ctx.db
      .query("authSessions")
      .withIndex("by_userId", q => q.eq("userId", session.userId))
      .collect();

    for (const s of allSessions) {
      await ctx.db.delete(s._id);
    }
  },
});

// MUTATION: Clean up expired sessions
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredSessions = await ctx.db
      .query("authSessions")
      .withIndex("by_expiresAt")
      .filter(q => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { deletedCount: expiredSessions.length };
  },
});
