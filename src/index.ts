// Monobun Donation System - Main Server Entry Point

import { logger } from "./lib/logger";
import { healthCheck } from "./lib/db";
import { requireAuth } from "./middleware/auth";
import { validateCsrf } from "./middleware/csrf";
import { rateLimit } from "./middleware/rate-limit";
import { ipFilter, getClientIP } from "./middleware/ip-filter";
import { applySecurityHeaders } from "./middleware/security-headers";
import {
  handleLogin,
  handleLogout,
  handleLogoutAll,
  handleGetMe,
  handleChangePassword,
  handleForgotPassword,
  handleResetPassword,
} from "./routes/api/auth";

const PORT = parseInt(process.env.PORT || "3000", 10);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Generate request ID for error tracking
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Main request handler
async function handleRequest(request: Request, server: any): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get client IP from server info
  const directIp = server.requestIP(request)?.address || "unknown";
  const clientIp = getClientIP(request, directIp);

  // Add request ID to all responses
  const addRequestId = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set("X-Request-ID", requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  try {
    // Rate limiting (for all endpoints)
    const rateLimitResult = await rateLimit(request, clientIp);
    if (!rateLimitResult.allowed) {
      return addRequestId(applySecurityHeaders(rateLimitResult.response!));
    }

    // Route handling
    let response: Response;

    // Health check
    if (path === "/health" && method === "GET") {
      const dbHealthy = await healthCheck();
      response = Response.json(
        { status: dbHealthy ? "healthy" : "unhealthy", database: dbHealthy },
        { status: dbHealthy ? 200 : 503 }
      );
    }

    // Auth routes (public)
    else if (path === "/api/auth/login" && method === "POST") {
      response = await handleLogin({ request, directIp });
    } else if (path === "/api/auth/forgot-password" && method === "POST") {
      response = await handleForgotPassword({ request, directIp });
    } else if (path === "/api/auth/reset-password" && method === "POST") {
      response = await handleResetPassword({ request, directIp });
    } else if (path === "/api/auth/change-password" && method === "POST") {
      response = await handleChangePassword({ request, directIp });
    }

    // Auth routes (authenticated)
    else if (path === "/api/auth/logout" && method === "POST") {
      const authResult = await requireAuth(request, directIp);
      if (!authResult.success) {
        response = authResult.response;
      } else {
        response = await handleLogout({
          request,
          directIp,
          admin: authResult.admin,
          session: authResult.session,
        });
      }
    } else if (path === "/api/auth/logout-all" && method === "POST") {
      const authResult = await requireAuth(request, directIp);
      if (!authResult.success) {
        response = authResult.response;
      } else {
        response = await handleLogoutAll({
          request,
          directIp,
          admin: authResult.admin,
          session: authResult.session,
        });
      }
    } else if (path === "/api/auth/me" && method === "GET") {
      const authResult = await requireAuth(request, directIp);
      if (!authResult.success) {
        response = authResult.response;
      } else {
        response = await handleGetMe({
          request,
          directIp,
          admin: authResult.admin,
          session: authResult.session,
        });
      }
    }

    // Admin routes (authenticated + IP filtered)
    else if (path.startsWith("/api/admin/")) {
      // IP filter for admin endpoints
      const ipFilterResult = await ipFilter(request, directIp);
      if (ipFilterResult) {
        response = ipFilterResult;
      } else {
        // Authentication required
        const authResult = await requireAuth(request, directIp);
        if (!authResult.success) {
          response = authResult.response;
        } else {
          // TODO: Implement admin routes (donations, events, subscriptions, settings, stats)
          response = Response.json(
            { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
            { status: 501 }
          );
        }
      }
    }

    // Public API routes
    else if (path === "/api/events" && method === "GET") {
      // TODO: Implement public events listing
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    } else if (path.startsWith("/api/events/") && method === "GET") {
      // TODO: Implement event details
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    } else if (path === "/api/donations" && method === "POST") {
      // TODO: Implement donation creation
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    } else if (path === "/api/subscriptions" && method === "POST") {
      // TODO: Implement subscription creation
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    } else if (path.startsWith("/api/subscriptions/") && path.endsWith("/cancel") && method === "POST") {
      // TODO: Implement subscription cancellation
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    }

    // Webhook routes
    else if (path === "/api/webhooks/stripe" && method === "POST") {
      // TODO: Implement Stripe webhook
      response = Response.json(
        { error: "NOT_IMPLEMENTED", message: "This endpoint is not yet implemented" },
        { status: 501 }
      );
    }

    // 404 for unknown routes
    else {
      response = Response.json(
        { error: "NOT_FOUND", message: `${method} ${path} not found` },
        { status: 404 }
      );
    }

    // Apply security headers and rate limit headers
    response = applySecurityHeaders(response);
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      response.headers.set(key, value);
    }

    // Log request
    const durationMs = Date.now() - startTime;
    logger.request(method, path, response.status, durationMs, {
      ip: clientIp,
      requestId,
    });

    return addRequestId(response);
  } catch (error) {
    // Error handling
    const durationMs = Date.now() - startTime;
    logger.error("Request error", {
      method,
      path,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: IS_PRODUCTION ? undefined : (error instanceof Error ? error.stack : undefined),
      requestId,
      durationMs,
    });

    const errorResponse = Response.json(
      {
        error: "INTERNAL_ERROR",
        message: IS_PRODUCTION ? "An error occurred. Please try again later." : (error instanceof Error ? error.message : "Unknown error"),
        requestId,
      },
      { status: 500 }
    );

    return addRequestId(applySecurityHeaders(errorResponse));
  }
}

// Start server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

logger.info("Server started", {
  port: PORT,
  environment: IS_PRODUCTION ? "production" : "development",
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  server.stop();
  process.exit(0);
});

export default server;
