// Monobun Donation System - Admin Refunds API

import { logger } from "../../../lib/logger";
import { AuditActions, recordAudit } from "../../../lib/audit";
import { validateCsrf } from "../../../middleware/csrf";
import { getClientIP } from "../../../middleware/ip-filter";
import { findDonationById, getDb } from "../../../lib/db";
import { createRefund, generateIdempotencyKey, isStripeConfigured } from "../../../lib/stripe";
import type { Admin, Session } from "../../../types";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

/**
 * POST /api/admin/donations/:id/refund
 * Refund a donation
 */
export async function handleAdminRefundDonation(
  ctx: AuthenticatedContext,
  donationId: string
): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);
  const userAgent = ctx.request.headers.get("User-Agent");

  // Validate CSRF
  const csrfError = validateCsrf(ctx.request, ctx.session);
  if (csrfError) return csrfError;

  try {
    // Check Stripe configuration
    if (!isStripeConfigured()) {
      return Response.json(
        { error: "PAYMENT_NOT_CONFIGURED", message: "Payment system is not configured" },
        { status: 503 }
      );
    }

    // Find donation
    const donation = await findDonationById(donationId);
    if (!donation) {
      return Response.json(
        { error: "NOT_FOUND", message: "Donation not found" },
        { status: 404 }
      );
    }

    // Check status - only completed donations can be refunded
    if (donation.status === "refunded" || donation.status === "partially_refunded") {
      return Response.json(
        { error: "ALREADY_REFUNDED", message: "Donation has already been refunded" },
        { status: 400 }
      );
    }

    if (donation.status !== "completed") {
      return Response.json(
        { error: "INVALID_STATUS", message: "Only completed donations can be refunded" },
        { status: 400 }
      );
    }

    // Check if we have a payment intent ID
    if (!donation.stripe_payment_intent_id) {
      return Response.json(
        { error: "NO_PAYMENT_INTENT", message: "No payment intent found for this donation" },
        { status: 400 }
      );
    }

    // Parse request body for optional parameters
    const body = await ctx.request.json().catch(() => ({}));
    const partialAmount = body.amount ? parseInt(body.amount, 10) : undefined;
    const reason = body.reason as "duplicate" | "fraudulent" | "requested_by_customer" | undefined;

    // Validate partial amount if provided
    if (partialAmount !== undefined) {
      if (isNaN(partialAmount) || partialAmount <= 0) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Invalid refund amount" },
          { status: 400 }
        );
      }
      if (partialAmount > donation.amount) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "Refund amount exceeds donation amount" },
          { status: 400 }
        );
      }
    }

    // Create refund on Stripe
    const idempotencyKey = generateIdempotencyKey();
    const refund = await createRefund({
      paymentIntentId: donation.stripe_payment_intent_id,
      amount: partialAmount,
      reason,
      idempotencyKey,
    });

    // Update donation status
    const db = getDb();
    await db`
      UPDATE donations
      SET status = ${partialAmount && partialAmount < donation.amount ? "partially_refunded" : "refunded"}
      WHERE id = ${donationId}
    `;

    // Audit log
    await recordAudit(
      { admin: ctx.admin, session: ctx.session, ipAddress: clientIp, userAgent: userAgent ?? undefined },
      {
        action: AuditActions.DONATION_REFUND,
        targetType: "donation",
        targetId: donationId,
        newValue: {
          refundId: refund.id,
          amount: partialAmount || donation.amount,
          reason,
        },
      }
    );

    logger.info("Donation refunded", {
      donationId,
      refundId: refund.id,
      amount: partialAmount || donation.amount,
      adminId: ctx.admin.id,
    });

    return Response.json({
      message: "Refund processed successfully",
      refundId: refund.id,
      amount: partialAmount || donation.amount,
      status: refund.status,
    });
  } catch (error) {
    logger.error("Error refunding donation", {
      error: error instanceof Error ? error.message : "Unknown error",
      donationId,
    });

    if (error instanceof Error && error.name === "StripeError") {
      return Response.json(
        { error: "REFUND_FAILED", message: "Failed to process refund with payment provider" },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
