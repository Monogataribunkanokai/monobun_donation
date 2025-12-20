// Monobun Donation System - Subscriptions API

import { generateId, generateCancelToken } from "../../lib/auth";
import {
  createSubscription as dbCreateSubscription,
  findSubscriptionById,
  findSubscriptionByCancelToken,
} from "../../lib/db";
import { logger } from "../../lib/logger";
import {
  SubscriptionSchema,
  validateRequest,
  formatZodError,
} from "../../lib/validation";
import {
  createCheckoutSession,
  cancelSubscription as stripeCancelSubscription,
  generateIdempotencyKey,
  isStripeConfigured,
} from "../../lib/stripe";
import {
  withIdempotency,
  getIdempotencyKeyFromRequest,
  isValidIdempotencyKey,
} from "../../lib/idempotency";
import { getClientIP } from "../../middleware/ip-filter";

interface RouteContext {
  request: Request;
  directIp: string;
}

/**
 * POST /api/subscriptions
 * Create a new subscription and return Stripe checkout URL
 */
export async function handleCreateSubscription(ctx: RouteContext): Promise<Response> {
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
    const validation = validateRequest(SubscriptionSchema, body);

    if (!validation.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { type, amount, paymentMethod, donor } = validation.data;

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
      // Generate subscription ID and cancel token
      const subscriptionId = generateId("sub");
      const cancelToken = generateCancelToken();

      // Create Stripe checkout session for subscription
      const checkoutSession = await createCheckoutSession({
        mode: "subscription",
        amount,
        customerEmail: donor.email,
        donationId: subscriptionId,
        interval: type === "yearly" ? "year" : "month",
        metadata: {
          donor_name: donor.name || "Anonymous",
          subscription_id: subscriptionId,
        },
        idempotencyKey,
      });

      // Save subscription to database
      const subscription = await dbCreateSubscription({
        id: subscriptionId,
        type,
        amount,
        donor_email: donor.email,
        donor_name: donor.name || "Anonymous",
        payment_method: paymentMethod,
        stripe_subscription_id: null, // Will be set by webhook
        stripe_customer_id: null, // Will be set by webhook
        status: "pending",
        current_period_start: null,
        current_period_end: null,
        cancel_token: cancelToken,
      });

      logger.info("Subscription created", {
        subscriptionId,
        type,
        amount,
      });

      return {
        id: subscription.id,
        stripeSessionUrl: checkoutSession.url,
        status: subscription.status,
      };
    });

    if (result.cached) {
      logger.info("Returning cached subscription response", { idempotencyKey });
    }

    return Response.json(result.response, { status: 201 });
  } catch (error) {
    logger.error("Error creating subscription", {
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
 * GET /api/subscriptions/:id
 * Get subscription status (public - limited info)
 */
export async function handleGetSubscription(
  ctx: RouteContext,
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

    // Return limited public info
    return Response.json({
      id: subscription.id,
      type: subscription.type,
      status: subscription.status,
      amount: subscription.status === "active" ? subscription.amount : undefined,
      currentPeriodEnd: subscription.current_period_end?.toISOString(),
    });
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
 * POST /api/subscriptions/:id/cancel
 * Cancel a subscription using cancel token (from email link)
 */
export async function handleCancelSubscription(ctx: RouteContext): Promise<Response> {
  const clientIp = getClientIP(ctx.request, ctx.directIp);

  try {
    // Parse request body
    const body = await ctx.request.json();
    const { cancelToken } = body as { cancelToken?: string };

    if (!cancelToken || typeof cancelToken !== "string") {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "cancelToken is required" },
        { status: 400 }
      );
    }

    // Find subscription by cancel token
    const subscription = await findSubscriptionByCancelToken(cancelToken);

    if (!subscription) {
      return Response.json(
        { error: "INVALID_TOKEN", message: "Invalid or expired cancel token" },
        { status: 400 }
      );
    }

    if (subscription.status !== "active") {
      return Response.json(
        { error: "NOT_ACTIVE", message: "Subscription is not active" },
        { status: 400 }
      );
    }

    // Cancel on Stripe (at end of period)
    if (subscription.stripe_subscription_id) {
      await stripeCancelSubscription(subscription.stripe_subscription_id, false);
    }

    logger.info("Subscription cancelled", {
      subscriptionId: subscription.id,
      ip: clientIp,
    });

    return Response.json({
      message: "Subscription will be cancelled at the end of the current billing period",
      cancelledAt: new Date().toISOString(),
      currentPeriodEnd: subscription.current_period_end?.toISOString(),
    });
  } catch (error) {
    logger.error("Error cancelling subscription", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: clientIp,
    });

    if (error instanceof Error && error.name === "StripeError") {
      return Response.json(
        { error: "PAYMENT_ERROR", message: "Error cancelling subscription" },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
