// Self-Service Portal API Routes
import { db } from "../../../lib/db";
import { logger } from "../../../lib/logger";
import { z } from "zod";

// Token validation schema
const TokenSchema = z.string().min(32).max(256);

// Pause schema
const PauseSchema = z.object({
  months: z.number().int().min(1).max(3),
});

// Amount change schema
const AmountSchema = z.object({
  amount: z.number().int().min(100).max(10000000),
});

interface RequestContext {
  request: Request;
  directIp: string;
}

// Verify email token and get user data
async function verifyToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  try {
    TokenSchema.parse(token);

    // Check token in database
    const result = await db.query`
      SELECT email, expires_at
      FROM email_tokens
      WHERE token = ${token} AND type = 'self_service'
    `;

    if (result.length === 0) {
      return { valid: false, error: "無効なトークンです" };
    }

    const { email, expires_at } = result[0];

    if (new Date(expires_at) < new Date()) {
      return { valid: false, error: "トークンの有効期限が切れています" };
    }

    return { valid: true, email };
  } catch (error) {
    logger.error("Token verification error", { error });
    return { valid: false, error: "トークンの検証に失敗しました" };
  }
}

// Get token from Authorization header
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

// GET /api/my/subscriptions - Get user's subscriptions and donations
export async function handleGetMySubscriptions(ctx: RequestContext): Promise<Response> {
  const token = extractToken(ctx.request);
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "トークンが必要です" },
      { status: 401 }
    );
  }

  const verification = await verifyToken(token);
  if (!verification.valid) {
    return Response.json(
      { error: "INVALID_TOKEN", message: verification.error },
      { status: 401 }
    );
  }

  const email = verification.email!;

  try {
    // Get subscriptions
    const subscriptions = await db.query`
      SELECT
        s.id,
        s.amount,
        s.interval,
        s.status,
        s.paused_until,
        s.next_billing_date,
        s.created_at,
        e.name as event_name
      FROM subscriptions s
      LEFT JOIN events e ON s.event_id = e.id
      WHERE s.donor_email = ${email}
      ORDER BY s.created_at DESC
    `;

    // Get donations
    const donations = await db.query`
      SELECT
        d.id,
        d.amount,
        d.created_at,
        d.receipt_url,
        e.name as event_name
      FROM donations d
      LEFT JOIN events e ON d.event_id = e.id
      WHERE d.donor_email = ${email}
      ORDER BY d.created_at DESC
      LIMIT 100
    `;

    return Response.json({
      data: {
        email,
        subscriptions: subscriptions.map((s: any) => ({
          id: s.id,
          amount: s.amount,
          interval: s.interval,
          status: s.status,
          pausedUntil: s.paused_until,
          nextBillingDate: s.next_billing_date,
          createdAt: s.created_at,
          eventName: s.event_name,
        })),
        donations: donations.map((d: any) => ({
          id: d.id,
          amount: d.amount,
          createdAt: d.created_at,
          receiptUrl: d.receipt_url,
          eventName: d.event_name,
        })),
      },
    });
  } catch (error) {
    logger.error("Error fetching user data", { error, email });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/my/subscriptions/:id/pause - Pause a subscription
export async function handlePauseSubscription(
  ctx: RequestContext,
  subscriptionId: string
): Promise<Response> {
  const token = extractToken(ctx.request);
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "トークンが必要です" },
      { status: 401 }
    );
  }

  const verification = await verifyToken(token);
  if (!verification.valid) {
    return Response.json(
      { error: "INVALID_TOKEN", message: verification.error },
      { status: 401 }
    );
  }

  const email = verification.email!;

  try {
    const body = await ctx.request.json();
    const { months } = PauseSchema.parse(body);

    // Verify ownership
    const subscription = await db.query`
      SELECT id, status, stripe_subscription_id
      FROM subscriptions
      WHERE id = ${subscriptionId} AND donor_email = ${email}
    `;

    if (subscription.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "サブスクリプションが見つかりません" },
        { status: 404 }
      );
    }

    if (subscription[0].status !== "active") {
      return Response.json(
        { error: "INVALID_STATE", message: "アクティブなサブスクリプションのみ一時停止できます" },
        { status: 400 }
      );
    }

    // Calculate pause end date
    const pausedUntil = new Date();
    pausedUntil.setMonth(pausedUntil.getMonth() + months);

    // Update subscription status
    await db.query`
      UPDATE subscriptions
      SET status = 'paused', paused_until = ${pausedUntil.toISOString()}
      WHERE id = ${subscriptionId}
    `;

    // TODO: Pause Stripe subscription
    // This would involve calling Stripe API to pause the subscription

    logger.info("Subscription paused", { subscriptionId, email, months });

    return Response.json({
      success: true,
      message: "サブスクリプションを一時停止しました",
      pausedUntil: pausedUntil.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "無効なリクエストです" },
        { status: 400 }
      );
    }
    logger.error("Error pausing subscription", { error, subscriptionId, email });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "一時停止に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/my/subscriptions/:id/resume - Resume a paused subscription
export async function handleResumeSubscription(
  ctx: RequestContext,
  subscriptionId: string
): Promise<Response> {
  const token = extractToken(ctx.request);
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "トークンが必要です" },
      { status: 401 }
    );
  }

  const verification = await verifyToken(token);
  if (!verification.valid) {
    return Response.json(
      { error: "INVALID_TOKEN", message: verification.error },
      { status: 401 }
    );
  }

  const email = verification.email!;

  try {
    // Verify ownership
    const subscription = await db.query`
      SELECT id, status, stripe_subscription_id
      FROM subscriptions
      WHERE id = ${subscriptionId} AND donor_email = ${email}
    `;

    if (subscription.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "サブスクリプションが見つかりません" },
        { status: 404 }
      );
    }

    if (subscription[0].status !== "paused") {
      return Response.json(
        { error: "INVALID_STATE", message: "一時停止中のサブスクリプションのみ再開できます" },
        { status: 400 }
      );
    }

    // Update subscription status
    await db.query`
      UPDATE subscriptions
      SET status = 'active', paused_until = NULL
      WHERE id = ${subscriptionId}
    `;

    // TODO: Resume Stripe subscription

    logger.info("Subscription resumed", { subscriptionId, email });

    return Response.json({
      success: true,
      message: "サブスクリプションを再開しました",
    });
  } catch (error) {
    logger.error("Error resuming subscription", { error, subscriptionId, email });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "再開に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/my/subscriptions/:id/cancel - Cancel a subscription
export async function handleCancelMySubscription(
  ctx: RequestContext,
  subscriptionId: string
): Promise<Response> {
  const token = extractToken(ctx.request);
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "トークンが必要です" },
      { status: 401 }
    );
  }

  const verification = await verifyToken(token);
  if (!verification.valid) {
    return Response.json(
      { error: "INVALID_TOKEN", message: verification.error },
      { status: 401 }
    );
  }

  const email = verification.email!;

  try {
    // Verify ownership
    const subscription = await db.query`
      SELECT id, status, stripe_subscription_id
      FROM subscriptions
      WHERE id = ${subscriptionId} AND donor_email = ${email}
    `;

    if (subscription.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "サブスクリプションが見つかりません" },
        { status: 404 }
      );
    }

    if (subscription[0].status === "cancelled") {
      return Response.json(
        { error: "ALREADY_CANCELLED", message: "既にキャンセルされています" },
        { status: 400 }
      );
    }

    // Update subscription status
    await db.query`
      UPDATE subscriptions
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = ${subscriptionId}
    `;

    // TODO: Cancel Stripe subscription

    logger.info("Subscription cancelled by user", { subscriptionId, email });

    return Response.json({
      success: true,
      message: "サブスクリプションをキャンセルしました",
    });
  } catch (error) {
    logger.error("Error cancelling subscription", { error, subscriptionId, email });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "キャンセルに失敗しました" },
      { status: 500 }
    );
  }
}

// PUT /api/my/subscriptions/:id/amount - Change subscription amount
export async function handleChangeSubscriptionAmount(
  ctx: RequestContext,
  subscriptionId: string
): Promise<Response> {
  const token = extractToken(ctx.request);
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "トークンが必要です" },
      { status: 401 }
    );
  }

  const verification = await verifyToken(token);
  if (!verification.valid) {
    return Response.json(
      { error: "INVALID_TOKEN", message: verification.error },
      { status: 401 }
    );
  }

  const email = verification.email!;

  try {
    const body = await ctx.request.json();
    const { amount } = AmountSchema.parse(body);

    // Verify ownership
    const subscription = await db.query`
      SELECT id, status, stripe_subscription_id
      FROM subscriptions
      WHERE id = ${subscriptionId} AND donor_email = ${email}
    `;

    if (subscription.length === 0) {
      return Response.json(
        { error: "NOT_FOUND", message: "サブスクリプションが見つかりません" },
        { status: 404 }
      );
    }

    if (subscription[0].status !== "active") {
      return Response.json(
        { error: "INVALID_STATE", message: "アクティブなサブスクリプションのみ金額変更できます" },
        { status: 400 }
      );
    }

    // Update subscription amount
    await db.query`
      UPDATE subscriptions
      SET amount = ${amount}
      WHERE id = ${subscriptionId}
    `;

    // TODO: Update Stripe subscription amount

    logger.info("Subscription amount changed", { subscriptionId, email, amount });

    return Response.json({
      success: true,
      message: "金額を変更しました",
      newAmount: amount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "無効な金額です" },
        { status: 400 }
      );
    }
    logger.error("Error changing subscription amount", { error, subscriptionId, email });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "金額変更に失敗しました" },
      { status: 500 }
    );
  }
}

// Route handler
export async function handleMyRoute(
  ctx: RequestContext,
  path: string,
  method: string
): Promise<Response> {
  // GET /api/my/subscriptions
  if (path === "/api/my/subscriptions" && method === "GET") {
    return handleGetMySubscriptions(ctx);
  }

  // POST /api/my/subscriptions/:id/pause
  const pauseMatch = path.match(/^\/api\/my\/subscriptions\/([^/]+)\/pause$/);
  if (pauseMatch && method === "POST") {
    return handlePauseSubscription(ctx, pauseMatch[1]);
  }

  // POST /api/my/subscriptions/:id/resume
  const resumeMatch = path.match(/^\/api\/my\/subscriptions\/([^/]+)\/resume$/);
  if (resumeMatch && method === "POST") {
    return handleResumeSubscription(ctx, resumeMatch[1]);
  }

  // POST /api/my/subscriptions/:id/cancel
  const cancelMatch = path.match(/^\/api\/my\/subscriptions\/([^/]+)\/cancel$/);
  if (cancelMatch && method === "POST") {
    return handleCancelMySubscription(ctx, cancelMatch[1]);
  }

  // PUT /api/my/subscriptions/:id/amount
  const amountMatch = path.match(/^\/api\/my\/subscriptions\/([^/]+)\/amount$/);
  if (amountMatch && method === "PUT") {
    return handleChangeSubscriptionAmount(ctx, amountMatch[1]);
  }

  return Response.json(
    { error: "NOT_FOUND", message: "エンドポイントが見つかりません" },
    { status: 404 }
  );
}
