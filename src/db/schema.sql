-- Monobun Donation System - Database Schema
-- PostgreSQL 15+

-- 管理者
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- Argon2id
  role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'viewer' | 'editor'
  must_change_password BOOLEAN DEFAULT true,  -- 初回ログイン時パスワード変更
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- パスワードリセットトークン
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- セッション
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,  -- crypto.randomBytes(32)
  csrf_token VARCHAR(255) NOT NULL,    -- CSRF対策用
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),  -- アイドルタイムアウト用
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベント
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(100) PRIMARY KEY,  -- URL用スラッグ
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount INTEGER,
  price_options JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'active' | 'ended'
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  style_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 寄付
CREATE TABLE IF NOT EXISTS donations (
  id VARCHAR(50) PRIMARY KEY,  -- don_xxxxx
  type VARCHAR(20) NOT NULL,   -- 'one-time' | 'event'
  event_id VARCHAR(100) REFERENCES events(id),
  amount INTEGER NOT NULL,
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255) DEFAULT 'Anonymous',
  message TEXT,
  payment_method VARCHAR(20), -- 'card' | 'paypay' | 'bank_transfer'
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'disputed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- サブスクリプション
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(50) PRIMARY KEY,  -- sub_xxxxx
  type VARCHAR(20) NOT NULL,   -- 'monthly' | 'yearly'
  amount INTEGER NOT NULL,
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255) DEFAULT 'Anonymous',
  payment_method VARCHAR(20),
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'active' | 'cancelled' | 'past_due'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_token VARCHAR(255),  -- メールリンク用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- 請求履歴
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(50) PRIMARY KEY,
  subscription_id VARCHAR(50) REFERENCES subscriptions(id),
  stripe_invoice_id VARCHAR(255),
  amount INTEGER NOT NULL,
  status VARCHAR(20), -- 'paid' | 'failed' | 'refunded'
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 設定
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP許可リスト
CREATE TABLE IF NOT EXISTS allowed_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_pattern VARCHAR(50) NOT NULL,  -- CIDR形式可
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監査ログ（セキュリティ）
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action VARCHAR(100) NOT NULL,  -- 'event.create', 'settings.update', etc.
  target_type VARCHAR(50),       -- 'event', 'donation', 'subscription'
  target_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook処理済みイベント（再送攻撃防止）
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limit記録（IP/ユーザー単位）
CREATE TABLE IF NOT EXISTS rate_limit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,        -- 'ip:192.168.1.1' or 'user:uuid'
  endpoint VARCHAR(255) NOT NULL,   -- 'POST /api/auth/login'
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  UNIQUE(key, endpoint, window_start)
);

-- Idempotency Key（二重決済防止）
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL  -- 24時間後に期限切れ
);

-- グローバルログイン失敗カウント（分散攻撃対策）
CREATE TABLE IF NOT EXISTS global_login_stats (
  window_start TIMESTAMPTZ PRIMARY KEY,
  failed_count INTEGER DEFAULT 0
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_donations_event_id ON donations(event_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_session ON donations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_donor_email ON subscriptions(donor_email);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_endpoint ON rate_limit_records(key, endpoint);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_global_login_window ON global_login_stats(window_start);

-- ユニーク制約（二重決済防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_stripe_session_unique
ON donations(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 初期設定データ
INSERT INTO settings (key, value) VALUES
  ('site', '{"name": "Donation Site", "url": "https://donate.example.com"}'::jsonb),
  ('refund', '{"subscriptionRefundDays": 7}'::jsonb),
  ('notification', '{"adminEmail": "", "webhookUrl": ""}'::jsonb),
  ('legal', '{"businessName": "", "representative": "", "address": "", "phone": "", "email": ""}'::jsonb),
  ('embed', '{"allowedDomains": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;
