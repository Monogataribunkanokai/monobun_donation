# Technical Implementation Plan

## Summary

Monobun Donation システムを段階的に実装。
まずコアAPIとDB、次に管理画面、最後に埋め込みWidgetの順で構築。

## Architecture

```
src/
├── index.ts              # エントリポイント (Bun.serve)
├── routes/
│   ├── api/              # REST API
│   │   ├── donations.ts
│   │   ├── subscriptions.ts
│   │   ├── events.ts
│   │   ├── auth.ts
│   │   ├── settings.ts
│   │   ├── stats.ts
│   │   └── webhooks.ts
│   ├── admin/            # 管理画面
│   │   └── index.html
│   ├── donate/           # 寄付ページ
│   │   └── index.html
│   └── embed/            # 埋め込みWidget
│       └── index.html
├── lib/
│   ├── db.ts             # PostgreSQL接続 (Bun.sql)
│   ├── stripe.ts         # Stripe SDK wrapper
│   ├── mail.ts           # メール送信
│   ├── auth.ts           # 認証・セッション管理
│   ├── qrcode.ts         # QRコード生成
│   └── validation.ts     # 入力バリデーション
├── middleware/
│   ├── auth.ts           # 認証ミドルウェア
│   ├── ip-filter.ts      # IP制限
│   └── cors.ts           # CORS設定
├── types/
│   └── index.ts          # 型定義
└── db/
    └── schema.sql        # DBスキーマ
```

## Implementation Phases

### Phase 1: Foundation (Core + Security)

**目標**: DB接続、認証、セキュリティ基盤

1. プロジェクト構造セットアップ
2. PostgreSQL スキーマ定義（監査ログ含む）
3. DB接続ユーティリティ (Bun.sql)
4. 型定義 + Zodバリデーションスキーマ
5. 認証システム
   - Argon2idパスワードハッシュ
   - 暗号論的に安全なセッショントークン生成
   - セッション有効期限（24時間 + 30分アイドルタイムアウト）
   - 初回パスワード変更フロー
6. セキュリティミドルウェア
   - IP制限（プロキシ対応）
   - Rate Limiting（in-memory + Redis対応）
   - CSRFトークン検証
   - セキュリティヘッダー設定
7. 構造化ログ設定
8. 監査ログ機能

### Phase 2: Stripe Integration (Security-First)

**目標**: 安全な決済フロー完成

1. Stripe SDK セットアップ
2. Checkout Session作成（単発）
   - Idempotency Key必須
   - 金額バリデーション（100円〜1000万円）
3. Subscription作成（月額/年額）
   - Idempotency Key必須
4. Webhook受信・処理
   - **必須**: 署名検証 (`stripe.webhooks.constructEvent`)
   - **必須**: イベントID重複チェック（再送攻撃防止）
   - 処理済みイベントのDB記録
5. 返金処理
   - 期限チェック（設定可能、デフォルト7日）
   - 監査ログ記録
6. サブスク解約
   - キャンセルトークン検証

### Phase 3: API Endpoints

**目標**: 全REST API実装

1. 寄付API (POST /api/donations, GET /api/admin/donations)
2. サブスクAPI
3. イベントAPI
4. 設定API
5. 統計API
6. 通知システム（メール、Webhook）

### Phase 4: Admin Panel

**目標**: 管理画面完成

1. ログイン画面
2. ダッシュボード
3. 寄付一覧
4. サブスク管理
5. イベント管理
6. 設定画面

### Phase 5: Public Pages

**目標**: 寄付ページ・Widget完成

1. 寄付ページ (/donate/:eventId)
2. 埋め込みWidget (/embed/:eventId)
3. QRコード生成
4. スタイルカスタマイズ
5. 完了画面

### Phase 6: Polish & Deploy

**目標**: 本番準備

1. エラーハンドリング強化
2. ログ整備
3. Dockerfile作成
4. 環境変数ドキュメント
5. セキュリティ監査

---

## Database Schema

```sql
-- 管理者
CREATE TABLE admins (
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

-- セッション
CREATE TABLE sessions (
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
CREATE TABLE events (
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
CREATE TABLE donations (
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
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- サブスクリプション
CREATE TABLE subscriptions (
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
CREATE TABLE invoices (
  id VARCHAR(50) PRIMARY KEY,
  subscription_id VARCHAR(50) REFERENCES subscriptions(id),
  stripe_invoice_id VARCHAR(255),
  amount INTEGER NOT NULL,
  status VARCHAR(20), -- 'paid' | 'failed' | 'refunded'
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 設定
CREATE TABLE settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP許可リスト
CREATE TABLE allowed_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_pattern VARCHAR(50) NOT NULL,  -- CIDR形式可
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監査ログ（セキュリティ）
CREATE TABLE audit_logs (
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
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limit記録（IP/ユーザー単位）
CREATE TABLE rate_limit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,        -- 'ip:192.168.1.1' or 'user:uuid'
  endpoint VARCHAR(255) NOT NULL,   -- 'POST /api/auth/login'
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  UNIQUE(key, endpoint, window_start)
);

-- Idempotency Key（二重決済防止）
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL  -- 24時間後に期限切れ
);

-- インデックス
CREATE INDEX idx_donations_event_id ON donations(event_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX idx_donations_stripe_session ON donations(stripe_session_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_donor_email ON subscriptions(donor_email);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_rate_limit_key_endpoint ON rate_limit_records(key, endpoint);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

---

## File Changes

| Phase | File | Action | Description |
|-------|------|--------|-------------|
| 1 | `src/types/index.ts` | Create | 型定義 |
| 1 | `src/lib/validation.ts` | Create | Zodバリデーションスキーマ |
| 1 | `src/db/schema.sql` | Create | DBスキーマ（監査ログ含む） |
| 1 | `src/lib/db.ts` | Create | DB接続 |
| 1 | `src/lib/auth.ts` | Create | 認証ロジック（Argon2id） |
| 1 | `src/lib/logger.ts` | Create | 構造化ログ |
| 1 | `src/lib/audit.ts` | Create | 監査ログ記録 |
| 1 | `src/middleware/auth.ts` | Create | 認証ミドルウェア |
| 1 | `src/middleware/csrf.ts` | Create | CSRF検証 |
| 1 | `src/middleware/rate-limit.ts` | Create | Rate Limiting |
| 1 | `src/middleware/ip-filter.ts` | Create | IP制限（プロキシ対応） |
| 1 | `src/middleware/security-headers.ts` | Create | セキュリティヘッダー |
| 2 | `src/lib/stripe.ts` | Create | Stripe連携 |
| 2 | `src/lib/idempotency.ts` | Create | 二重決済防止 |
| 2 | `src/routes/api/webhooks.ts` | Create | Webhook処理（署名検証） |
| 3 | `src/routes/api/donations.ts` | Create | 寄付API |
| 3 | `src/routes/api/subscriptions.ts` | Create | サブスクAPI |
| 3 | `src/routes/api/events.ts` | Create | イベントAPI |
| 3 | `src/routes/api/auth.ts` | Create | 認証API |
| 3 | `src/routes/api/settings.ts` | Create | 設定API |
| 3 | `src/routes/api/stats.ts` | Create | 統計API |
| 3 | `src/lib/mail.ts` | Create | メール送信 |
| 4 | `src/routes/admin/index.html` | Create | 管理画面 |
| 4 | `src/routes/admin/admin.ts` | Create | 管理画面ロジック |
| 5 | `src/routes/donate/index.html` | Create | 寄付ページ |
| 5 | `src/routes/embed/index.html` | Create | 埋め込みWidget |
| 5 | `src/lib/qrcode.ts` | Create | QRコード生成 |
| 6 | `Dockerfile` | Create | Docker設定 |
| 6 | `docker-compose.yml` | Create | 開発環境 |

---

## Testing Strategy

### Unit Tests
- `src/lib/*.test.ts` - ライブラリ関数
- `src/routes/api/*.test.ts` - APIエンドポイント

### Integration Tests
- Stripe Webhook処理
- 認証フロー
- 寄付完了フロー

### E2E Tests (後回し可)
- 寄付ページからStripe決済まで

---

## Environment Variables

```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/monobun_donation

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Mail (Resend or SMTP)
MAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxxxx

# App
APP_URL=https://donate.example.com
SESSION_SECRET=your-secret-key
ADMIN_INITIAL_EMAIL=admin@example.com
ADMIN_INITIAL_PASSWORD=initial-password

# Security
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,127.0.0.1
CAPTCHA_SITE_KEY=xxxxx  # hCaptcha or reCAPTCHA
CAPTCHA_SECRET_KEY=xxxxx
```

---

## メール認証設定（運用必須）

フィッシング・なりすまし対策のため、DNSに以下を設定:

### SPF (Sender Policy Framework)
```
example.com.  TXT  "v=spf1 include:_spf.resend.com ~all"
```

### DKIM (DomainKeys Identified Mail)
Resend管理画面から取得したDKIMレコードを設定

### DMARC (Domain-based Message Authentication)
```
_dmarc.example.com.  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
```

### メール内容のセキュリティ
```typescript
// メールに含めてはいけないもの
// ❌ パスワード変更リンク（リセットリンク以外）
// ❌ ログインリンク
// ❌ 送金依頼
// ❌ 個人情報の詳細

// メールに含めるべきもの
// ✅ 正規ドメインの明示
// ✅ 不審なアクティビティの報告先
// ✅ 寄付の確認情報のみ
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| ブルートフォース攻撃 | High | Rate Limiting + アカウントロックアウト + CAPTCHA |
| 分散ブルートフォース | High | グローバルログイン遅延 + CAPTCHA |
| パスワード漏洩 | High | Argon2id（メモリ64MB、3イテレーション）|
| セッションハイジャック | High | HTTPOnly + Secure + SameSite Cookie + IP検証 |
| セッション固定攻撃 | High | ログイン時に既存セッション破棄 + 新規発行 |
| CSRF攻撃 | High | SameSite=Strict + CSRFトークン |
| 二重決済 | High | Stripe Idempotency Key + DB制約 |
| Webhook偽造 | High | Stripe署名検証必須 + イベントID重複チェック |
| SQLインジェクション | High | Bun.sqlパラメータ化クエリ + Zodバリデーション |
| メールなりすまし | High | SPF + DKIM + DMARC設定必須 |
| フィッシング | High | 正規ドメイン明示 + メールに危険リンク含めない |
| XSS | Medium | HTMLエスケープ + CSP設定 |
| IP制限バイパス | Medium | 信頼できるプロキシのみX-Forwarded-For許可 |
| IPアドレス変更 | Medium | セッション中IP変更で再認証要求 |
| 情報漏洩 | Medium | ログマスキング、本番でスタックトレース非公開 |
| DoS攻撃 | Medium | 全エンドポイントRate Limiting + CDN/WAF |
| クリックジャッキング | Low | X-Frame-Options + CSP frame-ancestors |

## Security Checklist

実装完了時に確認するチェックリスト:

### 認証・セッション
- [ ] 全てのパスワードがArgon2idでハッシュ化されている
- [ ] セッショントークンが暗号論的に安全に生成されている（32バイト以上）
- [ ] ログイン時に既存セッションを破棄し新規発行している
- [ ] セッション中のIPアドレス変更を検知している
- [ ] 初期パスワード変更が強制されている
- [ ] パスワードリセット機能が安全に実装されている
- [ ] アカウントロックアウトが実装されている（5回失敗で30分）
- [ ] CAPTCHA（3回失敗後）が実装されている

### CSRF・Rate Limiting
- [ ] CSRFトークンが全ての状態変更リクエストで検証されている
- [ ] Rate Limitingが全エンドポイントに適用されている
- [ ] 分散攻撃対策（グローバル遅延）が実装されている

### 決済
- [ ] Stripe Webhookの署名検証が実装されている
- [ ] Webhook イベントIDの重複チェックが実装されている
- [ ] Idempotency Keyが決済リクエストで使用されている

### 入力・出力
- [ ] 全ての入力がZodでバリデーションされている
- [ ] セキュリティヘッダーが設定されている
- [ ] 本番環境でエラー詳細が非公開になっている

### ログ・監査
- [ ] 監査ログが管理操作に記録されている
- [ ] ログにセンシティブ情報が含まれていない（メールマスキング）
- [ ] セッショントークンがログに出力されていない

### 運用
- [ ] SPF/DKIM/DMARCがDNSに設定されている
- [ ] メールに危険なリンクが含まれていない
- [ ] 正規ドメインがメールに明示されている
- [ ] CDN/WAFの導入を検討済み
