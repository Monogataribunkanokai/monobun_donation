// Monobun Donation System - Logger Tests

import { describe, test, expect } from "bun:test";
import { maskEmail, maskSensitiveData } from "./logger";

describe("Email Masking", () => {
  test("masks email correctly", () => {
    expect(maskEmail("user@example.com")).toBe("u***@example.com");
  });

  test("masks short local part", () => {
    expect(maskEmail("a@example.com")).toBe("***@example.com");
  });

  test("handles invalid email", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });

  test("handles empty string", () => {
    expect(maskEmail("")).toBe("***");
  });
});

describe("Sensitive Data Masking", () => {
  test("masks password fields", () => {
    const data = { password: "secret123", username: "admin" };
    const masked = maskSensitiveData(data);

    expect(masked.password).toBe("[REDACTED]");
    expect(masked.username).toBe("admin");
  });

  test("masks token fields", () => {
    const data = { accessToken: "abc123", refreshToken: "xyz789", id: "123" };
    const masked = maskSensitiveData(data);

    expect(masked.accessToken).toBe("[REDACTED]");
    expect(masked.refreshToken).toBe("[REDACTED]");
    expect(masked.id).toBe("123");
  });

  test("masks authorization headers", () => {
    const data = { authorization: "Bearer token", method: "GET" };
    const masked = maskSensitiveData(data);

    expect(masked.authorization).toBe("[REDACTED]");
    expect(masked.method).toBe("GET");
  });

  test("masks email fields", () => {
    const data = { email: "user@example.com", name: "John" };
    const masked = maskSensitiveData(data);

    expect(masked.email).toBe("u***@example.com");
    expect(masked.name).toBe("John");
  });

  test("masks nested objects", () => {
    const data = {
      user: {
        email: "user@example.com",
        password: "secret",
      },
      action: "login",
    };
    const masked = maskSensitiveData(data);

    expect((masked.user as any).email).toBe("u***@example.com");
    expect((masked.user as any).password).toBe("[REDACTED]");
    expect(masked.action).toBe("login");
  });

  test("handles cookie fields", () => {
    const data = { sessionCookie: "abc123", path: "/" };
    const masked = maskSensitiveData(data);

    expect(masked.sessionCookie).toBe("[REDACTED]");
    expect(masked.path).toBe("/");
  });

  test("handles CSRF fields", () => {
    const data = { csrfToken: "token123", method: "POST" };
    const masked = maskSensitiveData(data);

    expect(masked.csrfToken).toBe("[REDACTED]");
    expect(masked.method).toBe("POST");
  });
});
