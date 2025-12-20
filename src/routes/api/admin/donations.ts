// Monobun Donation System - Admin Donations API

import { logger } from "../../../lib/logger";
import { AuditActions, recordAudit } from "../../../lib/audit";
import { getClientIP } from "../../../middleware/ip-filter";
import { getDb } from "../../../lib/db";
import type { Admin, Session, Donation } from "../../../types";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

/**
 * GET /api/admin/donations
 * List donations with pagination and filters
 */
export async function handleAdminListDonations(
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
    const eventId = url.searchParams.get("eventId");
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const db = getDb();

    // Build query - using simple approach for now
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
    if (eventId) {
      params.push(eventId);
      whereClause += ` AND event_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (donor_email ILIKE $${params.length} OR donor_name ILIKE $${params.length})`;
    }

    // Get total count
    const countResult = await db.unsafe(
      `SELECT COUNT(*) as count FROM donations WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    // Get paginated results
    const validSortColumns = ["created_at", "amount", "status", "donor_name"];
    const safeSort = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

    params.push(limit, offset);
    const donations = await db.unsafe(
      `SELECT * FROM donations
       WHERE ${whereClause}
       ORDER BY ${safeSort} ${safeSortOrder}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return Response.json({
      data: donations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error listing donations", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/donations/:id
 * Get full donation details
 */
export async function handleAdminGetDonation(
  ctx: AuthenticatedContext,
  donationId: string
): Promise<Response> {
  try {
    const db = getDb();
    const donations = await db`
      SELECT d.*, e.name as event_name
      FROM donations d
      LEFT JOIN events e ON d.event_id = e.id
      WHERE d.id = ${donationId}
    `;

    if (donations.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "Donation not found" },
        { status: 404 }
      );
    }

    return Response.json(donations[0]);
  } catch (error) {
    logger.error("Error getting donation", {
      error: error instanceof Error ? error.message : "Unknown error",
      donationId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/donations/stats
 * Get donation statistics
 */
export async function handleAdminDonationStats(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const db = getDb();

    // Total stats
    const totals = await db`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completed_amount,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM donations
    `;

    // Stats by type
    const byType = await db`
      SELECT
        type,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as amount
      FROM donations
      GROUP BY type
    `;

    // Recent 30 days daily stats
    const dailyStats = await db`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as amount
      FROM donations
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Top events
    const topEvents = await db`
      SELECT
        e.id,
        e.name,
        COUNT(d.id) as donation_count,
        COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0) as total_amount
      FROM events e
      LEFT JOIN donations d ON e.id = d.event_id
      GROUP BY e.id, e.name
      ORDER BY total_amount DESC
      LIMIT 5
    `;

    return Response.json({
      totals: totals[0],
      byType,
      dailyStats,
      topEvents,
    });
  } catch (error) {
    logger.error("Error getting donation stats", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
