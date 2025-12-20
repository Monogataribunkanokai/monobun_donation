// Monobun Donation System - IP Filter Tests

import { describe, test, expect } from "bun:test";
import { getClientIP, getTrustedProxies } from "./ip-filter";

// Helper to create a mock request with headers
function createRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/admin/test", {
    headers: new Headers(headers),
  });
}

describe("Client IP Detection", () => {
  test("returns direct IP when no proxy headers", () => {
    const request = createRequest({});
    const directIp = "203.0.113.50";

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe(directIp);
  });

  test("uses X-Forwarded-For from trusted proxy", () => {
    const request = createRequest({
      "X-Forwarded-For": "203.0.113.100, 10.0.0.1",
    });
    const directIp = "127.0.0.1"; // Localhost is trusted

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe("203.0.113.100");
  });

  test("ignores X-Forwarded-For from untrusted proxy", () => {
    const request = createRequest({
      "X-Forwarded-For": "192.0.2.100",
    });
    const directIp = "203.0.113.50"; // Not in trusted list

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe(directIp);
  });

  test("uses X-Real-IP from trusted proxy", () => {
    const request = createRequest({
      "X-Real-IP": "203.0.113.200",
    });
    const directIp = "10.0.0.5"; // Private IP is trusted

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe("203.0.113.200");
  });

  test("prefers X-Forwarded-For over X-Real-IP", () => {
    const request = createRequest({
      "X-Forwarded-For": "203.0.113.100",
      "X-Real-IP": "203.0.113.200",
    });
    const directIp = "127.0.0.1";

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe("203.0.113.100");
  });

  test("handles multiple IPs in X-Forwarded-For", () => {
    const request = createRequest({
      "X-Forwarded-For": "203.0.113.50, 10.0.0.1, 172.16.0.1",
    });
    const directIp = "127.0.0.1";

    const clientIp = getClientIP(request, directIp);

    // Should return the first (original client) IP
    expect(clientIp).toBe("203.0.113.50");
  });

  test("handles whitespace in X-Forwarded-For", () => {
    const request = createRequest({
      "X-Forwarded-For": "  203.0.113.50  , 10.0.0.1",
    });
    const directIp = "127.0.0.1";

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe("203.0.113.50");
  });

  test("returns direct IP for invalid X-Forwarded-For", () => {
    const request = createRequest({
      "X-Forwarded-For": "not-an-ip",
    });
    const directIp = "127.0.0.1";

    const clientIp = getClientIP(request, directIp);

    expect(clientIp).toBe(directIp);
  });
});

describe("Trusted Proxies", () => {
  test("includes localhost by default", () => {
    const proxies = getTrustedProxies();
    expect(proxies).toContain("127.0.0.1");
  });

  test("includes private network ranges", () => {
    const proxies = getTrustedProxies();
    expect(proxies.some((p) => p.startsWith("10."))).toBe(true);
    expect(proxies.some((p) => p.startsWith("172.16."))).toBe(true);
    expect(proxies.some((p) => p.startsWith("192.168."))).toBe(true);
  });
});
