// Monobun Donation System - Authentication Library

import { randomBytes } from "crypto";
import {
  findAdminByEmail,
  findAdminById,
  updateAdmin,
  createSession as dbCreateSession,
  findSessionByToken,
  updateSessionActivity,
  deleteSession,
  deleteAllSessionsForAdmin,
  createPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  incrementGlobalLoginFailure,
  getGlobalLoginFailureCount,
} from "./db";
import { logger } from "./logger";
import type { Admin, Session } from "../types";

// === Constants ===

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const CAPTCHA_THRESHOLD = 3;
const GLOBAL_FAILURE_THRESHOLD = 100;
const GLOBAL_DELAY_MS = 5000;

// === Password Hashing (Argon2id via Bun) ===

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536, // 64MB
    timeCost: 3,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

// === Token Generation ===

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex"); // 64 character hex string
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateCancelToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateId(prefix: string): string {
  const random = randomBytes(12).toString("base64url");
  return `${prefix}_${random}`;
}

// === Session Management ===

export interface CreateSessionResult {
  session: Session;
  token: string;
  csrfToken: string;
}

export async function createSession(
  adminId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<CreateSessionResult> {
  const token = generateSessionToken();
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  const session = await dbCreateSession(
    adminId,
    token,
    csrfToken,
    ipAddress,
    userAgent,
    expiresAt
  );

  return { session, token, csrfToken };
}

export interface ValidateSessionResult {
  valid: boolean;
  admin?: Admin;
  session?: Session;
  reason?: string;
}

export async function validateSession(
  token: string,
  currentIp?: string
): Promise<ValidateSessionResult> {
  const session = await findSessionByToken(token);

  if (!session) {
    return { valid: false, reason: "Session not found or expired" };
  }

  // Check idle timeout
  const idleTime = Date.now() - session.last_activity_at.getTime();
  if (idleTime > SESSION_IDLE_TIMEOUT) {
    await deleteSession(token);
    return { valid: false, reason: "Session timed out due to inactivity" };
  }

  // Check IP address change (optional security feature)
  if (currentIp && session.ip_address && session.ip_address !== currentIp) {
    logger.security("Session IP address changed", {
      sessionId: session.id,
      originalIp: session.ip_address,
      currentIp,
    });
    return { valid: false, reason: "SESSION_IP_CHANGED" };
  }

  // Get admin
  const admin = await findAdminById(session.admin_id);
  if (!admin) {
    await deleteSession(token);
    return { valid: false, reason: "Admin not found" };
  }

  // Update last activity
  await updateSessionActivity(session.id);

  return { valid: true, admin, session };
}

export async function destroySession(token: string): Promise<void> {
  await deleteSession(token);
}

export async function destroyAllSessions(adminId: string): Promise<void> {
  await deleteAllSessionsForAdmin(adminId);
}

// === Login Flow ===

export interface LoginResult {
  success: boolean;
  admin?: Admin;
  session?: CreateSessionResult;
  requirePasswordChange?: boolean;
  tempToken?: string;
  requireCaptcha?: boolean;
  locked?: boolean;
  lockedUntil?: Date;
  reason?: string;
}

export async function login(
  email: string,
  password: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<LoginResult> {
  // Check global failure rate (distributed attack prevention)
  const globalFailures = await getGlobalLoginFailureCount();
  if (globalFailures > GLOBAL_FAILURE_THRESHOLD) {
    logger.security("Global login delay triggered", { globalFailures });
    await Bun.sleep(GLOBAL_DELAY_MS);
  }

  // Find admin
  const admin = await findAdminByEmail(email);

  if (!admin) {
    await incrementGlobalLoginFailure();
    return { success: false, reason: "Invalid credentials" };
  }

  // Check if locked
  if (admin.locked_until && admin.locked_until > new Date()) {
    return {
      success: false,
      locked: true,
      lockedUntil: admin.locked_until,
      reason: "Account is locked",
    };
  }

  // Check if CAPTCHA required
  if (admin.failed_login_attempts >= CAPTCHA_THRESHOLD) {
    // In a real implementation, verify CAPTCHA token here
    // For now, just flag that CAPTCHA is required
  }

  // Verify password
  const valid = await verifyPassword(password, admin.password_hash);

  if (!valid) {
    const newFailCount = admin.failed_login_attempts + 1;
    const shouldLock = newFailCount >= LOCKOUT_THRESHOLD;

    await updateAdmin(admin.id, {
      failed_login_attempts: newFailCount,
      locked_until: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION) : null,
    });

    await incrementGlobalLoginFailure();

    if (shouldLock) {
      logger.security("Account locked due to failed attempts", {
        email,
        attempts: newFailCount,
      });
      return {
        success: false,
        locked: true,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION),
        reason: "Account locked due to too many failed attempts",
      };
    }

    return {
      success: false,
      requireCaptcha: newFailCount >= CAPTCHA_THRESHOLD,
      reason: "Invalid credentials",
    };
  }

  // Reset failed attempts on successful login
  if (admin.failed_login_attempts > 0 || admin.locked_until) {
    await updateAdmin(admin.id, {
      failed_login_attempts: 0,
      locked_until: null,
    });
  }

  // Check if password change is required
  if (admin.must_change_password) {
    const tempToken = generateSessionToken();
    // Store temp token temporarily (you might want to use a dedicated table)
    // For simplicity, we'll create a short-lived session
    const tempSession = await dbCreateSession(
      admin.id,
      tempToken,
      generateCsrfToken(),
      ipAddress,
      userAgent,
      new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    );

    return {
      success: true,
      admin,
      requirePasswordChange: true,
      tempToken,
    };
  }

  // Destroy all existing sessions (session fixation prevention)
  await destroyAllSessions(admin.id);

  // Create new session
  const session = await createSession(admin.id, ipAddress, userAgent);

  return { success: true, admin, session };
}

// === Password Reset ===

export async function requestPasswordReset(
  email: string,
  ipAddress: string | null
): Promise<{ token: string } | null> {
  const admin = await findAdminByEmail(email);

  // Always return null to avoid email enumeration
  // The caller should show the same message regardless
  if (!admin) {
    return null;
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY);

  await createPasswordResetToken(admin.id, token, ipAddress, expiresAt);

  return { token };
}

export interface ResetPasswordResult {
  success: boolean;
  reason?: string;
  ipChanged?: boolean;
}

export async function resetPassword(
  token: string,
  newPassword: string,
  currentIp: string | null
): Promise<ResetPasswordResult> {
  const resetToken = await findPasswordResetToken(token);

  if (!resetToken) {
    return { success: false, reason: "Invalid or expired reset token" };
  }

  // Check if IP changed (for notification purposes)
  const ipChanged = currentIp !== null && resetToken.ip_address !== currentIp;

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update admin
  await updateAdmin(resetToken.admin_id, {
    password_hash: passwordHash,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
  });

  // Mark token as used
  await markPasswordResetTokenUsed(token);

  // Destroy all sessions
  await destroyAllSessions(resetToken.admin_id);

  if (ipChanged) {
    logger.security("Password reset from different IP", {
      adminId: resetToken.admin_id,
      originalIp: resetToken.ip_address,
      currentIp,
    });
  }

  return { success: true, ipChanged };
}

// === Password Change (Authenticated) ===

export async function changePassword(
  adminId: string,
  currentPassword: string | undefined,
  newPassword: string,
  isTempSession: boolean = false
): Promise<{ success: boolean; reason?: string }> {
  const admin = await findAdminById(adminId);

  if (!admin) {
    return { success: false, reason: "Admin not found" };
  }

  // Verify current password (unless this is a forced change via temp session)
  if (!isTempSession && currentPassword) {
    const valid = await verifyPassword(currentPassword, admin.password_hash);
    if (!valid) {
      return { success: false, reason: "Current password is incorrect" };
    }
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update admin
  await updateAdmin(adminId, {
    password_hash: passwordHash,
    must_change_password: false,
  });

  // Destroy all sessions (force re-login with new password)
  await destroyAllSessions(adminId);

  return { success: true };
}

// === Utility ===

export function isValidSessionToken(token: string): boolean {
  // Session token should be 64 hex characters
  return /^[a-f0-9]{64}$/.test(token);
}
