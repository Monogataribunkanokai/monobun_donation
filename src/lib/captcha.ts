// Monobun Donation System - CAPTCHA Verification (Cloudflare Turnstile)

import { logger } from "./logger";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

interface VerifyCaptchaResult {
  success: boolean;
  error?: string;
}

/**
 * Check if CAPTCHA is configured
 */
export function isCaptchaConfigured(): boolean {
  return !!TURNSTILE_SECRET_KEY;
}

/**
 * Verify Turnstile CAPTCHA token
 */
export async function verifyCaptcha(
  token: string,
  clientIp?: string
): Promise<VerifyCaptchaResult> {
  if (!TURNSTILE_SECRET_KEY) {
    // In development, skip CAPTCHA verification
    logger.warn("TURNSTILE_SECRET_KEY not configured. CAPTCHA verification skipped.");
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "CAPTCHA token is required" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      const errorCodes = data["error-codes"] || [];
      logger.warn("CAPTCHA verification failed", {
        errorCodes,
        clientIp,
      });
      return {
        success: false,
        error: mapErrorCode(errorCodes[0]),
      };
    }

    logger.debug("CAPTCHA verification successful", {
      hostname: data.hostname,
      clientIp,
    });

    return { success: true };
  } catch (error) {
    logger.error("CAPTCHA verification error", {
      error: error instanceof Error ? error.message : "Unknown error",
      clientIp,
    });
    return { success: false, error: "CAPTCHA verification failed" };
  }
}

/**
 * Map Turnstile error codes to user-friendly messages
 */
function mapErrorCode(code?: string): string {
  switch (code) {
    case "missing-input-secret":
    case "invalid-input-secret":
      return "Server configuration error";
    case "missing-input-response":
      return "CAPTCHA token is required";
    case "invalid-input-response":
      return "Invalid CAPTCHA token";
    case "bad-request":
      return "Invalid request";
    case "timeout-or-duplicate":
      return "CAPTCHA expired. Please try again.";
    default:
      return "CAPTCHA verification failed";
  }
}
