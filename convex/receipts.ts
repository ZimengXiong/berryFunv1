import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbContext = { db: any };

// Helper to get authenticated user
async function getAuthenticatedUser(
  ctx: DbContext,
  token: string
): Promise<{ userId: Id<"users">; role: "user" | "admin" } | null> {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first() as Doc<"authSessions"> | null;

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
  ctx: DbContext,
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

// MUTATION: Submit receipt (secures draft items)
export const submitReceipt = mutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    amount: v.number(),
    paymentMethod: v.optional(v.string()),
    transactionRef: v.optional(v.string()),
    ledgerItemIds: v.array(v.id("ledgerItems")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth) {
      throw new Error("Not authenticated");
    }

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

    // Create receipt
    const receiptId = await ctx.db.insert("receipts", {
      userId: auth.userId,
      storageId: args.storageId,
      status: "pending",
      amount: args.amount,
      paymentMethod: args.paymentMethod?.trim(),
      transactionRef: args.transactionRef?.trim(),
      linkedLedgerItems: args.ledgerItemIds,
      createdAt: now,
    });

    // Update all linked items to secured status
    for (const itemId of args.ledgerItemIds) {
      await ctx.db.patch(itemId, {
        status: "secured",
        receiptId,
        updatedAt: now,
      });
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      userId: auth.userId,
      targetType: "receipt",
      targetId: receiptId,
      action: "submitted",
      details: `Amount: $${args.amount}, Items: ${args.ledgerItemIds.length}`,
      createdAt: now,
    });

    return { receiptId };
  },
});

// QUERY: Get user's receipts
export const getReceipts = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    const receipts = args.status
      ? await ctx.db
          .query("receipts")
          .withIndex("by_userId_status", (q: any) =>
            q.eq("userId", auth.userId).eq("status", args.status)
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("receipts")
          .withIndex("by_userId", (q: any) => q.eq("userId", auth.userId))
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
    token: v.string(),
    receiptId: v.id("receipts"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedUser(ctx, args.token);
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
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

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
    token: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const limit = args.limit || 50;

    const receipts = args.status
      ? await ctx.db.query("receipts").withIndex("by_status", (q: any) => q.eq("status", args.status)).order("desc").take(limit)
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
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

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
