// Monobun Donation System - Auth Library Tests

import { describe, test, expect } from "bun:test";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateCsrfToken,
  generateResetToken,
  generateCancelToken,
  generateId,
  isValidSessionToken,
} from "./auth";

describe("Password Hashing", () => {
  test("hashPassword creates Argon2id hash", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toContain("$argon2id$");
    expect(hash.length).toBeGreaterThan(50);
  });

  test("hashPassword creates different hashes for same password", async () => {
    const password = "TestPassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  test("verifyPassword returns true for correct password", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  test("verifyPassword returns false for incorrect password", async () => {
    const password = "TestPassword123!";
    const wrongPassword = "WrongPassword456!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  test("verifyPassword returns false for invalid hash", async () => {
    const isValid = await verifyPassword("password", "invalid-hash");
    expect(isValid).toBe(false);
  });
});

describe("Token Generation", () => {
  test("generateSessionToken creates 64-character hex string", () => {
    const token = generateSessionToken();

    expect(token).toBeDefined();
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test("generateSessionToken creates unique tokens", () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBe(100);
  });

  test("generateCsrfToken creates 64-character hex string", () => {
    const token = generateCsrfToken();

    expect(token).toBeDefined();
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test("generateResetToken creates 64-character hex string", () => {
    const token = generateResetToken();

    expect(token).toBeDefined();
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test("generateCancelToken creates 64-character hex string", () => {
    const token = generateCancelToken();

    expect(token).toBeDefined();
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });
});

describe("ID Generation", () => {
  test("generateId creates ID with correct prefix", () => {
    const donationId = generateId("don");
    const subscriptionId = generateId("sub");

    expect(donationId).toMatch(/^don_[A-Za-z0-9_-]+$/);
    expect(subscriptionId).toMatch(/^sub_[A-Za-z0-9_-]+$/);
  });

  test("generateId creates unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId("test"));
    }
    expect(ids.size).toBe(100);
  });
});

describe("Token Validation", () => {
  test("isValidSessionToken returns true for valid token", () => {
    const token = generateSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
  });

  test("isValidSessionToken returns false for short token", () => {
    expect(isValidSessionToken("abc123")).toBe(false);
  });

  test("isValidSessionToken returns false for non-hex token", () => {
    expect(isValidSessionToken("z".repeat(64))).toBe(false);
  });

  test("isValidSessionToken returns false for empty token", () => {
    expect(isValidSessionToken("")).toBe(false);
  });
});
