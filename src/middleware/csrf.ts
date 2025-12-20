// Monobun Donation System - CSRF Protection Middleware

import { logger } from "../lib/logger";
import type { Session } from "../types";

/**
 * List of HTTP methods that require CSRF protection
 */
const CSRF_PROTECTED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Endpoints that are exempt from CSRF protection
 * (e.g., public APIs that use other authentication methods)
 */
const CSRF_EXEMPT_PATHS = [
  "/api/donations", // Public donation creation
  "/api/subscriptions", // Public subscription creation
  "/api/webhooks/stripe", // Stripe webhook (uses signature verification)
  "/api/auth/login", // Login (no session yet)
  "/api/auth/forgot-password", // Password reset request
  "/api/auth/reset-password", // Password reset (uses token)
];

/**
 * Check if a path is exempt from CSRF protection
 */
function isExemptPath(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((exempt) => path.startsWith(exempt));
}

/**
 * Validate CSRF token
 */
export function validateCsrf(
  request: Request,
  session: Session
): Response | null {
  const method = request.method.toUpperCase();

  // Skip CSRF check for safe methods
  if (!CSRF_PROTECTED_METHODS.includes(method)) {
    return null;
  }

  // Skip CSRF check for exempt paths
  const url = new URL(request.url);
  if (isExemptPath(url.pathname)) {
    return null;
  }

  // Get CSRF token from header
  const csrfToken = request.headers.get("X-CSRF-Token");

  if (!csrfToken) {
    logger.security("CSRF token missing", {
      path: url.pathname,
      method,
    });
    return Response.json(
      {
        error: "CSRF_TOKEN_MISSING",
        message: "CSRF token is required for this request",
      },
      { status: 403 }
    );
  }

  // Validate token matches session
  if (csrfToken !== session.csrf_token) {
    logger.security("CSRF token mismatch", {
      path: url.pathname,
      method,
    });
    return Response.json(
      {
        error: "CSRF_TOKEN_MISMATCH",
        message: "Invalid CSRF token",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Generate a new CSRF token (for initial session creation)
 * This is handled in auth.ts via generateCsrfToken()
 */
