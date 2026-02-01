import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAuth, requireAdmin } from "./authHelpers";
import type { Doc } from "./_generated/dataModel";

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// MUTATION: Generate upload URL with file type validation
export const generateUploadUrl = mutation({
  args: {
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Validate MIME type if provided
    if (args.mimeType && !ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new Error("File type not allowed. Accepted: JPEG, PNG, GIF, WebP, PDF");
    }

    // Validate file size if provided
    if (args.fileSize && args.fileSize > MAX_FILE_SIZE) {
      throw new Error("File too large. Maximum size: 10MB");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// QUERY: Get file URL - requires authentication and ownership verification
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    // Admins can access any file
    if (auth.role === "admin") {
      return await ctx.storage.getUrl(args.storageId);
    }

    // For regular users, verify they own a receipt with this storageId
    const receipt = await ctx.db
      .query("receipts")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first() as Doc<"receipts"> | null;

    if (!receipt) {
      // Check if it's a session image (public)
      const session = await ctx.db
        .query("sessions")
        .filter((q) => q.eq(q.field("imageStorageId"), args.storageId))
        .first();

      if (session) {
        return await ctx.storage.getUrl(args.storageId);
      }

      throw new Error("File not found or access denied");
    }

    if (receipt.userId !== auth.userId) {
      throw new Error("Access denied");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

// MUTATION: Delete file (admin only for receipts, or own files)
export const deleteFile = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.storage.delete(args.storageId);
    return { success: true };
  },
});
