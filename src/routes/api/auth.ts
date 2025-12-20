// Monobun Donation System - Authentication API Routes

import {
  login,
  destroySession,
  destroyAllSessions,
  changePassword,
  requestPasswordReset,
  resetPassword,
  createSession,
} from "../../lib/auth";
import { findAdminById } from "../../lib/db";
import { logger } from "../../lib/logger";
import { auditLogin, auditPasswordChange, AuditActions, recordAudit } from "../../lib/audit";
import {
  LoginSchema,
  PasswordChangeSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  validateRequest,
  formatZodError,
} from "../../lib/validation";
import { requireAuth, createSessionCookie, clearSessionCookie } from "../../middleware/auth";
import { validateCsrf } from "../../middleware/csrf";
import { getClientIP } from "../../middleware/ip-filter";
import type { Admin, Session } from "../../types";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface RouteContext {
  request: Request;
  directIp: string;
}

interface AuthenticatedContext extends RouteContext {
  admin: Admin;
  session: Session;
}

/**
 * POST /api/auth/login
 */
export async function handleLogin(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  try {
    const body = await ctx.request.json();
    const validation = validateRequest(LoginSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const result = await login(email, password, clientIp, userAgent);

    // Audit log
    await auditLogin(
      { ipAddress: clientIp, userAgent: userAgent ?? undefined },
      result.success,
      email,
      result.reason
    );

    if (!result.success) {
      if (result.locked) {
        return Response.json(
          {
            error: "ACCOUNT_LOCKED",
            message: `Account is locked. Try again after ${result.lockedUntil?.toISOString()}`,
            lockedUntil: result.lockedUntil?.toISOString(),
          },
          { status: 423 }
        );
      }

      if (result.requireCaptcha) {
        return Response.json(
          {
            error: "CAPTCHA_REQUIRED",
            message: "Too many failed attempts. Please complete CAPTCHA.",
            requireCaptcha: true,
          },
          { status: 400 }
        );
      }

      return Response.json(
        { error: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Password change required
    if (result.requirePasswordChange) {
      return Response.json({
        requirePasswordChange: true,
        tempToken: result.tempToken,
      });
    }

    // Success - return session info
    const { session, token, csrfToken } = result.session!;
    const response = Response.json({
      token,
      csrfToken,
      expiresAt: session.expires_at.toISOString(),
      user: {
        id: result.admin!.id,
        email: result.admin!.email,
        role: result.admin!.role,
      },
    });

    // Set session cookie
    const headers = new Headers(response.headers);
    headers.set(
      "Set-Cookie",
      createSessionCookie(token, session.expires_at, IS_PRODUCTION)
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    logger.error("Login error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred during login" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/logout
 */
export async function handleLogout(ctx: AuthenticatedContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  try {
    await destroySession(ctx.session.token);

    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      { action: AuditActions.LOGOUT, targetType: "session", targetId: ctx.session.id }
    );

    const response = Response.json({ message: "Logged out successfully" });
    const headers = new Headers(response.headers);
    headers.set("Set-Cookie", clearSessionCookie());

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    logger.error("Logout error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred during logout" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/logout-all
 */
export async function handleLogoutAll(ctx: AuthenticatedContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    await destroyAllSessions(ctx.admin.id);

    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      { action: AuditActions.LOGOUT_ALL, targetType: "admin", targetId: ctx.admin.id }
    );

    const response = Response.json({ message: "All sessions logged out" });
    const headers = new Headers(response.headers);
    headers.set("Set-Cookie", clearSessionCookie());

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    logger.error("Logout all error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred during logout" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/me
 */
export async function handleGetMe(ctx: AuthenticatedContext): Promise<Response> {
  return Response.json({
    id: ctx.admin.id,
    email: ctx.admin.email,
    role: ctx.admin.role,
  });
}

/**
 * POST /api/auth/change-password
 */
export async function handleChangePassword(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  try {
    const body = await ctx.request.json();
    const validation = validateRequest(PasswordChangeSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword, tempToken } = validation.data;

    // Two modes: with temp token (forced change) or with current password (normal change)
    if (tempToken) {
      // Temp token flow (forced password change)
      // Find session by temp token
      const authResult = await requireAuth(
        new Request(ctx.request.url, {
          headers: { Authorization: `Bearer ${tempToken}` },
        }),
        ctx.directIp
      );

      if (!authResult.success) {
        return Response.json(
          { error: "INVALID_TOKEN", message: "Invalid or expired token" },
          { status: 401 }
        );
      }

      const result = await changePassword(
        authResult.admin.id,
        undefined,
        newPassword,
        true // isTempSession
      );

      if (!result.success) {
        return Response.json(
          { error: "PASSWORD_CHANGE_FAILED", message: result.reason },
          { status: 400 }
        );
      }

      await auditPasswordChange(
        { admin: authResult.admin, ipAddress: clientIp, userAgent: userAgent ?? undefined },
        false
      );

      // Create new session
      const sessionResult = await createSession(authResult.admin.id, clientIp, userAgent);

      const response = Response.json({
        message: "Password changed successfully",
        token: sessionResult.token,
        csrfToken: sessionResult.csrfToken,
        expiresAt: sessionResult.session.expires_at.toISOString(),
      });

      const headers = new Headers(response.headers);
      headers.set(
        "Set-Cookie",
        createSessionCookie(sessionResult.token, sessionResult.session.expires_at, IS_PRODUCTION)
      );

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } else {
      // Normal password change (requires authentication)
      const authResult = await requireAuth(ctx.request, ctx.directIp);
      if (!authResult.success) {
        return authResult.response;
      }

      // Validate CSRF
      const csrfError = validateCsrf(ctx.request, authResult.session);
      if (csrfError) return csrfError;

      const result = await changePassword(
        authResult.admin.id,
        currentPassword,
        newPassword,
        false
      );

      if (!result.success) {
        return Response.json(
          { error: "PASSWORD_CHANGE_FAILED", message: result.reason },
          { status: 400 }
        );
      }

      await auditPasswordChange(
        { admin: authResult.admin, session: authResult.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
        false
      );

      const response = Response.json({
        message: "Password changed successfully. Please log in again.",
      });

      const headers = new Headers(response.headers);
      headers.set("Set-Cookie", clearSessionCookie());

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }
  } catch (error) {
    logger.error("Password change error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred during password change" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/forgot-password
 */
export async function handleForgotPassword(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);

  try {
    const body = await ctx.request.json();
    const validation = validateRequest(PasswordResetRequestSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Always respond with same message to prevent email enumeration
    const result = await requestPasswordReset(email, clientIp);

    if (result) {
      // TODO: Send email with reset link
      // The token should be sent via email, not in the response
      logger.info("Password reset requested", {
        email,
        token: result.token, // In production, this would be sent via email
      });
    }

    // Audit log (even if email not found, to track enumeration attempts)
    await recordAudit(
      { ipAddress: clientIp },
      { action: AuditActions.PASSWORD_RESET_REQUEST, targetType: "admin", newValue: { email } }
    );

    // Always return same response
    return Response.json({
      message: "If the email is registered, a password reset link will be sent.",
    });
  } catch (error) {
    logger.error("Forgot password error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password
 */
export async function handleResetPassword(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  try {
    const body = await ctx.request.json();
    const validation = validateRequest(PasswordResetConfirmSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { token, newPassword } = validation.data;
    const result = await resetPassword(token, newPassword, clientIp);

    if (!result.success) {
      return Response.json(
        { error: "RESET_TOKEN_EXPIRED", message: result.reason },
        { status: 400 }
      );
    }

    await recordAudit(
      { ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.PASSWORD_RESET_COMPLETE,
        newValue: { ipChanged: result.ipChanged },
      }
    );

    return Response.json({
      message: "Password has been reset. All sessions have been logged out.",
    });
  } catch (error) {
    logger.error("Reset password error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
