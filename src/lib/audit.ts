// Monobun Donation System - Audit Logging

import { createAuditLog } from "./db";
import { logger, maskSensitiveData } from "./logger";
import type { Admin, Session } from "../types";

export interface AuditContext {
  admin?: Admin;
  session?: Session;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Record an audit log entry
 */
export async function recordAudit(
  ctx: AuditContext,
  entry: AuditEntry
): Promise<void> {
  try {
    await createAuditLog({
      admin_id: ctx.admin?.id ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip_address: ctx.ipAddress ?? null,
      user_agent: ctx.userAgent ?? null,
    });

    // Also log for immediate visibility
    logger.info(`[AUDIT] ${entry.action}`, {
      adminId: ctx.admin?.id,
      adminEmail: ctx.admin?.email,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ipAddress: ctx.ipAddress,
    });
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error("Failed to record audit log", {
      error: error instanceof Error ? error.message : "Unknown error",
      action: entry.action,
    });
  }
}

// === Predefined Audit Actions ===

export const AuditActions = {
  // Auth
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILURE: "auth.login.failure",
  LOGOUT: "auth.logout",
  LOGOUT_ALL: "auth.logout.all",
  PASSWORD_CHANGE: "auth.password.change",
  PASSWORD_RESET_REQUEST: "auth.password.reset.request",
  PASSWORD_RESET_COMPLETE: "auth.password.reset.complete",

  // Events
  EVENT_CREATE: "event.create",
  EVENT_UPDATE: "event.update",
  EVENT_DELETE: "event.delete",

  // Donations
  DONATION_CREATE: "donation.create",
  DONATION_COMPLETE: "donation.complete",
  DONATION_FAIL: "donation.fail",

  // Subscriptions
  SUBSCRIPTION_CREATE: "subscription.create",
  SUBSCRIPTION_CANCEL: "subscription.cancel",
  SUBSCRIPTION_REFUND: "subscription.refund",

  // Settings
  SETTINGS_UPDATE: "settings.update",

  // Admin
  ADMIN_CREATE: "admin.create",
  ADMIN_UPDATE: "admin.update",
  ADMIN_DELETE: "admin.delete",

  // IP Whitelist
  IP_ADD: "ip.add",
  IP_REMOVE: "ip.remove",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

// === Convenience Functions ===

export async function auditLogin(
  ctx: AuditContext,
  success: boolean,
  email: string,
  reason?: string
): Promise<void> {
  await recordAudit(ctx, {
    action: success ? AuditActions.LOGIN_SUCCESS : AuditActions.LOGIN_FAILURE,
    targetType: "admin",
    newValue: success ? { email } : { email, reason },
  });
}

export async function auditPasswordChange(
  ctx: AuditContext,
  viaReset: boolean = false
): Promise<void> {
  await recordAudit(ctx, {
    action: viaReset ? AuditActions.PASSWORD_RESET_COMPLETE : AuditActions.PASSWORD_CHANGE,
    targetType: "admin",
    targetId: ctx.admin?.id,
  });
}

export async function auditSettingsUpdate(
  ctx: AuditContext,
  settingKey: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  await recordAudit(ctx, {
    action: AuditActions.SETTINGS_UPDATE,
    targetType: "settings",
    targetId: settingKey,
    oldValue: maskSensitiveData(oldValue as Record<string, unknown>),
    newValue: maskSensitiveData(newValue as Record<string, unknown>),
  });
}

export async function auditEventAction(
  ctx: AuditContext,
  action: "create" | "update" | "delete",
  eventId: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  const actionMap = {
    create: AuditActions.EVENT_CREATE,
    update: AuditActions.EVENT_UPDATE,
    delete: AuditActions.EVENT_DELETE,
  };

  await recordAudit(ctx, {
    action: actionMap[action],
    targetType: "event",
    targetId: eventId,
    oldValue,
    newValue,
  });
}

export async function auditSubscriptionRefund(
  ctx: AuditContext,
  subscriptionId: string,
  amount: number,
  reason?: string
): Promise<void> {
  await recordAudit(ctx, {
    action: AuditActions.SUBSCRIPTION_REFUND,
    targetType: "subscription",
    targetId: subscriptionId,
    newValue: { amount, reason },
  });
}
