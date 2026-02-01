import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./authHelpers";

// QUERY: Get all children for current user
export const getChildren = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    const children = await ctx.db
      .query("children")
      .withIndex("by_parentId", (q) => q.eq("parentId", auth.userId))
      .collect();

    return children.map((child) => ({
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
    const auth = await requireAuth(ctx);

    const now = Date.now();

    const childId = await ctx.db.insert("children", {
      parentId: auth.userId,
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
    const auth = await requireAuth(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify ownership
    if (child.parentId !== auth.userId) {
      throw new Error("Not authorized");
    }

    const updates: Record<string, unknown> = {
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
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }

    // Verify ownership
    if (child.parentId !== auth.userId) {
      throw new Error("Not authorized");
    }

    // Check if child has any ledger items
    const ledgerItems = await ctx.db
      .query("ledgerItems")
      .filter((q) => q.eq(q.field("childId"), args.childId))
      .first();

    if (ledgerItems) {
      throw new Error("Cannot delete child with existing enrollments");
    }

    await ctx.db.delete(args.childId);

    return { success: true };
  },
});
