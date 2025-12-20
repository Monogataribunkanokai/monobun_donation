// Monobun Donation System - IP Filtering Middleware

import { getAllowedIPs } from "../lib/db";
import { logger } from "../lib/logger";

// Trusted proxy networks (configured via environment variable)
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || "127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Cache for allowed IPs (refreshed periodically)
let allowedIPsCache: string[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Parse CIDR notation to check if IP is in range
 */
function ipInCidr(ip: string, cidr: string): boolean {
  // Handle exact match
  if (!cidr.includes("/")) {
    return ip === cidr;
  }

  const [range, bits] = cidr.split("/");
  const mask = parseInt(bits, 10);

  // Convert IPs to numbers
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  if (ipNum === null || rangeNum === null) {
    return false;
  }

  // Calculate subnet mask
  const subnetMask = ~((1 << (32 - mask)) - 1);

  return (ipNum & subnetMask) === (rangeNum & subnetMask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    result = (result << 8) + num;
  }
  return result >>> 0; // Convert to unsigned
}

/**
 * Check if an IP is in a trusted proxy network
 */
function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.some((proxy) => ipInCidr(ip, proxy));
}

/**
 * Get the real client IP address, handling proxies
 */
export function getClientIP(request: Request, directIp: string): string {
  // If the direct connection is from a trusted proxy, check X-Forwarded-For
  if (isTrustedProxy(directIp)) {
    const forwarded = request.headers.get("X-Forwarded-For");
    if (forwarded) {
      // Get the first (leftmost) IP, which is the original client
      const clientIp = forwarded.split(",")[0].trim();

      // Validate it's a valid IP format
      if (/^[\d.]+$/.test(clientIp) || /^[a-f\d:]+$/i.test(clientIp)) {
        return clientIp;
      }
    }

    // Also check X-Real-IP
    const realIp = request.headers.get("X-Real-IP");
    if (realIp && (/^[\d.]+$/.test(realIp) || /^[a-f\d:]+$/i.test(realIp))) {
      return realIp;
    }
  }

  // Not from trusted proxy or no forwarded header, use direct IP
  return directIp;
}

/**
 * Refresh the allowed IPs cache from database
 */
async function refreshAllowedIPsCache(): Promise<void> {
  try {
    const ips = await getAllowedIPs();
    allowedIPsCache = ips.map((ip) => ip.ip_pattern);
    lastCacheUpdate = Date.now();
  } catch (error) {
    logger.error("Failed to refresh allowed IPs cache", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Check if an IP is allowed (for admin access)
 */
async function isIPAllowed(ip: string): Promise<boolean> {
  // Refresh cache if needed
  if (Date.now() - lastCacheUpdate > CACHE_TTL) {
    await refreshAllowedIPsCache();
  }

  // If no IPs are configured, allow all (but log a warning on first check)
  if (allowedIPsCache.length === 0) {
    if (lastCacheUpdate > 0) {
      logger.warn("No IP whitelist configured - all IPs allowed for admin access");
    }
    return true;
  }

  // Check if IP matches any allowed pattern
  return allowedIPsCache.some((pattern) => ipInCidr(ip, pattern));
}

/**
 * IP filter middleware for admin endpoints
 */
export async function ipFilter(
  request: Request,
  directIp: string
): Promise<Response | null> {
  const clientIp = getClientIP(request, directIp);

  // Check if IP is allowed
  const allowed = await isIPAllowed(clientIp);

  if (!allowed) {
    logger.security("IP not in whitelist", {
      ip: clientIp,
      path: new URL(request.url).pathname,
    });

    return Response.json(
      {
        error: "IP_NOT_ALLOWED",
        message: "Access from this IP address is not permitted",
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Force refresh the IP cache (called when IPs are updated)
 */
export async function refreshIPCache(): Promise<void> {
  await refreshAllowedIPsCache();
}

/**
 * Get list of trusted proxy networks (for debugging)
 */
export function getTrustedProxies(): string[] {
  return [...TRUSTED_PROXIES];
}
