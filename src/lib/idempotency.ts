// Monobun Donation System - Idempotency Key Management

import {
  findIdempotencyKey,
  createIdempotencyKey,
  cleanupExpiredIdempotencyKeys,
} from "./db";
import { logger } from "./logger";

const IDEMPOTENCY_KEY_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface IdempotencyResult<T> {
  cached: boolean;
  response: T;
}

/**
 * Check if an idempotency key has already been used
 * Returns the cached response if found
 */
export async function checkIdempotencyKey<T>(
  key: string
): Promise<T | null> {
  try {
    const cached = await findIdempotencyKey(key);
    if (cached) {
      logger.info("Idempotency key hit", { key });
      return cached.response as T;
    }
    return null;
  } catch (error) {
    logger.error("Error checking idempotency key", {
      error: error instanceof Error ? error.message : "Unknown error",
      key,
    });
    return null;
  }
}

/**
 * Store a response with an idempotency key
 */
export async function storeIdempotencyKey<T>(
  key: string,
  response: T
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_KEY_TTL);
    await createIdempotencyKey(key, response, expiresAt);
    logger.debug("Idempotency key stored", { key });
  } catch (error) {
    // Log but don't fail - idempotency is a safety feature
    logger.error("Error storing idempotency key", {
      error: error instanceof Error ? error.message : "Unknown error",
      key,
    });
  }
}

/**
 * Execute an operation with idempotency protection
 * If the key was already used, returns the cached response
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>
): Promise<IdempotencyResult<T>> {
  // Check for cached response
  const cached = await checkIdempotencyKey<T>(key);
  if (cached !== null) {
    return { cached: true, response: cached };
  }

  // Execute the operation
  const response = await operation();

  // Store the response
  await storeIdempotencyKey(key, response);

  return { cached: false, response };
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKeyFromRequest(request: Request): string | null {
  return request.headers.get("Idempotency-Key");
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  // Must be between 1 and 255 characters
  if (!key || key.length > 255) {
    return false;
  }
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Cleanup expired idempotency keys (call periodically)
 */
export async function cleanupIdempotencyKeys(): Promise<number> {
  try {
    const count = await cleanupExpiredIdempotencyKeys();
    if (count > 0) {
      logger.info("Cleaned up expired idempotency keys", { count });
    }
    return count;
  } catch (error) {
    logger.error("Error cleaning up idempotency keys", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return 0;
  }
}

// Run cleanup every hour
setInterval(cleanupIdempotencyKeys, 60 * 60 * 1000);
