// Monobun Donation System - Rate Limiting Middleware

import { incrementRateLimit } from "../lib/db";
import { logger } from "../lib/logger";
import type { RateLimitConfig, RateLimitResult } from "../types";

// Use DB-based rate limiting in production for distributed deployments
const USE_DB_RATE_LIMIT = process.env.NODE_ENV === "production" || process.env.USE_DB_RATE_LIMIT === "true";

// === Rate Limit Configuration ===

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication - strict limits
  "POST /api/auth/login": { window: "15m", max: 5 },
  "POST /api/auth/forgot-password": { window: "1h", max: 3 },

  // Public APIs - moderate limits
  "POST /api/donations": { window: "1m", max: 10 },
  "POST /api/subscriptions": { window: "1m", max: 5 },
  "GET /api/events": { window: "1m", max: 60 },

  // Admin APIs - relaxed limits
  "* /api/admin/*": { window: "1m", max: 120 },

  // Default fallback
  "*": { window: "1m", max: 60 },
};

// In-memory cache for rate limiting (faster than DB for high-traffic endpoints)
const memoryCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid window format: ${window}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Get rate limit config for an endpoint
 */
function getConfig(method: string, path: string): RateLimitConfig {
  // Try exact match first
  const exactKey = `${method} ${path}`;
  if (RATE_LIMITS[exactKey]) {
    return RATE_LIMITS[exactKey];
  }

  // Try wildcard matches
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    // Skip default
    if (pattern === "*") continue;

    // Parse pattern
    const [patternMethod, patternPath] = pattern.split(" ");

    // Check method match
    if (patternMethod !== "*" && patternMethod !== method) continue;

    // Check path match (simple glob support)
    if (patternPath.endsWith("*")) {
      const prefix = patternPath.slice(0, -1);
      if (path.startsWith(prefix)) {
        return config;
      }
    } else if (patternPath === path) {
      return config;
    }
  }

  // Return default
  return RATE_LIMITS["*"];
}

/**
 * Calculate window start time
 */
function getWindowStart(windowMs: number): Date {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return new Date(windowStart);
}

/**
 * Check rate limit using in-memory cache
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const windowMs = parseWindow(config.window);
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const cacheKey = `${key}:${windowStart}`;

  const cached = memoryCache.get(cacheKey);

  if (!cached || cached.resetAt <= now) {
    // Clean up old entries
    memoryCache.delete(cacheKey);
    memoryCache.set(cacheKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.max - 1,
      reset: resetAt,
    };
  }

  cached.count++;
  const remaining = config.max - cached.count;

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      reset: resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining,
    reset: resetAt,
  };
}

/**
 * Check rate limit using database (for distributed deployments)
 */
async function checkDbRateLimit(
  key: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowMs = parseWindow(config.window);
  const windowStart = getWindowStart(windowMs);
  const resetAt = windowStart.getTime() + windowMs;

  const count = await incrementRateLimit(key, endpoint, windowStart);
  const remaining = config.max - count;

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      reset: resetAt,
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    };
  }

  return {
    allowed: true,
    remaining,
    reset: resetAt,
  };
}

/**
 * Rate limiting middleware
 */
export async function rateLimit(
  request: Request,
  clientIp: string,
  useDb: boolean = USE_DB_RATE_LIMIT
): Promise<{ allowed: boolean; response?: Response; headers: Record<string, string> }> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  const endpoint = `${method} ${path}`;

  const config = getConfig(method, path);
  const key = `ip:${clientIp}`;

  let result: RateLimitResult;

  if (useDb) {
    result = await checkDbRateLimit(key, endpoint, config);
  } else {
    result = checkMemoryRateLimit(`${key}:${endpoint}`, config);
  }

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": config.max.toString(),
    "X-RateLimit-Remaining": Math.max(0, result.remaining).toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (!result.allowed) {
    logger.security("Rate limit exceeded", {
      ip: clientIp,
      endpoint,
      limit: config.max,
    });

    headers["Retry-After"] = result.retryAfter!.toString();

    return {
      allowed: false,
      response: Response.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers,
        }
      ),
      headers,
    };
  }

  return { allowed: true, headers };
}

/**
 * Clean up expired entries from memory cache
 */
export function cleanupMemoryCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.resetAt <= now) {
      memoryCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  setInterval(cleanupMemoryCache, 5 * 60 * 1000);
}
