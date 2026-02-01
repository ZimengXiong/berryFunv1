import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { generateReferralCode } from "./helpers";

// Admin emails - users with these emails will be assigned admin role on sign up
const ADMIN_EMAILS = [
  "zxzimeng@gmail.com",
  "sweetbettycq@gmail.com",
  "phonica@gmail.com",
];

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        // Existing user - update with any new profile info from OAuth
        const existingUser = await ctx.db.get(args.existingUserId);
        if (existingUser && args.profile) {
          const updates: Record<string, unknown> = {
            updatedAt: Date.now(),
          };

          // Update name if available from OAuth profile
          if (args.profile.name && !existingUser.name) {
            updates.name = args.profile.name;
          }

          // Update image if available from OAuth profile
          if (args.profile.image && !existingUser.image) {
            updates.image = args.profile.image;
          }

          if (Object.keys(updates).length > 1) {
            await ctx.db.patch(args.existingUserId, updates);
          }
        }
        return args.existingUserId;
      }

      // New user - create with custom fields
      const now = Date.now();
      const profile = args.profile;

      // Parse name from OAuth profile
      let firstName = "";
      let lastName = "";
      if (profile?.name && typeof profile.name === "string") {
        const nameParts = profile.name.split(" ");
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(" ") || "";
      }

      // Generate unique referral code
      const referralCode = generateReferralCode();

      // Check if this email belongs to a known admin
      const isAdmin = profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());

      const userId = await ctx.db.insert("users", {
        // Convex Auth fields
        name: profile?.name,
        email: profile?.email,
        image: profile?.image,
        emailVerificationTime: profile?.emailVerified ? now : undefined,

        // Custom fields
        firstName,
        lastName,
        role: isAdmin ? "admin" : "user",
        isReturning: false,
        referralCode,
        referralClaimed: false,
        hasUsedReferral: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Log registration activity
      await ctx.db.insert("activityLog", {
        userId,
        targetType: "user",
        targetId: userId,
        action: "registered_oauth",
        details: `Provider: Google`,
        createdAt: now,
      });

      return userId;
    },
  },
});
