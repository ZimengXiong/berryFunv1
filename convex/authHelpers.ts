import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export type AuthContext = QueryCtx | MutationCtx;

export interface AuthenticatedUser {
  userId: Id<"users">;
  role: "user" | "admin";
}

/**
 * Get the authenticated user from the Convex Auth session.
 * Returns null if not authenticated or user is inactive.
 */
export async function getAuthenticatedUser(
  ctx: AuthContext
): Promise<AuthenticatedUser | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const user = await ctx.db.get(userId);
  if (!user || user.isActive === false) {
    return null;
  }

  return {
    userId,
    role: user.role ?? "user",
  };
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth(
  ctx: AuthContext
): Promise<AuthenticatedUser> {
  const auth = await getAuthenticatedUser(ctx);
  if (!auth) {
    throw new Error("Not authenticated");
  }
  return auth;
}

/**
 * Require admin role. Throws if not authenticated or not an admin.
 */
export async function requireAdmin(
  ctx: AuthContext
): Promise<Id<"users">> {
  const auth = await getAuthenticatedUser(ctx);
  if (!auth) {
    throw new Error("Not authenticated");
  }
  if (auth.role !== "admin") {
    throw new Error("Admin access required");
  }
  return auth.userId;
}
