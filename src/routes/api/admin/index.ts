// Monobun Donation System - Admin API Router

import type { Admin, Session } from "../../../types";
import {
  handleAdminListDonations,
  handleAdminGetDonation,
  handleAdminDonationStats,
} from "./donations";
import { handleAdminRefundDonation } from "./refunds";
import {
  handleAdminListEvents,
  handleAdminGetEvent,
  handleAdminCreateEvent,
  handleAdminUpdateEvent,
  handleAdminDeleteEvent,
} from "./events";
import {
  handleAdminListSubscriptions,
  handleAdminGetSubscription,
  handleAdminCancelSubscription,
  handleAdminSubscriptionStats,
} from "./subscriptions";
import {
  handleAdminGetSettings,
  handleAdminUpdateSettings,
  handleAdminGetIPWhitelist,
  handleAdminAddIPWhitelist,
  handleAdminRemoveIPWhitelist,
} from "./settings";

interface AuthenticatedContext {
  request: Request;
  directIp: string;
  admin: Admin;
  session: Session;
}

/**
 * Route admin API requests
 */
export async function handleAdminRoute(
  ctx: AuthenticatedContext,
  path: string,
  method: string
): Promise<Response> {
  // Remove /api/admin prefix
  const adminPath = path.replace(/^\/api\/admin/, "");

  // === Donations ===
  if (adminPath === "/donations" && method === "GET") {
    return handleAdminListDonations(ctx);
  }
  if (adminPath === "/donations/stats" && method === "GET") {
    return handleAdminDonationStats(ctx);
  }
  if (adminPath.match(/^\/donations\/[^/]+$/) && method === "GET") {
    const donationId = adminPath.split("/")[2];
    return handleAdminGetDonation(ctx, donationId);
  }
  if (adminPath.match(/^\/donations\/[^/]+\/refund$/) && method === "POST") {
    const donationId = adminPath.split("/")[2];
    return handleAdminRefundDonation(ctx, donationId);
  }

  // === Events ===
  if (adminPath === "/events" && method === "GET") {
    return handleAdminListEvents(ctx);
  }
  if (adminPath === "/events" && method === "POST") {
    return handleAdminCreateEvent(ctx);
  }
  if (adminPath.match(/^\/events\/[^/]+$/) && method === "GET") {
    const eventId = adminPath.split("/")[2];
    return handleAdminGetEvent(ctx, eventId);
  }
  if (adminPath.match(/^\/events\/[^/]+$/) && method === "PUT") {
    const eventId = adminPath.split("/")[2];
    return handleAdminUpdateEvent(ctx, eventId);
  }
  if (adminPath.match(/^\/events\/[^/]+$/) && method === "DELETE") {
    const eventId = adminPath.split("/")[2];
    return handleAdminDeleteEvent(ctx, eventId);
  }

  // === Subscriptions ===
  if (adminPath === "/subscriptions" && method === "GET") {
    return handleAdminListSubscriptions(ctx);
  }
  if (adminPath === "/subscriptions/stats" && method === "GET") {
    return handleAdminSubscriptionStats(ctx);
  }
  if (adminPath.match(/^\/subscriptions\/[^/]+$/) && method === "GET") {
    const subscriptionId = adminPath.split("/")[2];
    return handleAdminGetSubscription(ctx, subscriptionId);
  }
  if (adminPath.match(/^\/subscriptions\/[^/]+\/cancel$/) && method === "POST") {
    const subscriptionId = adminPath.split("/")[2];
    return handleAdminCancelSubscription(ctx, subscriptionId);
  }

  // === Settings ===
  if (adminPath === "/settings" && method === "GET") {
    return handleAdminGetSettings(ctx);
  }
  if (adminPath === "/settings" && method === "PUT") {
    return handleAdminUpdateSettings(ctx);
  }
  if (adminPath === "/settings/ip-whitelist" && method === "GET") {
    return handleAdminGetIPWhitelist(ctx);
  }
  if (adminPath === "/settings/ip-whitelist" && method === "POST") {
    return handleAdminAddIPWhitelist(ctx);
  }
  if (adminPath.match(/^\/settings\/ip-whitelist\/[^/]+$/) && method === "DELETE") {
    const ipId = adminPath.split("/")[3];
    return handleAdminRemoveIPWhitelist(ctx, ipId);
  }

  // Not found
  return Response.json(
    { error: "NOT_FOUND", message: `${method} ${path} not found` },
    { status: 404 }
  );
}
