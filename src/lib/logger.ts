// Monobun Donation System - Structured Logger

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_LEVEL = (process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug")) as LogLevel;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

/**
 * Mask email address for privacy in logs
 * user@example.com -> u***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `***@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Mask sensitive data in objects
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  const sensitiveKeys = ["password", "token", "secret", "authorization", "cookie", "csrf"];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      masked[key] = "[REDACTED]";
    } else if (lowerKey === "email" && typeof value === "string") {
      masked[key] = maskEmail(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function formatLog(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (data) {
    const maskedData = maskSensitiveData(data);
    Object.assign(entry, maskedData);
  }

  if (IS_PRODUCTION) {
    // JSON format for production (easier to parse by log aggregators)
    console.log(JSON.stringify(entry));
  } else {
    // Pretty format for development
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m",  // green
      warn: "\x1b[33m",  // yellow
      error: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";
    const color = levelColors[level];

    let output = `${color}[${level.toUpperCase()}]${reset} ${entry.timestamp} - ${message}`;
    if (data) {
      output += ` ${JSON.stringify(maskSensitiveData(data), null, 2)}`;
    }
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => formatLog("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) => formatLog("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => formatLog("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => formatLog("error", message, data),

  /**
   * Log HTTP request
   */
  request: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    data?: Record<string, unknown>
  ) => {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    formatLog(level, `${method} ${path}`, {
      statusCode,
      durationMs,
      ...data,
    });
  },

  /**
   * Log security-related events
   */
  security: (event: string, data?: Record<string, unknown>) => {
    formatLog("warn", `[SECURITY] ${event}`, data);
  },
};

export default logger;
