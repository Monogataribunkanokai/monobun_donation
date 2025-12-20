// Monobun Donation System - Authentication Middleware

import { validateSession, isValidSessionToken } from "../lib/auth";
import { logger } from "../lib/logger";
import { getClientIP } from "./ip-filter";
import type { Admin, Session, AdminRole } from "../types";

export interface AuthenticatedRequest extends Request {
  admin: Admin;
  session: Session;
}

export type AuthMiddlewareResult =
  | { success: true; admin: Admin; session: Session }
  | { success: false; response: Response };

/**
 * Extract session token from request
 */
function extractToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Authentication middleware - validates session and returns admin
 */
export async function requireAuth(
  request: Request,
  directIp: string
): Promise<AuthMiddlewareResult> {
  const token = extractToken(request);

  if (!token) {
    return {
      success: false,
      response: Response.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (!isValidSessionToken(token)) {
    return {
      success: false,
      response: Response.json(
        { error: "UNAUTHORIZED", message: "Invalid session token" },
        { status: 401 }
      ),
    };
  }

  const clientIp = getClientIP(request, directIp);
  const result = await validateSession(token, clientIp);

  if (!result.valid) {
    if (result.reason === "SESSION_IP_CHANGED") {
      logger.security("Session rejected due to IP change", {
        ip: clientIp,
      });
      return {
        success: false,
        response: Response.json(
          {
            error: "SESSION_IP_CHANGED",
            message: "IP address changed. Please log in again.",
          },
          { status: 401 }
        ),
      };
    }

    return {
      success: false,
      response: Response.json(
        { error: "UNAUTHORIZED", message: result.reason || "Session invalid" },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    admin: result.admin!,
    session: result.session!,
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(
  admin: Admin,
  requiredRole: AdminRole
): Response | null {
  const roleHierarchy: Record<AdminRole, number> = {
    viewer: 1,
    editor: 2,
  };

  if (roleHierarchy[admin.role] < roleHierarchy[requiredRole]) {
    return Response.json(
      {
        error: "FORBIDDEN",
        message: `This action requires ${requiredRole} role`,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Check if admin has sufficient role
 */
export function hasRole(admin: Admin, requiredRole: AdminRole): boolean {
  const roleHierarchy: Record<AdminRole, number> = {
    viewer: 1,
    editor: 2,
  };
  return roleHierarchy[admin.role] >= roleHierarchy[requiredRole];
}

/**
 * Create session cookie for response
 */
export function createSessionCookie(
  token: string,
  expiresAt: Date,
  secure: boolean = true
): string {
  const parts = [
    `session=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/**
 * Create expired cookie to clear session
 */
export function clearSessionCookie(): string {
  return "session=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
