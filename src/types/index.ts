// Monobun Donation System - Type Definitions

// === Enums ===

export type DonationType = "one-time" | "monthly" | "yearly" | "event";
export type PaymentMethod = "card" | "paypay" | "bank_transfer";
export type AdminRole = "viewer" | "editor";
export type DonationStatus = "pending" | "completed" | "failed" | "disputed" | "refunded" | "partially_refunded";
export type SubscriptionStatus = "pending" | "active" | "cancelled" | "past_due";
export type EventStatus = "draft" | "active" | "ended";
export type InvoiceStatus = "paid" | "failed" | "refunded";

// === Database Models ===

export interface Admin {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  admin_id: string;
  token: string;
  csrf_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity_at: Date;
  expires_at: Date;
  created_at: Date;
}

export interface PasswordResetToken {
  id: string;
  admin_id: string;
  token: string;
  ip_address: string | null;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface DonationEvent {
  id: string;
  name: string;
  description: string | null;
  goal_amount: number | null;
  price_options: PriceOption[];
  status: EventStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  style_config: StyleConfig;
  created_at: Date;
  updated_at: Date;
}

export interface PriceOption {
  label: string;
  amount: number | null; // null = custom amount
}

export interface StyleConfig {
  theme?: "light" | "dark";
  primaryColor?: string;
  bgColor?: string;
  bgImage?: string;
  fontFamily?: string;
}

export interface Donation {
  id: string;
  type: DonationType;
  event_id: string | null;
  amount: number;
  donor_email: string;
  donor_name: string;
  message: string | null;
  payment_method: PaymentMethod | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: DonationStatus;
  created_at: Date;
  completed_at: Date | null;
}

export interface Subscription {
  id: string;
  type: "monthly" | "yearly";
  amount: number;
  donor_email: string;
  donor_name: string;
  payment_method: PaymentMethod | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_token: string | null;
  created_at: Date;
  cancelled_at: Date | null;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  status: InvoiceStatus | null;
  paid_at: Date | null;
  refunded_at: Date | null;
  refund_reason: string | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: unknown | null;
  new_value: unknown | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: Date;
}

export interface AllowedIP {
  id: string;
  ip_pattern: string;
  description: string | null;
  created_at: Date;
}

// === Settings ===

export interface SiteSettings {
  name: string;
  url: string;
}

export interface RefundSettings {
  subscriptionRefundDays: number;
}

export interface NotificationSettings {
  adminEmail: string;
  webhookUrl: string;
}

export interface LegalSettings {
  businessName: string;
  representative: string;
  address: string;
  phone: string;
  email: string;
}

export interface EmbedSettings {
  allowedDomains: string[];
}

export interface Settings {
  site: SiteSettings;
  refund: RefundSettings;
  notification: NotificationSettings;
  legal: LegalSettings;
  embed: EmbedSettings;
}

// === API Types ===

export interface LoginRequest {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface LoginResponse {
  token: string;
  csrfToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    role: AdminRole;
  };
}

export interface LoginRequirePasswordChange {
  requirePasswordChange: true;
  tempToken: string;
}

export interface PasswordChangeRequest {
  currentPassword?: string;
  newPassword: string;
  tempToken?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface CreateDonationRequest {
  type: DonationType;
  amount: number;
  paymentMethod: PaymentMethod;
  eventId?: string | null;
  donor: {
    email: string;
    name?: string;
  };
  message?: string;
}

export interface CreateDonationResponse {
  id: string;
  stripeSessionUrl: string;
  status: DonationStatus;
}

export interface CreateSubscriptionRequest {
  type: "monthly" | "yearly";
  amount: number;
  paymentMethod: PaymentMethod;
  donor: {
    email: string;
    name?: string;
  };
}

export interface CreateSubscriptionResponse {
  id: string;
  stripeSessionUrl: string;
  status: SubscriptionStatus;
}

export interface CreateEventRequest {
  id: string;
  name: string;
  description?: string;
  goalAmount?: number;
  priceOptions: PriceOption[];
  startsAt?: string;
  endsAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

// === Rate Limiting ===

export interface RateLimitConfig {
  window: string; // e.g., "15m", "1h", "1m"
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// === Authenticated Request Context ===

export interface AuthContext {
  admin: Admin;
  session: Session;
}
