/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as children from "../children.js";
import type * as constants from "../constants.js";
import type * as coupons from "../coupons.js";
import type * as crons from "../crons.js";
import type * as deltaEngine from "../deltaEngine.js";
import type * as files from "../files.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as ledgerItems from "../ledgerItems.js";
import type * as receipts from "../receipts.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  children: typeof children;
  constants: typeof constants;
  coupons: typeof coupons;
  crons: typeof crons;
  deltaEngine: typeof deltaEngine;
  files: typeof files;
  helpers: typeof helpers;
  http: typeof http;
  ledgerItems: typeof ledgerItems;
  receipts: typeof receipts;
  seed: typeof seed;
  sessions: typeof sessions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
