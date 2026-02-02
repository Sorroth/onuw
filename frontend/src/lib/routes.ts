/**
 * @fileoverview Application route constants.
 * @module lib/routes
 *
 * @description
 * Centralized route definitions to eliminate magic strings and provide
 * type-safe navigation throughout the application.
 *
 * @pattern Constant Object Pattern - Centralized route definitions
 * @pattern Information Hiding - Route structure encapsulated in one place
 */

/**
 * Application routes.
 * Use these constants instead of hardcoded strings for navigation.
 */
export const ROUTES = {
  /** Home page */
  HOME: '/',

  /** Authentication routes */
  AUTH: {
    SIGNIN: '/auth/signin',
    SIGNUP: '/auth/signup',
  },

  /** Game room route (requires room code) */
  ROOM: (code: string) => `/room/${code}`,
} as const;

/**
 * Type for static routes (excludes dynamic route functions).
 */
export type StaticRoute = typeof ROUTES.HOME | typeof ROUTES.AUTH.SIGNIN | typeof ROUTES.AUTH.SIGNUP;
