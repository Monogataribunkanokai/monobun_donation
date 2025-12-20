// Monobun Donation System - Admin Subscriptions API

import { logger } from "../../../lib/logger";
import { AuditActions, recordAudit } from "../../../lib/audit";
import { validateCsrf } from "../../../middleware/csrf";
import { getClientIP } from "../../../middleware/ip-filter";
import { getDb, findSubscriptionById, updateSubscriptionStatus } from "../../../lib/db";
import { cancelSubscription } from "../../../lib/stripe";
import type { Admin, Session, Subscription } from "../../../types";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

/**
 * GET /api/admin/subscriptions
 * List subscriptions with pagination and filters
 */
export async function handleAdminListSubscriptions(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const url = new URL(ctx.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    // Filters
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search");

    const db = getDb();

    // Build query
    let whereClause = "1=1";
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (type) {
      params.push(type);
      whereClause += ` AND type = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (donor_email ILIKE $${params.length} OR donor_name ILIKE $${params.length})`;
    }

    // Get total count
    const countResult = await db.unsafe(
      `SELECT COUNT(*) as count FROM subscriptions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    // Get paginated results
    params.push(limit, offset);
    const subscriptions = await db.unsafe(
      `SELECT * FROM subscriptions
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return Response.json({
      data: subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error listing subscriptions", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/subscriptions/:id
 * Get full subscription details
 */
export async function handleAdminGetSubscription(
  ctx: AuthenticatedContext,
  subscriptionId: string
): Promise<Response> {
  try {
    const subscription = await findSubscriptionById(subscriptionId);

    if (!subscription) {
      return Response.json(
        { error: "NOT_FOUND", message: "Subscription not found" },
        { status: 404 }
      );
    }

    return Response.json(subscription);
  } catch (error) {
    logger.error("Error getting subscription", {
      error: error instanceof Error ? error.message : "Unknown error",
      subscriptionId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/subscriptions/:id/cancel
 * Cancel a subscription (admin action)
 */
export async function handleAdminCancelSubscription(
  ctx: AuthenticatedContext,
  subscriptionId: string
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const subscription = await findSubscriptionById(subscriptionId);

    if (!subscription) {
      return Response.json(
        { error: "NOT_FOUND", message: "Subscription not found" },
        { status: 404 }
      );
    }

    if (subscription.status === "cancelled") {
      return Response.json(
        { error: "ALREADY_CANCELLED", message: "Subscription is already cancelled" },
        { status: 400 }
      );
    }

    // Cancel on Stripe if we have a Stripe subscription ID
    if (subscription.stripe_subscription_id) {
      try {
        await cancelSubscription(subscription.stripe_subscription_id);
      } catch (error) {
        logger.error("Failed to cancel Stripe subscription", {
          subscriptionId: subscription.stripe_subscription_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Continue to cancel in our database even if Stripe fails
      }
    }

    // Update status in database
    await updateSubscriptionStatus(subscriptionId, "cancelled");

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.SUBSCRIPTION_CANCEL,
        targetType: "subscription",
        targetId: subscriptionId,
        oldValue: { status: subscription.status },
        newValue: { status: "cancelled" },
      }
    );

    logger.info("Subscription cancelled by admin", {
      subscriptionId,
      adminId: ctx.admin.id,
    });

    return Response.json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    logger.error("Error cancelling subscription", {
      error: error instanceof Error ? error.message : "Unknown error",
      subscriptionId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/subscriptions/stats
 * Get subscription statistics
 */
export async function handleAdminSubscriptionStats(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const db = getDb();

    // Total stats
    const totals = await db`
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN status = 'past_due' THEN 1 END) as past_due_count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as active_mrr
      FROM subscriptions
    `;

    // Stats by type
    const byType = await db`
      SELECT
        type,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as active_amount
      FROM subscriptions
      GROUP BY type
    `;

    // Recent cancellations
    const recentCancellations = await db`
      SELECT id, donor_email, donor_name, type, amount, cancelled_at
      FROM subscriptions
      WHERE status = 'cancelled' AND cancelled_at IS NOT NULL
      ORDER BY cancelled_at DESC
      LIMIT 10
    `;

    return Response.json({
      totals: totals[0],
      byType,
      recentCancellations,
    });
  } catch (error) {
    logger.error("Error getting subscription stats", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
