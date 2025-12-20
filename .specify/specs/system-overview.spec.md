# Feature Specification: Monobun Donation System

## Overview

Bun製のセルフホスト型寄付管理システム。Stripe統合による決済処理、管理画面、WordPress埋め込み対応。

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                     Monobun Donation                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  管理画面   │    │  埋め込み   │    │   寄付      │     │
│  │  /admin     │    │  /embed     │    │   /donate   │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                    ┌───────▼───────┐                        │
│                    │   REST API    │                        │
│                    │   /api/*      │                        │
│                    └───────┬───────┘                        │
│                            │                                │
│              ┌─────────────┼─────────────┐                  │
│              │             │             │                  │
│       ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐            │
│       │ PostgreSQL  │ │ Stripe  │ │   Mail    │            │
│       │  (Bun.sql)  │ │   API   │ │  Service  │            │
│       └─────────────┘ └─────────┘ └───────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Runtime | Bun |
| Server | Bun.serve() |
| Database | PostgreSQL (Bun.sql) |
| Payment | Stripe (クレカ, PayPay, 銀行振込) |
| Frontend | HTML imports + Vanilla JS/TS |
| Styling | CSS (カスタマイズ可能) |

## 寄付タイプ

```typescript
type DonationType = "one-time" | "monthly" | "yearly" | "event";
```

| タイプ | 説明 | 返金 |
|--------|------|------|
| one-time | 単発寄付 | 不可 |
| monthly | 月額サブスク | 7日以内全額 |
| yearly | 年額サブスク | 7日以内全額 |
| event | イベント紐づき | 不可 |

## 決済方法

```typescript
type PaymentMethod = "card" | "paypay" | "bank_transfer";
```

| 方法 | 手数料 | サブスク対応 |
|------|--------|-------------|
| card | 3.6% (+0.7% サブスク) | ○ |
| paypay | 3.6% | ○ |
| bank_transfer | 1.5% | × |

## 認証・認可

### 管理者認証
- メールアドレス + パスワード
- IP制限（ホワイトリスト）
- セッション管理

### 権限レベル
```typescript
type AdminRole = "viewer" | "editor";
```

| 権限 | 閲覧 | 作成/編集 | 削除 | 設定変更 |
|------|------|----------|------|---------|
| viewer | ○ | × | × | × |
| editor | ○ | ○ | ○ | ○ |

## 通知

| イベント | 管理者メール | 寄付者メール | Webhook |
|---------|-------------|-------------|---------|
| 寄付完了 | ○ | ○ | ○ |
| 決済失敗 | ○ | ○ | ○ |
| サブスク更新 | ○ | ○ | ○ |
| サブスク解約 | ○ | ○ | ○ |

## イベント寄付

```typescript
interface DonationEvent {
  id: string;
  name: string;
  description?: string;
  goalAmount?: number;        // 任意
  priceOptions: PriceOption[];
  startsAt?: string;
  endsAt?: string;
  status: "draft" | "active" | "ended";

  // 自動生成
  donateUrl: string;          // /donate/:id
  qrCodeUrl: string;          // /qr/:id.png
}

interface PriceOption {
  label: string;
  amount: number | null;      // null = カスタム金額
}
```

## 埋め込みWidget

### iframe方式（推奨）
```html
<iframe
  src="https://donate.example.com/embed/summer-2025"
  width="100%"
  height="500"
  style="border: none;"
></iframe>
```

### カスタマイズパラメータ
```
/embed/:eventId?
  theme=light|dark
  &primaryColor=#FF5500
  &bgColor=#FFFFFF
  &bgImage=https://...
  &fontFamily=sans-serif
```

## 法的表記

管理画面で編集可能な特定商取引法表記：
- 販売事業者名
- 代表者名
- 所在地
- 連絡先
- 返品・返金ポリシー

## セキュリティ

### 認証・セッション管理

```typescript
// パスワードハッシュ: Argon2id (Bunネイティブ)
const hash = await Bun.password.hash(password, {
  algorithm: "argon2id",
  memoryCost: 65536,  // 64MB
  timeCost: 3,
});

// セッショントークン: 暗号論的に安全な生成
const token = crypto.randomBytes(32).toString("hex");

// セッション有効期限
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;  // 24時間
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;  // 30分無操作でログアウト
```

### CSRF対策

```typescript
// 1. SameSite Cookie
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict; Path=/

// 2. 状態変更リクエストにCSRFトークン必須
// フロントエンド
headers: { "X-CSRF-Token": csrfToken }

// バックエンド検証
if (request.headers.get("X-CSRF-Token") !== session.csrfToken) {
  return new Response("CSRF token mismatch", { status: 403 });
}
```

### Rate Limiting

```typescript
const rateLimits = {
  // 認証系: 厳しく制限
  "POST /api/auth/login": { window: "15m", max: 5 },
  "POST /api/auth/logout": { window: "1m", max: 10 },

  // 公開API: 中程度
  "POST /api/donations": { window: "1m", max: 10 },
  "POST /api/subscriptions": { window: "1m", max: 5 },
  "GET /api/events": { window: "1m", max: 60 },

  // 管理API: 緩め
  "* /api/admin/*": { window: "1m", max: 120 },
};
```

### 二重決済防止

```typescript
// Stripe Idempotency Key使用
const session = await stripe.checkout.sessions.create({
  // ...
}, {
  idempotencyKey: `donation_${crypto.randomUUID()}`,
});

// DB側ユニーク制約
CREATE UNIQUE INDEX idx_donations_idempotency
ON donations(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
```

### Webhook署名検証

```typescript
// Stripe Webhook必須検証
const sig = request.headers.get("stripe-signature");
let event: Stripe.Event;

try {
  event = stripe.webhooks.constructEvent(
    await request.text(),
    sig!,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
} catch (err) {
  console.error("Webhook signature verification failed");
  return new Response("Invalid signature", { status: 400 });
}

// 再送攻撃防止: イベントID重複チェック
const exists = await db.query(
  "SELECT 1 FROM webhook_events WHERE stripe_event_id = $1",
  [event.id]
);
if (exists.rows.length > 0) {
  return new Response("Already processed", { status: 200 });
}
```

### 入力バリデーション (Zod)

```typescript
import { z } from "zod";

const DonationSchema = z.object({
  type: z.enum(["one-time", "monthly", "yearly", "event"]),
  amount: z.number().int().min(100).max(10_000_000),
  eventId: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  donor: z.object({
    email: z.string().email().max(255),
    name: z.string().max(100).optional(),
  }),
  message: z.string().max(1000).optional(),
});
```

### IP制限（プロキシ対応）

```typescript
const TRUSTED_PROXIES = ["10.0.0.0/8", "172.16.0.0/12", "127.0.0.1"];

function getClientIP(request: Request, directIP: string): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (isTrustedProxy(directIP, TRUSTED_PROXIES) && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return directIP;
}
```

### セキュリティヘッダー

```typescript
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "X-Frame-Options": "DENY",  // 埋め込みページ以外
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
};
```

### 個人情報保護

```typescript
// ログにはマスク済みデータのみ
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

logger.info("Donation created", {
  email: maskEmail(donor.email),  // u***@example.com
  amount,
});
```

### 監査ログ

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### 初期パスワード強制変更

```typescript
// 初回ログイン時
if (admin.must_change_password) {
  return Response.json({
    requirePasswordChange: true,
    tempToken: generateTempToken(admin.id),
  });
}
```

## デプロイ

セルフホスト前提：
- Docker対応
- 環境変数で設定
- PostgreSQL接続
- Stripe API Key設定
