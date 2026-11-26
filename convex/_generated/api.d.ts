/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as fitnessActions from "../fitnessActions.js";
import type * as generationReliability from "../generationReliability.js";
import type * as generations from "../generations.js";
import type * as http from "../http.js";
import type * as lib_generationTicket from "../lib/generationTicket.js";
import type * as plans from "../plans.js";
import type * as users from "../users.js";
import type * as workoutActivity from "../workoutActivity.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  fitnessActions: typeof fitnessActions;
  generationReliability: typeof generationReliability;
  generations: typeof generations;
  http: typeof http;
  "lib/generationTicket": typeof lib_generationTicket;
  plans: typeof plans;
  users: typeof users;
  workoutActivity: typeof workoutActivity;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
