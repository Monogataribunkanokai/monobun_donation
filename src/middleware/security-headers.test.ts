// Monobun Donation System - Security Headers Tests

import { describe, test, expect } from "bun:test";
import {
  getSecurityHeaders,
  getCSP,
  applySecurityHeaders,
  generateNonce,
} from "./security-headers";

describe("Security Headers", () => {
  test("includes X-Content-Type-Options", () => {
    const headers = getSecurityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  test("includes X-XSS-Protection", () => {
    const headers = getSecurityHeaders();
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
  });

  test("includes Referrer-Policy", () => {
    const headers = getSecurityHeaders();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("includes Permissions-Policy", () => {
    const headers = getSecurityHeaders();
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("microphone=()");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  test("sets X-Frame-Options to DENY by default", () => {
    const headers = getSecurityHeaders();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  test("sets X-Frame-Options to SAMEORIGIN when allowFrame is true", () => {
    const headers = getSecurityHeaders({ allowFrame: true });
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
  });
});

describe("Content Security Policy", () => {
  test("includes default-src self", () => {
    const csp = getCSP();
    expect(csp).toContain("default-src 'self'");
  });

  test("includes script-src self", () => {
    const csp = getCSP();
    expect(csp).toContain("script-src 'self'");
  });

  test("includes style-src with unsafe-inline", () => {
    const csp = getCSP();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  test("allows Stripe in connect-src", () => {
    const csp = getCSP();
    expect(csp).toContain("connect-src 'self' https://*.stripe.com");
  });

  test("allows Stripe frames", () => {
    const csp = getCSP();
    expect(csp).toContain("frame-src https://*.stripe.com");
  });

  test("blocks all frame ancestors by default", () => {
    const csp = getCSP();
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("allows specified frame ancestors when provided", () => {
    const csp = getCSP({
      allowFrame: true,
      allowedFrameAncestors: ["https://example.com", "https://wordpress.example.com"],
    });
    expect(csp).toContain("frame-ancestors 'self' https://example.com https://wordpress.example.com");
  });

  test("includes nonce in script-src when provided", () => {
    const nonce = "abc123";
    const csp = getCSP({ nonce });
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
  });

  test("blocks object-src", () => {
    const csp = getCSP();
    expect(csp).toContain("object-src 'none'");
  });

  test("blocks mixed content", () => {
    const csp = getCSP();
    expect(csp).toContain("block-all-mixed-content");
  });
});

describe("applySecurityHeaders", () => {
  test("applies headers to response", () => {
    const originalResponse = new Response("Hello", { status: 200 });
    const securedResponse = applySecurityHeaders(originalResponse);

    expect(securedResponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(securedResponse.headers.get("Content-Security-Policy")).toBeDefined();
  });

  test("preserves original response body", async () => {
    const originalResponse = new Response("Hello World", { status: 200 });
    const securedResponse = applySecurityHeaders(originalResponse);

    const body = await securedResponse.text();
    expect(body).toBe("Hello World");
  });

  test("preserves original status code", () => {
    const originalResponse = new Response("Not Found", { status: 404 });
    const securedResponse = applySecurityHeaders(originalResponse);

    expect(securedResponse.status).toBe(404);
  });

  test("preserves existing headers", () => {
    const originalResponse = new Response("Hello", {
      headers: { "X-Custom-Header": "value" },
    });
    const securedResponse = applySecurityHeaders(originalResponse);

    expect(securedResponse.headers.get("X-Custom-Header")).toBe("value");
  });
});

describe("Nonce Generation", () => {
  test("generates base64 string", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test("generates unique nonces", () => {
    const nonces = new Set();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    expect(nonces.size).toBe(100);
  });
});
