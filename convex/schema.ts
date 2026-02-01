import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables
  ...authTables,

  // ============================================
  // USERS TABLE (extends Convex Auth user)
  // ============================================
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Legacy auth field (optional for migration)
    passwordHash: v.optional(v.string()),

    // Profile info
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
    })),

    // Role
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),

    // Registration flags
    isReturning: v.optional(v.boolean()),
    siblingGroupId: v.optional(v.string()),

    // Referral system
    referralCode: v.optional(v.string()),
    referralClaimed: v.optional(v.boolean()),
    hasUsedReferral: v.optional(v.boolean()),
    referredBy: v.optional(v.id("users")),

    // Account status
    isActive: v.optional(v.boolean()),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_siblingGroup", ["siblingGroupId"])
    .index("by_referralCode", ["referralCode"])
    .index("by_role", ["role"]),

  // ============================================
  // CHILDREN TABLE (for family accounts)
  // ============================================
  children: defineTable({
    parentId: v.id("users"),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_parentId", ["parentId"]),

  // ============================================
  // SESSIONS TABLE (Camp Weeks)
  // ============================================
  sessions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    basePrice: v.number(),
    capacity: v.number(),
    enrolledCount: v.number(),
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    location: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    earlyBirdDeadline: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_isActive", ["isActive"]),

  // ============================================
  // LEDGER ITEMS TABLE
  // ============================================
  ledgerItems: defineTable({
    userId: v.id("users"),
    childId: v.optional(v.id("children")),
    sessionId: v.optional(v.id("sessions")),

    type: v.union(
      v.literal("enrollment"),
      v.literal("credit_memo")
    ),

    status: v.union(
      v.literal("draft"),
      v.literal("reserved"),
      v.literal("secured"),
      v.literal("verified"),
      v.literal("cancelled")
    ),

    amount: v.number(),

    // Payment method chosen during reservation
    paymentMethod: v.optional(v.union(v.literal("zelle"), v.literal("cash"))),

    // Snapshotted discounts (populated on verification)
    snapshotTieredDiscount: v.optional(v.number()),
    snapshotReturningCredit: v.optional(v.number()),
    snapshotSiblingCredit: v.optional(v.number()),
    snapshotEarlyBirdCredit: v.optional(v.number()),

    description: v.optional(v.string()),
    couponId: v.optional(v.id("coupons")),
    receiptId: v.optional(v.id("receipts")),

    // Reservation tracking
    reservedAt: v.optional(v.number()),
    reservationExpiresAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_sessionId", ["sessionId"])
    .index("by_receiptId", ["receiptId"])
    .index("by_status", ["status"]),

  // ============================================
  // RECEIPTS TABLE
  // ============================================
  receipts: defineTable({
    userId: v.id("users"),
    storageId: v.optional(v.id("_storage")),  // Optional: cash receipts have no image

    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("denied")
    ),

    amount: v.number(),
    paymentMethod: v.optional(v.string()),
    transactionRef: v.optional(v.string()),

    // Receipt type: zelle (has image) or cash (no image, collect in person)
    receiptType: v.optional(v.union(v.literal("zelle"), v.literal("cash"))),
    // Links paired receipts (cash receipt points to its zelle deposit receipt)
    relatedReceiptId: v.optional(v.id("receipts")),

    linkedLedgerItems: v.array(v.id("ledgerItems")),

    adminNotes: v.optional(v.string()),
    verifiedBy: v.optional(v.id("users")),
    denialReason: v.optional(v.string()),

    createdAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_receiptType", ["receiptType"]),

  // ============================================
  // COUPONS TABLE
  // ============================================
  coupons: defineTable({
    code: v.string(),
    discountValue: v.number(),
    discountType: v.union(
      v.literal("fixed"),
      v.literal("percentage")
    ),

    status: v.union(
      v.literal("available"),
      v.literal("pending"),
      v.literal("consumed"),
      v.literal("expired"),
      v.literal("disabled")
    ),

    linkedUserId: v.optional(v.id("users")),
    linkedLedgerItemId: v.optional(v.id("ledgerItems")),

    description: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    currentUses: v.number(),
    expiresAt: v.optional(v.number()),

    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_linkedUserId", ["linkedUserId"]),

  // ============================================
  // ACTIVITY LOG (for admin audit trail)
  // ============================================
  activityLog: defineTable({
    userId: v.optional(v.id("users")),
    targetType: v.string(),
    targetId: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_targetType", ["targetType"])
    .index("by_userId", ["userId"]),
});
