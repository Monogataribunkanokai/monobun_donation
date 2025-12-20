// Monobun Donation System - Donations API

import { generateId } from "../../lib/auth";
import {
  createDonation,
  findDonationById,
  findEventById,
} from "../../lib/db";
import { logger } from "../../lib/logger";
import {
  DonationSchema,
  validateRequest,
  formatZodError,
} from "../../lib/validation";
import {
  createCheckoutSession,
  generateIdempotencyKey,
  isStripeConfigured,
} from "../../lib/stripe";
import {
  withIdempotency,
  getIdempotencyKeyFromRequest,
  isValidIdempotencyKey,
} from "../../lib/idempotency";
import { getClientIP } from "../../middleware/ip-filter";
import type { Donation } from "../../types";

interface RouteContext {
  request: Request;
  directIp: string;
}

/**
 * POST /api/donations
 * Create a new donation and return Stripe checkout URL
 */
export async function handleCreateDonation(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);

  try {
    // Check Stripe configuration
    if (!isStripeConfigured()) {
      return Response.json(
        { error: "PAYMENT_NOT_CONFIGURED", message: "Payment system is not configured" },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await ctx.request.json();
    const validation = validateRequest(DonationSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { type, amount, paymentMethod, eventId, donor, message } = validation.data;

    // Reject subscription types - they should use /api/subscriptions
    if (type === "monthly" || type === "yearly") {
      return Response.json(
        {
          error: "INVALID_TYPE",
          message: "Monthly and yearly donations should use /api/subscriptions endpoint"
        },
        { status: 400 }
      );
    }

    // Validate event exists if eventId is provided
    if (eventId) {
      const event = await findEventById(eventId);
      if (!event) {
        return Response.json(
          { error: "EVENT_NOT_FOUND", message: "Event not found" },
          { status: 404 }
        );
      }
      if (event.status !== "active") {
        return Response.json(
          { error: "EVENT_NOT_ACTIVE", message: "Event is not accepting donations" },
          { status: 400 }
        );
      }
    }

    // Get or generate idempotency key
    let idempotencyKey = getIdempotencyKeyFromRequest(ctx.request);
    if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
      return Response.json(
        { error: "INVALID_IDEMPOTENCY_KEY", message: "Invalid idempotency key format" },
        { status: 400 }
      );
    }
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey();
    }

    // Execute with idempotency protection
    const result = await withIdempotency(idempotencyKey, async () => {
      // Generate donation ID
      const donationId = generateId("don");

      // Create Stripe checkout session
      const checkoutSession = await createCheckoutSession({
        mode: "payment",
        amount,
        customerEmail: donor.email,
        donationId,
        eventId: eventId ?? undefined,
        metadata: {
          donor_name: donor.name || "Anonymous",
          message: message || "",
        },
        idempotencyKey,
      });

      // Save donation to database
      const donation = await createDonation({
        id: donationId,
        type, // "one-time" or "event"
        event_id: eventId ?? null,
        amount,
        donor_email: donor.email,
        donor_name: donor.name || "Anonymous",
        message: message ?? null,
        payment_method: paymentMethod,
        stripe_session_id: checkoutSession.id,
        stripe_payment_intent_id: null,
        status: "pending",
      });

      logger.info("Donation created", {
        donationId,
        amount,
        type,
        eventId,
      });

      return {
        id: donation.id,
        stripeSessionUrl: checkoutSession.url,
        status: donation.status,
      };
    });

    if (result.cached) {
      logger.info("Returning cached donation response", { idempotencyKey });
    }

    return Response.json(result.response, { status: 201 });
  } catch (error) {
    logger.error("Error creating donation", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: clientIp,
    });

    if (error instanceof Error && error.name === "StripeError") {
      return Response.json(
        { error: "PAYMENT_ERROR", message: "Payment processing error" },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/donations/:id
 * Get donation status (public - limited info)
 */
export async function handleGetDonation(
  ctx: RouteContext,
  donationId: string
): Promise<Response> {
  try {
    const donation = await findDonationById(donationId);

    if (!donation) {
      return Response.json(
        { error: "NOT_FOUND", message: "Donation not found" },
        { status: 404 }
      );
    }

    // Return limited public info
    return Response.json({
      id: donation.id,
      status: donation.status,
      amount: donation.status === "completed" ? donation.amount : undefined,
      completedAt: donation.completed_at?.toISOString(),
    });
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
