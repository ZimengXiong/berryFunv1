import { v } from "convex/values";
import { mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// Internal mutation to create users with pre-hashed passwords
export const createSeedUser = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .first();

    if (existing) {
      console.log(`User ${args.email} already exists`);
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash: args.passwordHash,
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role,
      isReturning: false,
      referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      referralClaimed: false,
      hasUsedReferral: false,
      isActive: true,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Created ${args.role}: ${args.email}`);
    return userId;
  },
});

// Internal mutation to create sample sessions
export const createSeedSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Check if sessions already exist
    const existingSessions = await ctx.db.query("sessions").first();
    if (existingSessions) {
      console.log("Sessions already seeded");
      return;
    }

    const sessions = [
      {
        name: "Week 1: Adventure Camp",
        description: "Outdoor adventures including hiking, camping basics, and nature exploration. Perfect for young explorers!",
        startDate: "2025-06-09",
        endDate: "2025-06-13",
        basePrice: 350,
        capacity: 30,
        ageMin: 6,
        ageMax: 12,
        location: "Berry Fun Main Campus",
      },
      {
        name: "Week 2: Arts & Creativity",
        description: "Express yourself through painting, sculpting, drama, and music. Unleash your inner artist!",
        startDate: "2025-06-16",
        endDate: "2025-06-20",
        basePrice: 350,
        capacity: 25,
        ageMin: 5,
        ageMax: 11,
        location: "Berry Fun Art Studio",
      },
      {
        name: "Week 3: STEM Explorers",
        description: "Hands-on science experiments, coding basics, robotics, and engineering challenges.",
        startDate: "2025-06-23",
        endDate: "2025-06-27",
        basePrice: 375,
        capacity: 24,
        ageMin: 7,
        ageMax: 13,
        location: "Berry Fun Tech Lab",
      },
      {
        name: "Week 4: Sports & Games",
        description: "Soccer, basketball, swimming, and team-building games. Stay active and make friends!",
        startDate: "2025-06-30",
        endDate: "2025-07-04",
        basePrice: 350,
        capacity: 35,
        ageMin: 6,
        ageMax: 14,
        location: "Berry Fun Sports Complex",
      },
      {
        name: "Week 5: Water Week",
        description: "Swimming, water games, kayaking basics, and beach day trips. Beat the summer heat!",
        startDate: "2025-07-07",
        endDate: "2025-07-11",
        basePrice: 400,
        capacity: 28,
        ageMin: 7,
        ageMax: 13,
        location: "Berry Fun Aquatic Center",
      },
      {
        name: "Week 6: Culinary Kids",
        description: "Learn to cook healthy and fun recipes, baking basics, and food science experiments.",
        startDate: "2025-07-14",
        endDate: "2025-07-18",
        basePrice: 375,
        capacity: 20,
        ageMin: 8,
        ageMax: 14,
        location: "Berry Fun Kitchen",
      },
      {
        name: "Week 7: Nature & Wildlife",
        description: "Wildlife observation, gardening, environmental science, and overnight camping trip.",
        startDate: "2025-07-21",
        endDate: "2025-07-25",
        basePrice: 425,
        capacity: 25,
        ageMin: 8,
        ageMax: 14,
        location: "Berry Fun Nature Reserve",
      },
      {
        name: "Week 8: Performing Arts",
        description: "Theater, dance, music performance, and end-of-week showcase for parents.",
        startDate: "2025-07-28",
        endDate: "2025-08-01",
        basePrice: 350,
        capacity: 30,
        ageMin: 5,
        ageMax: 12,
        location: "Berry Fun Theater",
      },
    ];

    for (const session of sessions) {
      await ctx.db.insert("sessions", {
        ...session,
        enrolledCount: 0,
        isActive: true,
        earlyBirdDeadline: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`Created ${sessions.length} sessions`);
  },
});

// Action to seed the database (handles password hashing)
export const seedDatabase = action({
  args: {},
  handler: async (ctx) => {
    const bcrypt = await import("bcryptjs");

    // Hash passwords
    const adminHash = await bcrypt.hash("admin", 12);
    const user1Hash = await bcrypt.hash("user1", 12);

    // Create admin user
    await ctx.runMutation(api.seed.createSeedUser, {
      email: "admin@berryfun.com",
      passwordHash: adminHash,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });

    // Create regular user
    await ctx.runMutation(api.seed.createSeedUser, {
      email: "user1@berryfun.com",
      passwordHash: user1Hash,
      firstName: "Test",
      lastName: "User",
      role: "user",
    });

    // Create sample sessions
    await ctx.runMutation(api.seed.createSeedSessions, {});

    return { success: true, message: "Database seeded successfully!" };
  },
});
