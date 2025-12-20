// Monobun Donation System - Rate Limiting Tests

import { describe, test, expect, beforeEach } from "bun:test";
import { rateLimit, cleanupMemoryCache } from "./rate-limit";

// Helper to create a mock request
function createRequest(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("Rate Limiting", () => {
  beforeEach(() => {
    // Clean up cache between tests
    cleanupMemoryCache();
  });

  test("allows requests under the limit", async () => {
    const request = createRequest("GET", "/api/events");
    const clientIp = "192.168.1.1";

    const result = await rateLimit(request, clientIp, false);

    expect(result.allowed).toBe(true);
    expect(result.response).toBeUndefined();
  });

  test("includes rate limit headers", async () => {
    const request = createRequest("GET", "/api/events");
    const clientIp = "192.168.1.2";

    const result = await rateLimit(request, clientIp, false);

    expect(result.headers["X-RateLimit-Limit"]).toBeDefined();
    expect(result.headers["X-RateLimit-Remaining"]).toBeDefined();
    expect(result.headers["X-RateLimit-Reset"]).toBeDefined();
  });

  test("decrements remaining count", async () => {
    const request = createRequest("GET", "/api/events");
    const clientIp = "192.168.1.3";

    const result1 = await rateLimit(request, clientIp, false);
    const result2 = await rateLimit(request, clientIp, false);

    const remaining1 = parseInt(result1.headers["X-RateLimit-Remaining"], 10);
    const remaining2 = parseInt(result2.headers["X-RateLimit-Remaining"], 10);

    expect(remaining2).toBe(remaining1 - 1);
  });

  test("blocks requests over the limit", async () => {
    const request = createRequest("POST", "/api/auth/login");
    const clientIp = "192.168.1.4";

    // Login limit is 5 per 15 minutes
    for (let i = 0; i < 5; i++) {
      await rateLimit(request, clientIp, false);
    }

    // 6th request should be blocked
    const result = await rateLimit(request, clientIp, false);

    expect(result.allowed).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response?.status).toBe(429);
  });

  test("returns Retry-After header when blocked", async () => {
    const request = createRequest("POST", "/api/auth/login");
    const clientIp = "192.168.1.5";

    // Exhaust the limit
    for (let i = 0; i < 6; i++) {
      await rateLimit(request, clientIp, false);
    }

    const result = await rateLimit(request, clientIp, false);

    expect(result.headers["Retry-After"]).toBeDefined();
    expect(parseInt(result.headers["Retry-After"], 10)).toBeGreaterThan(0);
  });

  test("applies stricter limits to auth endpoints", async () => {
    const eventsRequest = createRequest("GET", "/api/events");
    const loginRequest = createRequest("POST", "/api/auth/login");
    const clientIp = "192.168.1.6";

    const eventsResult = await rateLimit(eventsRequest, clientIp, false);
    const loginResult = await rateLimit(loginRequest, clientIp, false);

    const eventsLimit = parseInt(eventsResult.headers["X-RateLimit-Limit"], 10);
    const loginLimit = parseInt(loginResult.headers["X-RateLimit-Limit"], 10);

    // Events should have higher limit than login
    expect(eventsLimit).toBeGreaterThan(loginLimit);
  });

  test("separates limits by IP", async () => {
    const request = createRequest("POST", "/api/auth/login");
    const ip1 = "192.168.1.7";
    const ip2 = "192.168.1.8";

    // Use up IP1's limit
    for (let i = 0; i < 5; i++) {
      await rateLimit(request, ip1, false);
    }

    // IP2 should still be allowed
    const result = await rateLimit(request, ip2, false);

    expect(result.allowed).toBe(true);
  });

  test("applies admin endpoint limits", async () => {
    const request = createRequest("GET", "/api/admin/donations");
    const clientIp = "192.168.1.9";

    const result = await rateLimit(request, clientIp, false);

    // Admin endpoints should have 120/min limit
    const limit = parseInt(result.headers["X-RateLimit-Limit"], 10);
    expect(limit).toBe(120);
  });
});
