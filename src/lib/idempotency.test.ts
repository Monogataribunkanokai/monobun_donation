// Monobun Donation System - Idempotency Tests

import { describe, test, expect } from "bun:test";
import {
  getIdempotencyKeyFromRequest,
  isValidIdempotencyKey,
} from "./idempotency";

describe("Idempotency Key Validation", () => {
  test("validates correct key format", () => {
    expect(isValidIdempotencyKey("idem_abc123")).toBe(true);
    expect(isValidIdempotencyKey("request-123-abc")).toBe(true);
    expect(isValidIdempotencyKey("a_b_c")).toBe(true);
    expect(isValidIdempotencyKey("ABC123")).toBe(true);
  });

  test("rejects empty key", () => {
    expect(isValidIdempotencyKey("")).toBe(false);
  });

  test("rejects key with spaces", () => {
    expect(isValidIdempotencyKey("key with spaces")).toBe(false);
  });

  test("rejects key with special characters", () => {
    expect(isValidIdempotencyKey("key@special")).toBe(false);
    expect(isValidIdempotencyKey("key!bang")).toBe(false);
    expect(isValidIdempotencyKey("key#hash")).toBe(false);
  });

  test("rejects key exceeding 255 characters", () => {
    const longKey = "a".repeat(256);
    expect(isValidIdempotencyKey(longKey)).toBe(false);
  });

  test("accepts key at 255 characters", () => {
    const maxKey = "a".repeat(255);
    expect(isValidIdempotencyKey(maxKey)).toBe(true);
  });
});

describe("Idempotency Key from Request", () => {
  test("extracts key from header", () => {
    const request = new Request("http://localhost/api/donations", {
      headers: { "Idempotency-Key": "test-key-123" },
    });
    expect(getIdempotencyKeyFromRequest(request)).toBe("test-key-123");
  });

  test("returns null when header is missing", () => {
    const request = new Request("http://localhost/api/donations");
    expect(getIdempotencyKeyFromRequest(request)).toBeNull();
  });

  test("handles case-insensitive header name", () => {
    const request = new Request("http://localhost/api/donations", {
      headers: { "idempotency-key": "test-key-456" },
    });
    expect(getIdempotencyKeyFromRequest(request)).toBe("test-key-456");
  });
});
