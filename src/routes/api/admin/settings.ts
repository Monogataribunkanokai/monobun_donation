// Monobun Donation System - Admin Settings API

import { logger } from "../../../lib/logger";
import { AuditActions, recordAudit } from "../../../lib/audit";
import { validateCsrf } from "../../../middleware/csrf";
import { getClientIP } from "../../../middleware/ip-filter";
import { getSetting, setSetting, getAllowedIPs, addAllowedIP, getDb } from "../../../lib/db";
import type { Admin, Session } from "../../../types";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

// Settings that can be configured
const ALLOWED_SETTINGS = [
  "site_name",
  "site_description",
  "default_currency",
  "min_donation_amount",
  "max_donation_amount",
  "enable_anonymous_donations",
  "enable_messages",
  "maintenance_mode",
  "analytics_id",
];

/**
 * GET /api/admin/settings
 * Get all settings
 */
export async function handleAdminGetSettings(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const settings: Record<string, unknown> = {};

    for (const key of ALLOWED_SETTINGS) {
      settings[key] = await getSetting(key);
    }

    return Response.json({ settings });
  } catch (error) {
    logger.error("Error getting settings", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update settings
 */
export async function handleAdminUpdateSettings(
  ctx: AuthenticatedContext
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const body = await ctx.request.json();
    const updates = body.settings as Record<string, unknown>;

    if (!updates || typeof updates !== "object") {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Settings object is required" },
        { status: 400 }
      );
    }

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_SETTINGS.includes(key)) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: `Unknown setting: ${key}` },
          { status: 400 }
        );
      }

      oldValues[key] = await getSetting(key);
      await setSetting(key, value);
      newValues[key] = value;
    }

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.SETTINGS_UPDATE,
        targetType: "settings",
        oldValue: oldValues,
        newValue: newValues,
      }
    );

    logger.info("Settings updated", { adminId: ctx.admin.id });

    return Response.json({ message: "Settings updated successfully" });
  } catch (error) {
    logger.error("Error updating settings", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/settings/ip-whitelist
 * Get IP whitelist
 */
export async function handleAdminGetIPWhitelist(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const ips = await getAllowedIPs();
    return Response.json({ ips });
  } catch (error) {
    logger.error("Error getting IP whitelist", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/ip-whitelist
 * Add IP to whitelist
 */
export async function handleAdminAddIPWhitelist(
  ctx: AuthenticatedContext
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const body = await ctx.request.json();

    if (!body.ipPattern || typeof body.ipPattern !== "string") {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "IP pattern is required" },
        { status: 400 }
      );
    }

    // Validate IP pattern format (simple validation)
    const ipPattern = body.ipPattern.trim();
    if (!/^[\d.*\/]+$/.test(ipPattern) && !/^[\da-fA-F:.*\/]+$/.test(ipPattern)) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Invalid IP pattern format" },
        { status: 400 }
      );
    }

    const ip = await addAllowedIP(ipPattern, body.description);

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.IP_ADD,
        targetType: "allowed_ip",
        targetId: ip.id,
        newValue: { ipPattern, description: body.description },
      }
    );

    logger.info("IP added to whitelist", { adminId: ctx.admin.id, ipPattern });

    return Response.json(ip, { status: 201 });
  } catch (error) {
    logger.error("Error adding IP to whitelist", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/settings/ip-whitelist/:id
 * Remove IP from whitelist
 */
export async function handleAdminRemoveIPWhitelist(
  ctx: AuthenticatedContext,
  ipId: string
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const db = getDb();

    // Check if exists
    const existing = await db`SELECT * FROM allowed_ips WHERE id = ${ipId}`;
    if (existing.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "IP not found" },
        { status: 404 }
      );
    }

    // Delete
    await db`DELETE FROM allowed_ips WHERE id = ${ipId}`;

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.IP_REMOVE,
        targetType: "allowed_ip",
        targetId: ipId,
        oldValue: { ipPattern: existing[0].ip_pattern },
      }
    );

    logger.info("IP removed from whitelist", { adminId: ctx.admin.id, ipId });

    return Response.json({ message: "IP removed successfully" });
  } catch (error) {
    logger.error("Error removing IP from whitelist", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
