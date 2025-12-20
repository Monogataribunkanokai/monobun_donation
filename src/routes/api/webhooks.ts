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
  findDonationByPaymentIntent,
  updateDonationStatus,
  findSubscriptionById,
  findSubscriptionByStripeId,
  updateSubscriptionStripeIds,
  updateSubscriptionStatusByStripeId,
  markDonationDisputed,
  findEventById,
} from "../../lib/db";
import { logger } from "../../lib/logger";
import { getClientIP } from "../../middleware/ip-filter";
import {
  sendDonationConfirmationEmail,
  sendSubscriptionConfirmationEmail,
  sendPaymentFailureEmail,
  sendSubscriptionCancelledEmail,
} from "../../lib/mail";

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
  const stripeSubscriptionId = session.subscription as string | undefined;
  const metadata = session.metadata as Record<string, string> | undefined;
  const customerEmail = session.customer_email as string | undefined;

  logger.info("Checkout session completed", {
    sessionId,
    mode,
    paymentIntent,
    stripeSubscriptionId,
  });

  if (mode === "payment") {
    // One-time or event donation
    const donation = await findDonationByStripeSession(sessionId);
    if (donation) {
      await updateDonationStatus(donation.id, "completed", paymentIntent);
      logger.info("Donation marked as completed", { donationId: donation.id });

      // Send confirmation email
      if (donation.donor_email) {
        let eventName: string | undefined;
        if (donation.event_id) {
          const event = await findEventById(donation.event_id);
          eventName = event?.name;
        }

        await sendDonationConfirmationEmail(
          donation.donor_email,
          donation.donor_name || "サポーター",
          donation.amount,
          donation.id,
          eventName
        );
      }
    } else {
      logger.warn("Donation not found for session", { sessionId });
    }
  } else if (mode === "subscription") {
    // Subscription checkout - update with Stripe IDs
    const internalSubId = metadata?.subscription_id;
    if (internalSubId && stripeSubscriptionId) {
      const subscription = await findSubscriptionById(internalSubId);
      if (subscription) {
        const customerId = session.customer as string;
        await updateSubscriptionStripeIds(internalSubId, stripeSubscriptionId, customerId);
        logger.info("Subscription Stripe IDs updated", {
          internalId: internalSubId,
          stripeSubscriptionId,
        });

        // Send confirmation email
        if (subscription.donor_email) {
          await sendSubscriptionConfirmationEmail(
            subscription.donor_email,
            subscription.donor_name || "サポーター",
            subscription.amount,
            subscription.type as "monthly" | "yearly",
            subscription.id,
            subscription.cancel_token
          );
        }
      }
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

  // Update our subscription record with Stripe IDs (may already be done in checkout.session.completed)
  await updateSubscriptionStripeIds(internalSubId, stripeSubId, customerId);
}

async function handleSubscriptionUpdated(
  subscription: Record<string, unknown>
): Promise<void> {
  const stripeSubId = subscription.id as string;
  const stripeStatus = subscription.status as string;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;
  const currentPeriodEnd = subscription.current_period_end as number;

  logger.info("Subscription updated", {
    stripeSubId,
    status: stripeStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
  });

  // Map Stripe status to our status
  // Stripe statuses: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused
  let ourStatus: "active" | "cancelled" | "past_due" | "paused";
  switch (stripeStatus) {
    case "active":
    case "trialing":
      ourStatus = "active";
      break;
    case "past_due":
    case "unpaid":
      ourStatus = "past_due";
      break;
    case "canceled":
    case "incomplete_expired":
      ourStatus = "cancelled";
      break;
    case "paused":
      ourStatus = "paused";
      break;
    default:
      // incomplete - still pending, don't update
      return;
  }

  await updateSubscriptionStatusByStripeId(stripeSubId, ourStatus);
}

async function handleSubscriptionDeleted(
  subscription: Record<string, unknown>
): Promise<void> {
  const stripeSubId = subscription.id as string;
  const currentPeriodEnd = subscription.current_period_end as number;

  logger.info("Subscription deleted", { stripeSubId });

  // Mark subscription as cancelled in our database
  await updateSubscriptionStatusByStripeId(stripeSubId, "cancelled");

  // Send cancellation confirmation email
  const sub = await findSubscriptionByStripeId(stripeSubId);
  if (sub && sub.donor_email) {
    const endDate = new Date(currentPeriodEnd * 1000);
    await sendSubscriptionCancelledEmail(
      sub.donor_email,
      sub.donor_name || "サポーター",
      endDate
    );
  }
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
  const stripeSubscriptionId = invoice.subscription as string | undefined;
  const customerEmail = invoice.customer_email as string | undefined;
  const attemptCount = invoice.attempt_count as number;

  logger.warn("Invoice payment failed", {
    invoiceId,
    stripeSubscriptionId,
    customerEmail,
    attemptCount,
  });

  // Update subscription status to past_due
  if (stripeSubscriptionId) {
    await updateSubscriptionStatusByStripeId(stripeSubscriptionId, "past_due");

    // Send payment failure notification to customer
    const sub = await findSubscriptionByStripeId(stripeSubscriptionId);
    if (sub && sub.donor_email) {
      await sendPaymentFailureEmail(
        sub.donor_email,
        sub.donor_name || "サポーター",
        sub.id
      );
    }
  }
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
  if (paymentIntentId) {
    const donation = await findDonationByPaymentIntent(paymentIntentId);
    if (donation) {
      await markDonationDisputed(donation.id);
      logger.security("Donation marked as disputed", {
        donationId: donation.id,
        disputeId,
        reason,
      });
    }
  }

  // This is a serious event - admin should be notified via logging/monitoring
}
