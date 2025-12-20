// Monobun Donation System - Database Connection (Bun.sql)

import { SQL } from "bun";
import type {
  Admin,
  Session,
  DonationEvent,
  Donation,
  Subscription,
  Invoice,
  AuditLog,
  WebhookEvent,
  AllowedIP,
  PasswordResetToken,
} from "../types";

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("DATABASE_URL not set. Database operations will fail.");
}

// Lazy initialization of database connection
let _db: SQL | null = null;

export function getDb(): SQL {
  if (!_db) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    _db = new SQL(DATABASE_URL);
  }
  return _db;
}

// Close database connection
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close();
    _db = null;
  }
}

// === Admin Operations ===

export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM admins WHERE email = ${email} LIMIT 1
  `;
  return rows[0] as Admin | null;
}

export async function findAdminById(id: string): Promise<Admin | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM admins WHERE id = ${id} LIMIT 1
  `;
  return rows[0] as Admin | null;
}

export async function updateAdmin(
  id: string,
  updates: Partial<Pick<Admin, "password_hash" | "must_change_password" | "failed_login_attempts" | "locked_until">>
): Promise<void> {
  const db = getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.password_hash !== undefined) {
    values.push(updates.password_hash);
    setClauses.push(`password_hash = $${values.length}`);
  }
  if (updates.must_change_password !== undefined) {
    values.push(updates.must_change_password);
    setClauses.push(`must_change_password = $${values.length}`);
  }
  if (updates.failed_login_attempts !== undefined) {
    values.push(updates.failed_login_attempts);
    setClauses.push(`failed_login_attempts = $${values.length}`);
  }
  if (updates.locked_until !== undefined) {
    values.push(updates.locked_until);
    setClauses.push(`locked_until = $${values.length}`);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.unsafe(
      `UPDATE admins SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );
  }
}

export async function createAdmin(
  email: string,
  passwordHash: string,
  role: "viewer" | "editor" = "viewer"
): Promise<Admin> {
  const db = getDb();
  const rows = await db`
    INSERT INTO admins (email, password_hash, role)
    VALUES (${email}, ${passwordHash}, ${role})
    RETURNING *
  `;
  return rows[0] as Admin;
}

// === Session Operations ===

export async function createSession(
  adminId: string,
  token: string,
  csrfToken: string,
  ipAddress: string | null,
  userAgent: string | null,
  expiresAt: Date
): Promise<Session> {
  const db = getDb();
  const rows = await db`
    INSERT INTO sessions (admin_id, token, csrf_token, ip_address, user_agent, expires_at)
    VALUES (${adminId}, ${token}, ${csrfToken}, ${ipAddress}, ${userAgent}, ${expiresAt})
    RETURNING *
  `;
  return rows[0] as Session;
}

export async function findSessionByToken(token: string): Promise<Session | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM sessions
    WHERE token = ${token}
    AND expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] as Session | null;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const db = getDb();
  await db`
    UPDATE sessions SET last_activity_at = NOW() WHERE id = ${sessionId}
  `;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db`
    DELETE FROM sessions WHERE token = ${token}
  `;
}

export async function deleteAllSessionsForAdmin(adminId: string): Promise<void> {
  const db = getDb();
  await db`
    DELETE FROM sessions WHERE admin_id = ${adminId}
  `;
}

export async function deleteExpiredSessions(): Promise<number> {
  const db = getDb();
  const result = await db`
    DELETE FROM sessions WHERE expires_at < NOW()
  `;
  return result.count;
}

// === Password Reset Operations ===

export async function createPasswordResetToken(
  adminId: string,
  token: string,
  ipAddress: string | null,
  expiresAt: Date
): Promise<PasswordResetToken> {
  const db = getDb();
  const rows = await db`
    INSERT INTO password_reset_tokens (admin_id, token, ip_address, expires_at)
    VALUES (${adminId}, ${token}, ${ipAddress}, ${expiresAt})
    RETURNING *
  `;
  return rows[0] as PasswordResetToken;
}

export async function findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM password_reset_tokens
    WHERE token = ${token}
    AND expires_at > NOW()
    AND used_at IS NULL
    LIMIT 1
  `;
  return rows[0] as PasswordResetToken | null;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const db = getDb();
  await db`
    UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}
  `;
}

export async function deleteExpiredPasswordResetTokens(): Promise<number> {
  const db = getDb();
  const result = await db`
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL
  `;
  return result.count;
}

// === Event Operations ===

export async function createEvent(event: Omit<DonationEvent, "created_at" | "updated_at">): Promise<DonationEvent> {
  const db = getDb();
  const rows = await db`
    INSERT INTO events (id, name, description, goal_amount, price_options, status, starts_at, ends_at, style_config)
    VALUES (
      ${event.id},
      ${event.name},
      ${event.description},
      ${event.goal_amount},
      ${JSON.stringify(event.price_options)}::jsonb,
      ${event.status},
      ${event.starts_at},
      ${event.ends_at},
      ${JSON.stringify(event.style_config)}::jsonb
    )
    RETURNING *
  `;
  return rows[0] as DonationEvent;
}

export async function findEventById(id: string): Promise<DonationEvent | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM events WHERE id = ${id} LIMIT 1
  `;
  return rows[0] as DonationEvent | null;
}

export async function listEvents(
  status?: string,
  page = 1,
  limit = 20
): Promise<{ events: DonationEvent[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;

  let events: DonationEvent[];
  let countResult: { count: number }[];

  if (status) {
    events = await db`
      SELECT * FROM events WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as DonationEvent[];
    countResult = await db`SELECT COUNT(*)::int as count FROM events WHERE status = ${status}`;
  } else {
    events = await db`
      SELECT * FROM events
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as DonationEvent[];
    countResult = await db`SELECT COUNT(*)::int as count FROM events`;
  }

  return { events, total: countResult[0].count };
}

// === Donation Operations ===

export async function createDonation(donation: Omit<Donation, "created_at" | "completed_at">): Promise<Donation> {
  const db = getDb();
  const rows = await db`
    INSERT INTO donations (id, type, event_id, amount, donor_email, donor_name, message, payment_method, stripe_session_id, status)
    VALUES (
      ${donation.id},
      ${donation.type},
      ${donation.event_id},
      ${donation.amount},
      ${donation.donor_email},
      ${donation.donor_name},
      ${donation.message},
      ${donation.payment_method},
      ${donation.stripe_session_id},
      ${donation.status}
    )
    RETURNING *
  `;
  return rows[0] as Donation;
}

export async function findDonationById(id: string): Promise<Donation | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM donations WHERE id = ${id} LIMIT 1
  `;
  return rows[0] as Donation | null;
}

export async function findDonationByStripeSession(sessionId: string): Promise<Donation | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM donations WHERE stripe_session_id = ${sessionId} LIMIT 1
  `;
  return rows[0] as Donation | null;
}

export async function updateDonationStatus(
  id: string,
  status: string,
  paymentIntentId?: string
): Promise<void> {
  const db = getDb();
  if (status === "completed") {
    await db`
      UPDATE donations
      SET status = ${status}, stripe_payment_intent_id = ${paymentIntentId ?? null}, completed_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await db`
      UPDATE donations SET status = ${status} WHERE id = ${id}
    `;
  }
}

// === Subscription Operations ===

export async function createSubscription(sub: Omit<Subscription, "created_at" | "cancelled_at">): Promise<Subscription> {
  const db = getDb();
  const rows = await db`
    INSERT INTO subscriptions (id, type, amount, donor_email, donor_name, payment_method, stripe_subscription_id, stripe_customer_id, status, cancel_token)
    VALUES (
      ${sub.id},
      ${sub.type},
      ${sub.amount},
      ${sub.donor_email},
      ${sub.donor_name},
      ${sub.payment_method},
      ${sub.stripe_subscription_id},
      ${sub.stripe_customer_id},
      ${sub.status},
      ${sub.cancel_token}
    )
    RETURNING *
  `;
  return rows[0] as Subscription;
}

export async function findSubscriptionById(id: string): Promise<Subscription | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM subscriptions WHERE id = ${id} LIMIT 1
  `;
  return rows[0] as Subscription | null;
}

export async function findSubscriptionByCancelToken(token: string): Promise<Subscription | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM subscriptions WHERE cancel_token = ${token} AND status = 'active' LIMIT 1
  `;
  return rows[0] as Subscription | null;
}

export async function findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1
  `;
  return rows[0] as Subscription | null;
}

export async function updateSubscriptionStripeIds(
  id: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE subscriptions
    SET stripe_subscription_id = ${stripeSubscriptionId},
        stripe_customer_id = ${stripeCustomerId}
    WHERE id = ${id}
  `;
}

export async function updateSubscriptionStatus(
  id: string,
  status: "active" | "cancelled" | "past_due" | "paused"
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE subscriptions
    SET status = ${status},
        cancelled_at = ${status === "cancelled" ? new Date() : null}
    WHERE id = ${id}
  `;
}

export async function updateSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: "active" | "cancelled" | "past_due" | "paused"
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE subscriptions
    SET status = ${status},
        cancelled_at = ${status === "cancelled" ? new Date() : null}
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

export async function markDonationDisputed(donationId: string): Promise<void> {
  const db = getDb();
  await db`
    UPDATE donations
    SET status = 'disputed'
    WHERE id = ${donationId}
  `;
}

export async function findDonationByPaymentIntent(paymentIntentId: string): Promise<Donation | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM donations WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
  `;
  return rows[0] as Donation | null;
}

// === Audit Log Operations ===

export async function createAuditLog(log: Omit<AuditLog, "id" | "created_at">): Promise<AuditLog> {
  const db = getDb();
  const rows = await db`
    INSERT INTO audit_logs (admin_id, action, target_type, target_id, old_value, new_value, ip_address, user_agent)
    VALUES (
      ${log.admin_id},
      ${log.action},
      ${log.target_type},
      ${log.target_id},
      ${log.old_value ? JSON.stringify(log.old_value) : null}::jsonb,
      ${log.new_value ? JSON.stringify(log.new_value) : null}::jsonb,
      ${log.ip_address},
      ${log.user_agent}
    )
    RETURNING *
  `;
  return rows[0] as AuditLog;
}

// === Webhook Event Operations ===

export async function findWebhookEvent(stripeEventId: string): Promise<WebhookEvent | null> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM webhook_events WHERE stripe_event_id = ${stripeEventId} LIMIT 1
  `;
  return rows[0] as WebhookEvent | null;
}

export async function createWebhookEvent(stripeEventId: string, eventType: string): Promise<WebhookEvent> {
  const db = getDb();
  const rows = await db`
    INSERT INTO webhook_events (stripe_event_id, event_type)
    VALUES (${stripeEventId}, ${eventType})
    RETURNING *
  `;
  return rows[0] as WebhookEvent;
}

// === IP Whitelist Operations ===

export async function getAllowedIPs(): Promise<AllowedIP[]> {
  const db = getDb();
  const rows = await db`SELECT * FROM allowed_ips`;
  return rows as AllowedIP[];
}

export async function addAllowedIP(ipPattern: string, description?: string): Promise<AllowedIP> {
  const db = getDb();
  const rows = await db`
    INSERT INTO allowed_ips (ip_pattern, description)
    VALUES (${ipPattern}, ${description ?? null})
    RETURNING *
  `;
  return rows[0] as AllowedIP;
}

// === Rate Limiting Operations ===

export async function incrementRateLimit(
  key: string,
  endpoint: string,
  windowStart: Date
): Promise<number> {
  const db = getDb();
  const rows = await db`
    INSERT INTO rate_limit_records (key, endpoint, window_start, request_count)
    VALUES (${key}, ${endpoint}, ${windowStart}, 1)
    ON CONFLICT (key, endpoint, window_start)
    DO UPDATE SET request_count = rate_limit_records.request_count + 1
    RETURNING request_count
  `;
  return rows[0].request_count;
}

export async function getRateLimitCount(
  key: string,
  endpoint: string,
  windowStart: Date
): Promise<number> {
  const db = getDb();
  const rows = await db`
    SELECT request_count FROM rate_limit_records
    WHERE key = ${key} AND endpoint = ${endpoint} AND window_start = ${windowStart}
  `;
  return rows[0]?.request_count ?? 0;
}

export async function cleanupOldRateLimits(): Promise<number> {
  const db = getDb();
  // Delete records older than 1 hour
  const result = await db`
    DELETE FROM rate_limit_records WHERE window_start < NOW() - INTERVAL '1 hour'
  `;
  return result.count;
}

// === Global Login Stats (Distributed Attack Prevention) ===

export async function incrementGlobalLoginFailure(): Promise<number> {
  const db = getDb();
  const windowStart = new Date();
  windowStart.setSeconds(0, 0); // Round to minute

  const rows = await db`
    INSERT INTO global_login_stats (window_start, failed_count)
    VALUES (${windowStart}, 1)
    ON CONFLICT (window_start)
    DO UPDATE SET failed_count = global_login_stats.failed_count + 1
    RETURNING failed_count
  `;
  return rows[0].failed_count;
}

export async function getGlobalLoginFailureCount(): Promise<number> {
  const db = getDb();
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);

  const rows = await db`
    SELECT failed_count FROM global_login_stats WHERE window_start = ${windowStart}
  `;
  return rows[0]?.failed_count ?? 0;
}

// === Idempotency Operations ===

export async function findIdempotencyKey(key: string): Promise<{ response: unknown } | null> {
  const db = getDb();
  const rows = await db`
    SELECT response FROM idempotency_keys
    WHERE key = ${key} AND expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createIdempotencyKey(
  key: string,
  response: unknown,
  expiresAt: Date
): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO idempotency_keys (key, response, expires_at)
    VALUES (${key}, ${JSON.stringify(response)}::jsonb, ${expiresAt})
    ON CONFLICT (key) DO NOTHING
  `;
}

export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const db = getDb();
  const result = await db`
    DELETE FROM idempotency_keys WHERE expires_at < NOW()
  `;
  return result.count;
}

// === Settings Operations ===

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = getDb();
  const rows = await db`
    SELECT value FROM settings WHERE key = ${key} LIMIT 1
  `;
  return rows[0]?.value as T ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = NOW()
  `;
}

// === Database Health Check ===

export async function healthCheck(): Promise<boolean> {
  try {
    const db = getDb();
    await db`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
