// Monobun Donation System - Stripe Integration
// Minimal Stripe API client using fetch (no external dependencies)

import { generateId } from "./auth";
import { logger } from "./logger";

// === Configuration ===

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

if (!STRIPE_SECRET_KEY) {
  logger.warn("STRIPE_SECRET_KEY not set. Stripe operations will fail.");
}

// === Types ===

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_intent?: string;
  subscription?: string;
  customer?: string;
  status: string;
  mode: "payment" | "subscription";
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      id: string;
      price: { id: string; unit_amount: number };
    }>;
  };
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  status: string;
  customer?: string;
}

export interface StripeRefund {
  id: string;
  amount: number;
  status: string;
  payment_intent: string;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: "month" | "year";
    interval_count: number;
  };
}

// === API Helper ===

interface StripeRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
}

async function stripeRequest<T>(
  endpoint: string,
  options: StripeRequestOptions = {}
): Promise<T> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const url = `${STRIPE_API_BASE}${endpoint}`;
  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body && options.method !== "GET") {
    fetchOptions.body = encodeFormData(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    const error = data.error || {};
    logger.error("Stripe API error", {
      endpoint,
      status: response.status,
      type: error.type,
      message: error.message,
    });
    throw new StripeError(
      error.message || "Stripe API error",
      error.type,
      error.code,
      response.status
    );
  }

  return data as T;
}

// Encode object to application/x-www-form-urlencoded format
function encodeFormData(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(encodeFormData(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object") {
          parts.push(encodeFormData(item as Record<string, unknown>, `${fullKey}[${index}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join("&");
}

// === Custom Error ===

export class StripeError extends Error {
  constructor(
    message: string,
    public type?: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "StripeError";
  }
}

// === Customer Operations ===

export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>("/customers", {
    method: "POST",
    body: {
      email,
      name,
      metadata,
    },
  });
}

export async function getCustomer(customerId: string): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(`/customers/${customerId}`);
}

export async function findCustomerByEmail(email: string): Promise<StripeCustomer | null> {
  const response = await stripeRequest<{ data: StripeCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );
  return response.data[0] || null;
}

// === Checkout Session Operations ===

export interface CreateCheckoutSessionParams {
  mode: "payment" | "subscription";
  amount: number;
  currency?: string;
  customerEmail: string;
  customerId?: string;
  donationId: string;
  eventId?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  // For subscriptions
  interval?: "month" | "year";
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<StripeCheckoutSession> {
  const {
    mode,
    amount,
    currency = "jpy",
    customerEmail,
    customerId,
    donationId,
    eventId,
    successUrl = `${APP_URL}/donate/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl = `${APP_URL}/donate/cancel`,
    metadata = {},
    idempotencyKey,
    interval,
  } = params;

  // Validate amount
  if (amount < 100 || amount > 10_000_000) {
    throw new StripeError("Amount must be between 100 and 10,000,000 JPY");
  }

  const sessionParams: Record<string, unknown> = {
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ["card"],
    metadata: {
      ...metadata,
      donation_id: donationId,
      ...(eventId && { event_id: eventId }),
    },
  };

  // Customer handling
  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = customerEmail;
  }

  if (mode === "payment") {
    // One-time payment
    sessionParams.line_items = [
      {
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: eventId ? `寄付: ${eventId}` : "寄付",
          },
        },
        quantity: 1,
      },
    ];
  } else {
    // Subscription
    sessionParams.line_items = [
      {
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: interval === "year" ? "年間サポーター" : "月額サポーター",
          },
          recurring: {
            interval: interval || "month",
          },
        },
        quantity: 1,
      },
    ];
  }

  // PayPay support (if available in Stripe Japan)
  // Note: PayPay via Stripe requires separate configuration
  // sessionParams.payment_method_types.push("paypay");

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    body: sessionParams,
    idempotencyKey,
  });
}

export async function getCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${sessionId}?expand[]=payment_intent&expand[]=subscription`
  );
}

// === Subscription Operations ===

export async function getSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<StripeSubscription> {
  if (immediately) {
    return stripeRequest<StripeSubscription>(`/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });
  }

  // Cancel at end of period
  return stripeRequest<StripeSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "POST",
    body: {
      cancel_at_period_end: true,
    },
  });
}

// === Refund Operations ===

export interface CreateRefundParams {
  paymentIntentId: string;
  amount?: number; // Partial refund amount (optional, defaults to full refund)
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  idempotencyKey: string;
}

export async function createRefund(params: CreateRefundParams): Promise<StripeRefund> {
  const body: Record<string, unknown> = {
    payment_intent: params.paymentIntentId,
  };

  if (params.amount) {
    body.amount = params.amount;
  }

  if (params.reason) {
    body.reason = params.reason;
  }

  return stripeRequest<StripeRefund>("/refunds", {
    method: "POST",
    body,
    idempotencyKey: params.idempotencyKey,
  });
}

// === Webhook Verification ===

/**
 * Verify Stripe webhook signature
 * Uses HMAC-SHA256 as per Stripe's signature scheme
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<StripeEvent> {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new StripeError("STRIPE_WEBHOOK_SECRET is not configured");
  }

  // Parse the signature header
  const elements = signature.split(",");
  const signatureMap: Record<string, string> = {};

  for (const element of elements) {
    const [key, value] = element.split("=");
    signatureMap[key] = value;
  }

  const timestamp = signatureMap["t"];
  const expectedSignature = signatureMap["v1"];

  if (!timestamp || !expectedSignature) {
    throw new StripeError("Invalid signature format", "signature_verification_error");
  }

  // Check timestamp (reject if older than 5 minutes)
  const timestampAge = Date.now() / 1000 - parseInt(timestamp, 10);
  if (timestampAge > 300) {
    throw new StripeError("Webhook timestamp too old", "signature_verification_error");
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (!timingSafeEqual(computedSignature, expectedSignature)) {
    throw new StripeError("Signature verification failed", "signature_verification_error");
  }

  // Parse and return the event
  try {
    const event = JSON.parse(payload) as StripeEvent;
    return event;
  } catch {
    throw new StripeError("Invalid JSON payload", "invalid_payload");
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// === Utility Functions ===

/**
 * Generate idempotency key for Stripe requests
 */
export function generateIdempotencyKey(): string {
  return generateId("idem");
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

/**
 * Get Stripe publishable key (for frontend)
 */
export function getPublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY || "";
}
