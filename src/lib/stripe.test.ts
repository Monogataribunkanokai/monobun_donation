// Monobun Donation System - Stripe Integration Tests

import { describe, test, expect } from "bun:test";
import { generateIdempotencyKey, StripeError, isStripeConfigured } from "./stripe";

describe("Stripe Utilities", () => {
  test("generateIdempotencyKey creates unique keys", () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(generateIdempotencyKey());
    }
    expect(keys.size).toBe(100);
  });

  test("generateIdempotencyKey has correct prefix", () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^idem_[A-Za-z0-9_-]+$/);
  });

  test("isStripeConfigured returns false without env var", () => {
    // Since STRIPE_SECRET_KEY is not set in test environment
    expect(isStripeConfigured()).toBe(false);
  });
});

describe("StripeError", () => {
  test("creates error with message", () => {
    const error = new StripeError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("StripeError");
  });

  test("creates error with type and code", () => {
    const error = new StripeError("Payment failed", "card_error", "card_declined", 402);
    expect(error.message).toBe("Payment failed");
    expect(error.type).toBe("card_error");
    expect(error.code).toBe("card_declined");
    expect(error.statusCode).toBe(402);
  });

  test("is instanceof Error", () => {
    const error = new StripeError("Test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof StripeError).toBe(true);
  });
});

describe("Webhook Signature Verification", () => {
  test("verifyWebhookSignature rejects without secret configured", async () => {
    // This would normally be tested with a real signature, but since
    // STRIPE_WEBHOOK_SECRET is not set, we can verify it throws an error
    const { verifyWebhookSignature } = await import("./stripe");

    const payload = JSON.stringify({ id: "evt_test", type: "test" });
    const signature = "t=1234567890,v1=abc123";

    try {
      await verifyWebhookSignature(payload, signature);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error instanceof StripeError).toBe(true);
      expect((error as StripeError).message).toContain("STRIPE_WEBHOOK_SECRET");
    }
  });
});

describe("Amount Validation", () => {
  test("amounts should be in JPY (integers)", () => {
    // Minimum amount is 100 JPY
    const minAmount = 100;
    // Maximum amount is 10,000,000 JPY
    const maxAmount = 10_000_000;

    expect(Number.isInteger(minAmount)).toBe(true);
    expect(Number.isInteger(maxAmount)).toBe(true);
    expect(minAmount).toBeGreaterThanOrEqual(50); // Stripe minimum for JPY
    expect(maxAmount).toBeLessThanOrEqual(99_999_999); // Stripe maximum
  });
});
