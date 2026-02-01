import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./authHelpers";

// Security: Input validation constants
const MAX_NAME_LENGTH = 100;
const MAX_ALLERGIES_LENGTH = 500;
const MAX_MEDICAL_NOTES_LENGTH = 1000;
const MAX_PHONE_LENGTH = 20;
const MAX_RELATIONSHIP_LENGTH = 50;

/**
 * Sanitize string input with max length
 */
function sanitize(input: string | undefined, maxLength: number): string | undefined {
  if (input === undefined) return undefined;
  return input.trim().slice(0, maxLength);
}

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

    // Validate required fields
    const firstName = args.firstName.trim().slice(0, MAX_NAME_LENGTH);
    const lastName = args.lastName.trim().slice(0, MAX_NAME_LENGTH);

    if (firstName.length === 0 || lastName.length === 0) {
      throw new Error("First name and last name are required");
    }

    const now = Date.now();

    const childId = await ctx.db.insert("children", {
      parentId: auth.userId,
      firstName,
      lastName,
      dateOfBirth: args.dateOfBirth,
      allergies: sanitize(args.allergies, MAX_ALLERGIES_LENGTH),
      medicalNotes: sanitize(args.medicalNotes, MAX_MEDICAL_NOTES_LENGTH),
      emergencyContact: args.emergencyContact ? {
        name: args.emergencyContact.name.trim().slice(0, MAX_NAME_LENGTH),
        phone: args.emergencyContact.phone.trim().slice(0, MAX_PHONE_LENGTH),
        relationship: args.emergencyContact.relationship.trim().slice(0, MAX_RELATIONSHIP_LENGTH),
      } : undefined,
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

    // Validate and sanitize inputs
    if (args.firstName !== undefined) {
      const firstName = args.firstName.trim().slice(0, MAX_NAME_LENGTH);
      if (firstName.length === 0) {
        throw new Error("First name cannot be empty");
      }
      updates.firstName = firstName;
    }
    if (args.lastName !== undefined) {
      const lastName = args.lastName.trim().slice(0, MAX_NAME_LENGTH);
      if (lastName.length === 0) {
        throw new Error("Last name cannot be empty");
      }
      updates.lastName = lastName;
    }
    if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
    if (args.allergies !== undefined) {
      updates.allergies = sanitize(args.allergies, MAX_ALLERGIES_LENGTH);
    }
    if (args.medicalNotes !== undefined) {
      updates.medicalNotes = sanitize(args.medicalNotes, MAX_MEDICAL_NOTES_LENGTH);
    }
    if (args.emergencyContact !== undefined) {
      updates.emergencyContact = {
        name: args.emergencyContact.name.trim().slice(0, MAX_NAME_LENGTH),
        phone: args.emergencyContact.phone.trim().slice(0, MAX_PHONE_LENGTH),
        relationship: args.emergencyContact.relationship.trim().slice(0, MAX_RELATIONSHIP_LENGTH),
      };
    }

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
