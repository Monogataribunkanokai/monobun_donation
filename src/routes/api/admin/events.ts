// Monobun Donation System - Admin Events API

import { logger } from "../../../lib/logger";
import { AuditActions, recordAudit } from "../../../lib/audit";
import { validateCsrf } from "../../../middleware/csrf";
import { getClientIP } from "../../../middleware/ip-filter";
import { getDb, createEvent, findEventById, listEvents } from "../../../lib/db";
import { generateId } from "../../../lib/auth";
import type { Admin, Session, DonationEvent } from "../../../types";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

/**
 * GET /api/admin/events
 * List all events (including inactive)
 */
export async function handleAdminListEvents(
  ctx: AuthenticatedContext
): Promise<Response> {
  try {
    const url = new URL(ctx.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const status = url.searchParams.get("status") as "active" | "draft" | "ended" | null;

    const { events, total } = await listEvents(status ?? undefined, page, limit);

    return Response.json({
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error listing events", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/events/:id
 * Get full event details
 */
export async function handleAdminGetEvent(
  ctx: AuthenticatedContext,
  eventId: string
): Promise<Response> {
  try {
    const event = await findEventById(eventId);

    if (!event) {
      return Response.json(
        { error: "NOT_FOUND", message: "Event not found" },
        { status: 404 }
      );
    }

    // Get donation stats for this event
    const db = getDb();
    const stats = await db`
      SELECT
        COUNT(*) as total_donations,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_raised,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_donations
      FROM donations
      WHERE event_id = ${eventId}
    `;

    return Response.json({
      ...event,
      stats: stats[0],
    });
  } catch (error) {
    logger.error("Error getting event", {
      error: error instanceof Error ? error.message : "Unknown error",
      eventId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events
 * Create a new event
 */
export async function handleAdminCreateEvent(
  ctx: AuthenticatedContext
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const body = await ctx.request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.length > 200) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Invalid event name" },
        { status: 400 }
      );
    }

    // Parse dates if provided
    let startsAt: Date | null = null;
    let endsAt: Date | null = null;

    if (body.startsAt) {
      startsAt = new Date(body.startsAt);
      if (isNaN(startsAt.getTime())) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid start date" },
          { status: 400 }
        );
      }
    }

    if (body.endsAt) {
      endsAt = new Date(body.endsAt);
      if (isNaN(endsAt.getTime())) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid end date" },
          { status: 400 }
        );
      }
    }

    // Validate goal amount if provided
    let goalAmount: number | null = null;
    if (body.goalAmount !== undefined && body.goalAmount !== null) {
      goalAmount = parseInt(body.goalAmount, 10);
      if (isNaN(goalAmount) || goalAmount < 0) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid goal amount" },
          { status: 400 }
        );
      }
    }

    // Validate price options if provided
    let priceOptions: number[] | null = null;
    if (body.priceOptions) {
      if (!Array.isArray(body.priceOptions)) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Price options must be an array" },
          { status: 400 }
        );
      }
      priceOptions = body.priceOptions.map((p: unknown) => parseInt(String(p), 10));
      if (priceOptions.some((p) => isNaN(p) || p < 100)) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid price options" },
          { status: 400 }
        );
      }
    }

    const eventId = generateId("evt");

    const event = await createEvent({
      id: eventId,
      name: body.name,
      description: body.description || null,
      goal_amount: goalAmount,
      price_options: priceOptions,
      status: body.status || "draft",
      starts_at: startsAt,
      ends_at: endsAt,
      style_config: body.styleConfig || null,
    });

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      { action: AuditActions.EVENT_CREATE, targetType: "event", targetId: event.id, newValue: { name: event.name } }
    );

    logger.info("Event created", { eventId: event.id, adminId: ctx.admin.id });

    return Response.json(event, { status: 201 });
  } catch (error) {
    logger.error("Error creating event", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/events/:id
 * Update an event
 */
export async function handleAdminUpdateEvent(
  ctx: AuthenticatedContext,
  eventId: string
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const existingEvent = await findEventById(eventId);
    if (!existingEvent) {
      return Response.json(
        { error: "NOT_FOUND", message: "Event not found" },
        { status: 404 }
      );
    }

    const body = await ctx.request.json();
    const db = getDb();

    // Build update object
    const updates: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length > 200) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid event name" },
          { status: 400 }
        );
      }
      oldValues.name = existingEvent.name;
      updates.name = body.name;
    }

    if (body.description !== undefined) {
      oldValues.description = existingEvent.description;
      updates.description = body.description;
    }

    if (body.status !== undefined) {
      if (!["draft", "active", "ended"].includes(body.status)) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid status" },
          { status: 400 }
        );
      }
      oldValues.status = existingEvent.status;
      updates.status = body.status;
    }

    if (body.goalAmount !== undefined) {
      oldValues.goal_amount = existingEvent.goal_amount;
      updates.goal_amount = body.goalAmount === null ? null : parseInt(body.goalAmount, 10);
    }

    if (body.priceOptions !== undefined) {
      oldValues.price_options = existingEvent.price_options;
      updates.price_options = body.priceOptions;
    }

    if (body.startsAt !== undefined) {
      oldValues.starts_at = existingEvent.starts_at;
      updates.starts_at = body.startsAt ? new Date(body.startsAt) : null;
    }

    if (body.endsAt !== undefined) {
      oldValues.ends_at = existingEvent.ends_at;
      updates.ends_at = body.endsAt ? new Date(body.endsAt) : null;
    }

    if (body.styleConfig !== undefined) {
      oldValues.style_config = existingEvent.style_config;
      updates.style_config = body.styleConfig;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "No updates provided" },
        { status: 400 }
      );
    }

    // Update event
    await db`
      UPDATE events
      SET ${db(updates)}, updated_at = NOW()
      WHERE id = ${eventId}
    `;

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      { action: AuditActions.EVENT_UPDATE, targetType: "event", targetId: eventId, oldValue: oldValues, newValue: updates }
    );

    // Fetch updated event
    const updatedEvent = await findEventById(eventId);

    logger.info("Event updated", { eventId, adminId: ctx.admin.id });

    return Response.json(updatedEvent);
  } catch (error) {
    logger.error("Error updating event", {
      error: error instanceof Error ? error.message : "Unknown error",
      eventId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/:id
 * Delete an event (soft delete by setting status to 'ended')
 */
export async function handleAdminDeleteEvent(
  ctx: AuthenticatedContext,
  eventId: string
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    const existingEvent = await findEventById(eventId);
    if (!existingEvent) {
      return Response.json(
        { error: "NOT_FOUND", message: "Event not found" },
        { status: 404 }
      );
    }

    const db = getDb();

    // Soft delete - set status to ended
    await db`
      UPDATE events
      SET status = 'ended', updated_at = NOW()
      WHERE id = ${eventId}
    `;

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      { action: AuditActions.EVENT_DELETE, targetType: "event", targetId: eventId, oldValue: { name: existingEvent.name } }
    );

    logger.info("Event deleted", { eventId, adminId: ctx.admin.id });

    return Response.json({ message: "Event deleted successfully" });
  } catch (error) {
    logger.error("Error deleting event", {
      error: error instanceof Error ? error.message : "Unknown error",
      eventId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
