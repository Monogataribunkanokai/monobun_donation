// Monobun Donation System - Events API

import { findEventById, listEvents } from "../../lib/db";
import { logger } from "../../lib/logger";
import { getClientIP } from "../../middleware/ip-filter";

interface RouteContext {
  request: Request;
  directIp: string;
}

/**
 * GET /api/events
 * List active events (public)
 */
export async function handleListEvents(ctx: RouteContext): Promise<Response> {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    // Only show active events to public
    const { events, total } = await listEvents("active", page, limit);

    // Return public-safe event data
    const publicEvents = events.map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      goalAmount: event.goal_amount,
      priceOptions: event.price_options,
      startsAt: event.starts_at?.toISOString(),
      endsAt: event.ends_at?.toISOString(),
      styleConfig: event.style_config,
    }));

    return Response.json({
      data: publicEvents,
      pagination: {
        page,
        limit,
        total,
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
 * GET /api/events/:id
 * Get event details (public)
 */
export async function handleGetEvent(
  ctx: RouteContext,
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

    // Only show active events to public
    if (event.status !== "active") {
      return Response.json(
        { error: "NOT_FOUND", message: "Event not found" },
        { status: 404 }
      );
    }

    // Return public-safe event data
    return Response.json({
      id: event.id,
      name: event.name,
      description: event.description,
      goalAmount: event.goal_amount,
      priceOptions: event.price_options,
      startsAt: event.starts_at?.toISOString(),
      endsAt: event.ends_at?.toISOString(),
      styleConfig: event.style_config,
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
