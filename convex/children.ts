import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Helper to get authenticated user
async function getAuthenticatedUser(
  ctx: { db: any },
  token: string
): Promise<Id<"users"> | null> {
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

  return user._id;
}

// QUERY: Get all children for current user
export const getChildren = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.token);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const children = await ctx.db
      .query("children")
      .withIndex("by_parentId", (q: any) => q.eq("parentId", userId))
      .collect();

    return children.map((child: any) => ({
      id: child._id,
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth,
      allergies: child.allergies,
      medicalNotes: child.medicalNotes,
      emergencyContact: child.emergencyContact,
      createdAt: child.createdAt,
    }));
  },
});

// MUTATION: Add a child
export const addChild = mutation({
  args: {
    token: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medicalNotes: v.optional(v.string()),
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.token);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();

    const childId = await ctx.db.insert("children", {
      parentId: userId,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      dateOfBirth: args.dateOfBirth,
      allergies: args.allergies?.trim(),
      medicalNotes: args.medicalNotes?.trim(),
      emergencyContact: args.emergencyContact,
      createdAt: now,
      updatedAt: now,
    });

    return { childId };
  },
});

// MUTATION: Update a child
export const updateChild = mutation({
  args: {
    token: v.string(),
    childId: v.id("children"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medicalNotes: v.optional(v.string()),
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.token);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify ownership
    if (child.parentId !== userId) {
      throw new Error("Not authorized");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
    if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
    if (args.allergies !== undefined) updates.allergies = args.allergies?.trim();
    if (args.medicalNotes !== undefined) updates.medicalNotes = args.medicalNotes?.trim();
    if (args.emergencyContact !== undefined) updates.emergencyContact = args.emergencyContact;

    await ctx.db.patch(args.childId, updates);

    return { success: true };
  },
});

// MUTATION: Remove a child
export const removeChild = mutation({
  args: {
    token: v.string(),
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUser(ctx, args.token);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify ownership
    if (child.parentId !== userId) {
      throw new Error("Not authorized");
    }

    // Check if child has any ledger items
    const ledgerItems = await ctx.db
      .query("ledgerItems")
      .filter((q: any) => q.eq(q.field("childId"), args.childId))
      .first();

    if (ledgerItems) {
      throw new Error("Cannot delete child with existing enrollments");
    }

    await ctx.db.delete(args.childId);

    return { success: true };
  },
});
