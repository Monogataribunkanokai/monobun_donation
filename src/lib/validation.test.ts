// Monobun Donation System - Validation Tests

import { describe, test, expect } from "bun:test";
import {
  LoginSchema,
  PasswordChangeSchema,
  DonationSchema,
  SubscriptionSchema,
  EventSchema,
  passwordSchema,
  validateRequest,
  formatZodError,
} from "./validation";

describe("Password Validation", () => {
  test("accepts valid password with all requirements", () => {
    const result = passwordSchema.safeParse("SecurePassword123");
    expect(result.success).toBe(true);
  });

  test("rejects password shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("Short1Ab");
    expect(result.success).toBe(false);
  });

  test("rejects password without uppercase", () => {
    const result = passwordSchema.safeParse("lowercaseonly123");
    expect(result.success).toBe(false);
  });

  test("rejects password without lowercase", () => {
    const result = passwordSchema.safeParse("UPPERCASEONLY123");
    expect(result.success).toBe(false);
  });

  test("rejects password without numbers", () => {
    const result = passwordSchema.safeParse("NoNumbersHere");
    expect(result.success).toBe(false);
  });

  test("rejects common passwords", () => {
    const result = passwordSchema.safeParse("password123");
    expect(result.success).toBe(false);
  });
});

describe("Login Schema", () => {
  test("accepts valid login data", () => {
    const result = LoginSchema.safeParse({
      email: "admin@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty password", () => {
    const result = LoginSchema.safeParse({
      email: "admin@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  test("accepts optional captcha token", () => {
    const result = LoginSchema.safeParse({
      email: "admin@example.com",
      password: "password123",
      captchaToken: "token123",
    });
    expect(result.success).toBe(true);
  });
});

describe("Donation Schema", () => {
  test("accepts valid one-time donation", () => {
    const result = DonationSchema.safeParse({
      type: "one-time",
      amount: 1000,
      paymentMethod: "card",
      donor: {
        email: "donor@example.com",
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts donation with all optional fields", () => {
    const result = DonationSchema.safeParse({
      type: "event",
      amount: 5000,
      paymentMethod: "paypay",
      eventId: "summer-2025",
      donor: {
        email: "donor@example.com",
        name: "John Doe",
      },
      message: "Thank you for your work!",
    });
    expect(result.success).toBe(true);
  });

  test("rejects amount below minimum", () => {
    const result = DonationSchema.safeParse({
      type: "one-time",
      amount: 50, // Below 100 minimum
      paymentMethod: "card",
      donor: { email: "donor@example.com" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects amount above maximum", () => {
    const result = DonationSchema.safeParse({
      type: "one-time",
      amount: 20_000_000, // Above 10,000,000 maximum
      paymentMethod: "card",
      donor: { email: "donor@example.com" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid event ID format", () => {
    const result = DonationSchema.safeParse({
      type: "event",
      amount: 1000,
      paymentMethod: "card",
      eventId: "Invalid Event ID!", // Contains spaces and special chars
      donor: { email: "donor@example.com" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid payment method", () => {
    const result = DonationSchema.safeParse({
      type: "one-time",
      amount: 1000,
      paymentMethod: "bitcoin", // Not a valid method
      donor: { email: "donor@example.com" },
    });
    expect(result.success).toBe(false);
  });
});

describe("Subscription Schema", () => {
  test("accepts valid monthly subscription", () => {
    const result = SubscriptionSchema.safeParse({
      type: "monthly",
      amount: 500,
      paymentMethod: "card",
      donor: {
        email: "subscriber@example.com",
        name: "Jane Doe",
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts valid yearly subscription", () => {
    const result = SubscriptionSchema.safeParse({
      type: "yearly",
      amount: 5000,
      paymentMethod: "paypay",
      donor: {
        email: "subscriber@example.com",
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid subscription type", () => {
    const result = SubscriptionSchema.safeParse({
      type: "weekly", // Not valid
      amount: 500,
      paymentMethod: "card",
      donor: { email: "subscriber@example.com" },
    });
    expect(result.success).toBe(false);
  });
});

describe("Event Schema", () => {
  test("accepts valid event", () => {
    const result = EventSchema.safeParse({
      id: "summer-2025",
      name: "Summer Festival 2025",
      priceOptions: [
        { label: "Support", amount: 500 },
        { label: "Sponsor", amount: 5000 },
        { label: "Custom", amount: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts event with all optional fields", () => {
    const result = EventSchema.safeParse({
      id: "winter-2025",
      name: "Winter Campaign",
      description: "Help us reach our winter goals!",
      goalAmount: 100000,
      priceOptions: [{ label: "Donate", amount: 1000 }],
      startsAt: "2025-12-01T00:00:00Z",
      endsAt: "2025-12-31T23:59:59Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects event without price options", () => {
    const result = EventSchema.safeParse({
      id: "test-event",
      name: "Test Event",
      priceOptions: [], // Empty array
    });
    expect(result.success).toBe(false);
  });

  test("rejects event with invalid ID format", () => {
    const result = EventSchema.safeParse({
      id: "Invalid ID with Spaces",
      name: "Test Event",
      priceOptions: [{ label: "Donate", amount: 1000 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Validation Utilities", () => {
  test("validateRequest returns success for valid data", () => {
    const result = validateRequest(LoginSchema, {
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  test("validateRequest returns error for invalid data", () => {
    const result = validateRequest(LoginSchema, {
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  test("formatZodError formats errors correctly", () => {
    const result = LoginSchema.safeParse({
      email: "invalid-email",
      password: "valid123",
    });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      // Our simple validator fails on first error (email)
      expect(formatted).toContain("email");
    }
  });
});
