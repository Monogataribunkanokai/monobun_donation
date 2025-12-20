// Monobun Donation System - Stripe Webhook Handler

import {
  verifyWebhookSignature,
  getCheckoutSession,
  getSubscription,
  StripeError,
} from "../../lib/stripe";
import {
  findWebhookEvent,
  createWebhookEvent,
  findDonationByStripeSession,
  updateDonationStatus,
  findSubscriptionById,
} from "../../lib/db";
import { logger } from "../../lib/logger";
import { getClientIP } from "../../middleware/ip-filter";

interface RouteContext {
  request: Request;
  directIp: string;
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);

  try {
    // Get raw body for signature verification
    const rawBody = await ctx.request.text();

    // Get signature header
    const signature = ctx.request.headers.get("Stripe-Signature");
    if (!signature) {
      logger.security("Stripe webhook missing signature", { ip: clientIp });
      return Response.json(
        { error: "MISSING_SIGNATURE", message: "Missing Stripe-Signature header" },
        { status: 400 }
      );
    }

    // Verify signature and parse event
    let event;
    try {
      event = await verifyWebhookSignature(rawBody, signature);
    } catch (error) {
      if (error instanceof StripeError) {
        logger.security("Stripe webhook signature verification failed", {
          ip: clientIp,
          error: error.message,
        });
        return Response.json(
          { error: "INVALID_SIGNATURE", message: "Signature verification failed" },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check for duplicate event (replay attack prevention)
    const existingEvent = await findWebhookEvent(event.id);
    if (existingEvent) {
      logger.info("Duplicate webhook event ignored", { eventId: event.id });
      return Response.json({ received: true, duplicate: true });
    }

    // Process the event
    logger.info("Processing Stripe webhook", {
      eventId: event.id,
      type: event.type,
    });

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object);
        break;

      default:
        logger.debug("Unhandled webhook event type", { type: event.type });
    }

    // Record the event as processed
    await createWebhookEvent(event.id, event.type);

    return Response.json({ received: true });
  } catch (error) {
    logger.error("Error processing Stripe webhook", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: clientIp,
    });

    // Return 200 to prevent Stripe from retrying on our errors
    // (only return 4xx/5xx for signature verification failures)
    return Response.json({ received: true, error: "processing_error" });
  }
}

// === Event Handlers ===

async function handleCheckoutSessionCompleted(
  session: Record<string, unknown>
): Promise<void> {
  const sessionId = session.id as string;
  const mode = session.mode as string;
  const paymentIntent = session.payment_intent as string | undefined;
  const subscriptionId = session.subscription as string | undefined;
  const metadata = session.metadata as Record<string, string> | undefined;

  logger.info("Checkout session completed", {
    sessionId,
    mode,
    paymentIntent,
    subscriptionId,
  });

  if (mode === "payment") {
    // One-time donation
    const donation = await findDonationByStripeSession(sessionId);
    if (donation) {
      await updateDonationStatus(donation.id, "completed", paymentIntent);
      logger.info("Donation marked as completed", { donationId: donation.id });
    } else {
      logger.warn("Donation not found for session", { sessionId });
    }
  } else if (mode === "subscription") {
    // Subscription - will be handled by subscription.created event
    const internalSubId = metadata?.subscription_id;
    if (internalSubId) {
      logger.info("Subscription checkout completed", {
        internalId: internalSubId,
        stripeSubscriptionId: subscriptionId,
      });
    }
  }
}

async function handleCheckoutSessionExpired(
  session: Record<string, unknown>
): Promise<void> {
  const sessionId = session.id as string;

  const donation = await findDonationByStripeSession(sessionId);
  if (donation && donation.status === "pending") {
    await updateDonationStatus(donation.id, "failed");
    logger.info("Donation marked as failed (session expired)", {
      donationId: donation.id,
    });
  }
}

async function handleSubscriptionCreated(
  subscription: Record<string, unknown>
): Promise<void> {
  const stripeSubId = subscription.id as string;
  const status = subscription.status as string;
  const customerId = subscription.customer as string;
  const metadata = subscription.metadata as Record<string, string> | undefined;

  const internalSubId = metadata?.subscription_id;
  if (!internalSubId) {
    logger.warn("Subscription created without internal ID", { stripeSubId });
    return;
  }

  logger.info("Subscription created on Stripe", {
    internalId: internalSubId,
    stripeSubId,
    status,
  });

  // Update our subscription record with Stripe IDs
  // Note: This would need a proper update function in db.ts
  // For now, log the event
}

async function handleSubscriptionUpdated(
  subscription: Record<string, unknown>
): Promise<void> {
  const stripeSubId = subscription.id as string;
  const status = subscription.status as string;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;
  const currentPeriodEnd = subscription.current_period_end as number;

  logger.info("Subscription updated", {
    stripeSubId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
  });

  // Update subscription status in our database
  // Status can be: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid
}

async function handleSubscriptionDeleted(
  subscription: Record<string, unknown>
): Promise<void> {
  const stripeSubId = subscription.id as string;

  logger.info("Subscription deleted", { stripeSubId });

  // Mark subscription as cancelled in our database
}

async function handleInvoicePaid(
  invoice: Record<string, unknown>
): Promise<void> {
  const invoiceId = invoice.id as string;
  const subscriptionId = invoice.subscription as string | undefined;
  const amountPaid = invoice.amount_paid as number;
  const customerEmail = invoice.customer_email as string | undefined;

  logger.info("Invoice paid", {
    invoiceId,
    subscriptionId,
    amountPaid,
    customerEmail,
  });

  // Record invoice payment in our database
  // Send confirmation email to customer
}

async function handleInvoicePaymentFailed(
  invoice: Record<string, unknown>
): Promise<void> {
  const invoiceId = invoice.id as string;
  const subscriptionId = invoice.subscription as string | undefined;
  const customerEmail = invoice.customer_email as string | undefined;
  const attemptCount = invoice.attempt_count as number;

  logger.warn("Invoice payment failed", {
    invoiceId,
    subscriptionId,
    customerEmail,
    attemptCount,
  });

  // Send payment failure notification to customer
  // Consider pausing or cancelling subscription after X failures
}

async function handleDisputeCreated(
  dispute: Record<string, unknown>
): Promise<void> {
  const disputeId = dispute.id as string;
  const paymentIntentId = dispute.payment_intent as string | undefined;
  const amount = dispute.amount as number;
  const reason = dispute.reason as string;

  logger.security("Payment dispute created", {
    disputeId,
    paymentIntentId,
    amount,
    reason,
  });

  // Mark donation as disputed
  // Alert admin
  // This is a serious event that needs attention
}
