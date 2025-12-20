// Monobun Donation System - Security Headers Middleware

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const APP_URL = process.env.APP_URL || "https://donate.example.com";

/**
 * Default security headers for all responses
 */
export function getSecurityHeaders(options?: {
  allowFrame?: boolean;
  allowedFrameAncestors?: string[];
}): Record<string, string> {
  const headers: Record<string, string> = {
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // XSS protection (legacy, CSP is primary defense)
    "X-XSS-Protection": "1; mode=block",

    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Disable unnecessary browser features
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };

  // HSTS - only in production with HTTPS
  if (IS_PRODUCTION) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // Frame options
  if (options?.allowFrame) {
    // For embeddable pages, use CSP frame-ancestors instead
    // X-Frame-Options doesn't support multiple origins
    if (options.allowedFrameAncestors && options.allowedFrameAncestors.length > 0) {
      // Let CSP handle it
    } else {
      headers["X-Frame-Options"] = "SAMEORIGIN";
    }
  } else {
    headers["X-Frame-Options"] = "DENY";
  }

  return headers;
}

/**
 * Content Security Policy for main pages
 */
export function getCSP(options?: {
  allowFrame?: boolean;
  allowedFrameAncestors?: string[];
  nonce?: string;
}): string {
  const directives: string[] = [
    // Default: only same origin
    "default-src 'self'",

    // Scripts: self and inline (with nonce if provided)
    options?.nonce
      ? `script-src 'self' 'nonce-${options.nonce}'`
      : "script-src 'self'",

    // Styles: self and inline (required for some CSS features)
    "style-src 'self' 'unsafe-inline'",

    // Images: self and data URIs (for inline images), and Stripe
    "img-src 'self' data: https://*.stripe.com",

    // Fonts: self
    "font-src 'self'",

    // Connect: self and Stripe
    "connect-src 'self' https://*.stripe.com",

    // Frames: Stripe for payment UI
    "frame-src https://*.stripe.com",

    // Form actions: self
    "form-action 'self'",

    // Base URI: self
    "base-uri 'self'",

    // Object: none
    "object-src 'none'",

    // Block mixed content
    "block-all-mixed-content",

    // Upgrade insecure requests in production
    ...(IS_PRODUCTION ? ["upgrade-insecure-requests"] : []),
  ];

  // Frame ancestors for embedded content
  if (options?.allowFrame) {
    if (options.allowedFrameAncestors && options.allowedFrameAncestors.length > 0) {
      directives.push(`frame-ancestors 'self' ${options.allowedFrameAncestors.join(" ")}`);
    } else {
      directives.push("frame-ancestors 'self'");
    }
  } else {
    directives.push("frame-ancestors 'none'");
  }

  return directives.join("; ");
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: Response,
  options?: {
    allowFrame?: boolean;
    allowedFrameAncestors?: string[];
    nonce?: string;
  }
): Response {
  const headers = new Headers(response.headers);

  // Apply security headers
  const securityHeaders = getSecurityHeaders(options);
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }

  // Apply CSP
  headers.set("Content-Security-Policy", getCSP(options));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Generate a random nonce for inline scripts
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Security headers middleware
 */
export function securityHeaders(
  options?: {
    allowFrame?: boolean;
    allowedFrameAncestors?: string[];
  }
) {
  return (response: Response): Response => {
    return applySecurityHeaders(response, options);
  };
}
