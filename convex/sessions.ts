import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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

  const user = await ctx.db.get(session.userId) as Doc<"users"> | null;
  if (!user || !user.isActive) {
    return null;
  }

  return { userId: user._id, role: user.role };
}

// Helper to verify admin access
async function requireAdmin(
  ctx: { db: any },
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

// QUERY: List all active sessions (public)
export const listSessions = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessions = args.activeOnly !== false
      ? await ctx.db.query("sessions").withIndex("by_isActive", (q) => q.eq("isActive", true)).order("asc").collect()
      : await ctx.db.query("sessions").order("asc").collect();

    return sessions.map((session) => ({
      id: session._id,
      name: session.name,
      description: session.description,
      startDate: session.startDate,
      endDate: session.endDate,
      basePrice: session.basePrice,
      capacity: session.capacity,
      enrolledCount: session.enrolledCount,
      spotsRemaining: session.capacity - session.enrolledCount,
      ageMin: session.ageMin,
      ageMax: session.ageMax,
      location: session.location,
      imageStorageId: session.imageStorageId,
      isActive: session.isActive,
      earlyBirdDeadline: session.earlyBirdDeadline,
    }));
  },
});

// QUERY: Get single session
export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    return {
      id: session._id,
      name: session.name,
      description: session.description,
      startDate: session.startDate,
      endDate: session.endDate,
      basePrice: session.basePrice,
      capacity: session.capacity,
      enrolledCount: session.enrolledCount,
      spotsRemaining: session.capacity - session.enrolledCount,
      ageMin: session.ageMin,
      ageMax: session.ageMax,
      location: session.location,
      imageStorageId: session.imageStorageId,
      isActive: session.isActive,
      earlyBirdDeadline: session.earlyBirdDeadline,
    };
  },
});

// ADMIN: Create new session
export const createSession = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    basePrice: v.number(),
    capacity: v.number(),
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    location: v.optional(v.string()),
    earlyBirdDeadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const now = Date.now();

    const sessionId = await ctx.db.insert("sessions", {
      name: args.name.trim(),
      description: args.description?.trim(),
      startDate: args.startDate,
      endDate: args.endDate,
      basePrice: args.basePrice,
      capacity: args.capacity,
      enrolledCount: 0,
      ageMin: args.ageMin,
      ageMax: args.ageMax,
      location: args.location?.trim(),
      isActive: true,
      earlyBirdDeadline: args.earlyBirdDeadline,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "session",
      targetId: sessionId,
      action: "created",
      createdAt: now,
    });

    return { sessionId };
  },
});

// ADMIN: Update session
export const updateSession = mutation({
  args: {
    token: v.string(),
    sessionId: v.id("sessions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    basePrice: v.optional(v.number()),
    capacity: v.optional(v.number()),
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    location: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    earlyBirdDeadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined) updates.description = args.description?.trim();
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.basePrice !== undefined) updates.basePrice = args.basePrice;
    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.ageMin !== undefined) updates.ageMin = args.ageMin;
    if (args.ageMax !== undefined) updates.ageMax = args.ageMax;
    if (args.location !== undefined) updates.location = args.location?.trim();
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.earlyBirdDeadline !== undefined) updates.earlyBirdDeadline = args.earlyBirdDeadline;

    await ctx.db.patch(args.sessionId, updates);

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "session",
      targetId: args.sessionId,
      action: "updated",
      details: JSON.stringify(updates),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ADMIN: Delete session (soft delete by setting inactive)
export const deleteSession = mutation({
  args: {
    token: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx, args.token);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Check if session has enrollments
    const enrollments = await ctx.db
      .query("ledgerItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (enrollments) {
      // Soft delete
      await ctx.db.patch(args.sessionId, {
        isActive: false,
        updatedAt: Date.now(),
      });
    } else {
      // Hard delete if no enrollments
      await ctx.db.delete(args.sessionId);
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: adminId,
      targetType: "session",
      targetId: args.sessionId,
      action: enrollments ? "deactivated" : "deleted",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ADMIN: Get session enrollments
export const getSessionEnrollments = query({
  args: {
    token: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const ledgerItems = await ctx.db
      .query("ledgerItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const enrollments = await Promise.all(
      ledgerItems.map(async (item) => {
        const user = await ctx.db.get(item.userId) as Doc<"users"> | null;
        const child = item.childId ? await ctx.db.get(item.childId) as Doc<"children"> | null : null;

        return {
          id: item._id,
          status: item.status,
          amount: item.amount,
          createdAt: item.createdAt,
          user: user ? {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
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
      session: {
        id: session._id,
        name: session.name,
        capacity: session.capacity,
        enrolledCount: session.enrolledCount,
      },
      enrollments,
    };
  },
});

// ADMIN: Get session stats
export const getSessionStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const sessions = await ctx.db.query("sessions").collect();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.isActive).length;
    const totalCapacity = sessions.reduce((sum, s) => sum + s.capacity, 0);
    const totalEnrolled = sessions.reduce((sum, s) => sum + s.enrolledCount, 0);

    return {
      totalSessions,
      activeSessions,
      totalCapacity,
      totalEnrolled,
      utilizationRate: totalCapacity > 0 ? (totalEnrolled / totalCapacity * 100).toFixed(1) : 0,
    };
  },
});

// ADMIN: Upload session image
export const setSessionImage = mutation({
  args: {
    token: v.string(),
    sessionId: v.id("sessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    await ctx.db.patch(args.sessionId, {
      imageStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
