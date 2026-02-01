import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAuth, requireAdmin } from "./authHelpers";
import type { Doc, Id } from "./_generated/dataModel";

// MUTATION: Submit receipt (secures draft items)
// When cashBalanceAmount is provided, creates TWO receipts:
// 1. Zelle deposit receipt (with image)
// 2. Cash balance receipt (no image, to collect in person)
export const submitReceipt = mutation({
  args: {
    storageId: v.id("_storage"),
    amount: v.number(),
    paymentMethod: v.optional(v.string()),
    transactionRef: v.optional(v.string()),
    ledgerItemIds: v.array(v.id("ledgerItems")),
    cashBalanceAmount: v.optional(v.number()),  // If provided, creates cash receipt for remaining balance
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (args.ledgerItemIds.length === 0) {
      throw new Error("No items to secure");
    }

    // Verify all items belong to user and are in draft status
    for (const itemId of args.ledgerItemIds) {
      const item = await ctx.db.get(itemId) as Doc<"ledgerItems"> | null;
      if (!item) {
        throw new Error("Ledger item not found");
      }
      if (item.userId !== auth.userId) {
        throw new Error("Not authorized");
      }
      if (item.status !== "draft" && item.status !== "reserved") {
        throw new Error("Item must be in draft or reserved status");
      }
    }

    const now = Date.now();
    const isCashOption = args.cashBalanceAmount !== undefined && args.cashBalanceAmount > 0;

    // Create Zelle receipt (always has image)
    const zelleReceiptId = await ctx.db.insert("receipts", {
      userId: auth.userId,
      storageId: args.storageId,
      status: "pending",
      amount: args.amount,
      paymentMethod: args.paymentMethod?.trim(),
      transactionRef: args.transactionRef?.trim(),
      receiptType: "zelle",
      linkedLedgerItems: args.ledgerItemIds,
      createdAt: now,
    });

    // If cash option selected, create a second receipt for the cash balance
    let cashReceiptId: Id<"receipts"> | undefined;
    if (isCashOption) {
      cashReceiptId = await ctx.db.insert("receipts", {
        userId: auth.userId,
        // No storageId - cash receipts have no image
        status: "pending",
        amount: args.cashBalanceAmount!,
        paymentMethod: "cash",
        receiptType: "cash",
        relatedReceiptId: zelleReceiptId,  // Link to Zelle deposit
        linkedLedgerItems: args.ledgerItemIds,  // Same items
        createdAt: now,
      });
    }

    // Update all linked items to secured status
    // Link to Zelle receipt (primary receipt)
    for (const itemId of args.ledgerItemIds) {
      await ctx.db.patch(itemId, {
        status: "secured",
        receiptId: zelleReceiptId,
        updatedAt: now,
      });
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: auth.userId,
      targetType: "receipt",
      targetId: zelleReceiptId,
      action: "submitted",
      details: isCashOption
        ? `Zelle deposit: $${args.amount}, Cash balance: $${args.cashBalanceAmount}, Items: ${args.ledgerItemIds.length}`
        : `Amount: $${args.amount}, Items: ${args.ledgerItemIds.length}`,
      createdAt: now,
    });

    return {
      receiptId: zelleReceiptId,
      cashReceiptId,
    };
  },
});

// QUERY: Get user's receipts
export const getReceipts = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const receipts = args.status
      ? await ctx.db
          .query("receipts")
          .withIndex("by_userId_status", (q) =>
            q.eq("userId", auth.userId).eq("status", args.status as "pending" | "verified" | "denied")
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("receipts")
          .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
          .order("desc")
          .collect();

    return receipts.map((receipt) => ({
      id: receipt._id,
      status: receipt.status,
      amount: receipt.amount,
      paymentMethod: receipt.paymentMethod,
      transactionRef: receipt.transactionRef,
      linkedLedgerItems: receipt.linkedLedgerItems,
      denialReason: receipt.denialReason,
      createdAt: receipt.createdAt,
      verifiedAt: receipt.verifiedAt,
    }));
  },
});

// QUERY: Get single receipt with details
export const getReceipt = query({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    const receipt = await ctx.db.get(args.receiptId) as Doc<"receipts"> | null;
    if (!receipt) {
      return null;
    }

    // Check authorization
    if (receipt.userId !== auth.userId && auth.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Get linked items details
    const linkedItems = await Promise.all(
      receipt.linkedLedgerItems.map(async (itemId: Id<"ledgerItems">) => {
        const item = await ctx.db.get(itemId) as Doc<"ledgerItems"> | null;
        if (!item) return null;

        const session = item.sessionId ? await ctx.db.get(item.sessionId) as Doc<"sessions"> | null : null;

        return {
          id: item._id,
          type: item.type,
          status: item.status,
          amount: item.amount,
          session: session ? {
            id: session._id,
            name: session.name,
            startDate: session.startDate,
          } : null,
        };
      })
    );

    // Get user details for admin view
    let user = null;
    if (auth.role === "admin") {
      const userData = await ctx.db.get(receipt.userId) as Doc<"users"> | null;
      if (userData) {
        user = {
          id: userData._id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        };
      }
    }

    return {
      id: receipt._id,
      status: receipt.status,
      amount: receipt.amount,
      paymentMethod: receipt.paymentMethod,
      transactionRef: receipt.transactionRef,
      storageId: receipt.storageId,
      receiptType: receipt.receiptType || "zelle",  // Default to zelle for existing receipts
      hasImage: !!receipt.storageId,
      relatedReceiptId: receipt.relatedReceiptId,
      linkedItems: linkedItems.filter(Boolean),
      adminNotes: receipt.adminNotes,
      denialReason: receipt.denialReason,
      createdAt: receipt.createdAt,
      verifiedAt: receipt.verifiedAt,
      user,
    };
  },
});

// ADMIN: List all pending receipts
export const listPendingReceipts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc") // Oldest first
      .collect();

    return Promise.all(
      receipts.map(async (receipt) => {
        const user = await ctx.db.get(receipt.userId) as Doc<"users"> | null;

        return {
          id: receipt._id,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          transactionRef: receipt.transactionRef,
          itemCount: receipt.linkedLedgerItems.length,
          createdAt: receipt.createdAt,
          receiptType: receipt.receiptType || "zelle",  // Default to zelle for existing receipts
          hasImage: !!receipt.storageId,
          relatedReceiptId: receipt.relatedReceiptId,
          user: user ? {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          } : null,
        };
      })
    );
  },
});

// ADMIN: List all receipts with filters
export const listReceipts = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit || 50;

    const receipts = args.status
      ? await ctx.db.query("receipts").withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "verified" | "denied")).order("desc").take(limit)
      : await ctx.db.query("receipts").order("desc").take(limit);

    return Promise.all(
      receipts.map(async (receipt) => {
        const user = await ctx.db.get(receipt.userId) as Doc<"users"> | null;

        return {
          id: receipt._id,
          status: receipt.status,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          itemCount: receipt.linkedLedgerItems.length,
          createdAt: receipt.createdAt,
          verifiedAt: receipt.verifiedAt,
          user: user ? {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          } : null,
        };
      })
    );
  },
});

// ADMIN: Get receipt stats
export const getReceiptStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const receipts = await ctx.db.query("receipts").collect();

    const pendingCount = receipts.filter((r) => r.status === "pending").length;
    const verifiedCount = receipts.filter((r) => r.status === "verified").length;
    const deniedCount = receipts.filter((r) => r.status === "denied").length;
    const totalVerifiedAmount = receipts
      .filter((r) => r.status === "verified")
      .reduce((sum: number, r) => sum + r.amount, 0);

    return {
      pendingCount,
      verifiedCount,
      deniedCount,
      totalVerifiedAmount,
    };
  },
});
