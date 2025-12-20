# Feature Specification: REST API

## Overview

寄付システムのREST API。管理画面・埋め込みWidget・外部連携で使用。

## Base URL

```
https://donate.example.com/api
```

## 認証

### 管理API
```http
Authorization: Bearer <session_token>
X-CSRF-Token: <csrf_token>
Cookie: session=<session_cookie>; HttpOnly; Secure; SameSite=Strict
```

### 公開API
認証不要（寄付作成、イベント取得など）
ただしRate Limiting適用

---

## セキュリティ共通仕様

### Rate Limiting

全エンドポイントにレート制限を適用。超過時は `429 Too Many Requests` を返す。

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703145600
```

| エンドポイント | Window | Max |
|---------------|--------|-----|
| POST /api/auth/login | 15分 | 5回 |
| POST /api/donations | 1分 | 10回 |
| POST /api/subscriptions | 1分 | 5回 |
| GET /api/events | 1分 | 60回 |
| * /api/admin/* | 1分 | 120回 |

### 二重リクエスト防止 (Idempotency)

決済系エンドポイントには `Idempotency-Key` ヘッダーを推奨:

```http
POST /api/donations
Idempotency-Key: donation_550e8400-e29b-41d4-a716-446655440000
```

同じキーで2回目以降のリクエストは、最初のレスポンスを返す（再処理しない）。

---

## Endpoints

### 寄付 (Donations)

#### 寄付作成（公開）
```http
POST /api/donations
Content-Type: application/json

{
  "type": "one-time",
  "amount": 1000,
  "paymentMethod": "card",
  "eventId": null,
  "donor": {
    "email": "user@example.com",
    "name": "Anonymous"
  },
  "message": "応援しています！"
}
```

**Response: 200 OK**
```json
{
  "id": "don_abc123",
  "stripeSessionUrl": "https://checkout.stripe.com/...",
  "status": "pending"
}
```

#### 寄付一覧（管理者）
```http
GET /api/admin/donations?page=1&limit=20&eventId=summer-2025
Authorization: Bearer <token>
```

**Response: 200 OK**
```json
{
  "donations": [
    {
      "id": "don_abc123",
      "type": "one-time",
      "amount": 1000,
      "donorEmail": "user@example.com",
      "donorName": "Anonymous",
      "status": "completed",
      "createdAt": "2025-12-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

#### 寄付詳細（管理者）
```http
GET /api/admin/donations/:id
Authorization: Bearer <token>
```

---

### サブスクリプション (Subscriptions)

#### サブスク作成（公開）
```http
POST /api/subscriptions
Content-Type: application/json

{
  "type": "monthly",
  "amount": 500,
  "paymentMethod": "card",
  "donor": {
    "email": "user@example.com",
    "name": "サポーター"
  }
}
```

**Response: 200 OK**
```json
{
  "id": "sub_xyz789",
  "stripeSessionUrl": "https://checkout.stripe.com/...",
  "status": "pending"
}
```

#### サブスク解約（公開・トークン認証）
```http
POST /api/subscriptions/:id/cancel
Content-Type: application/json

{
  "cancelToken": "<email_link_token>"
}
```

#### サブスク返金（管理者）
```http
POST /api/admin/subscriptions/:id/refund
Authorization: Bearer <token>

{
  "reason": "ユーザーリクエスト"
}
```

**Response: 400 Bad Request**（7日超過時）
```json
{
  "error": "REFUND_PERIOD_EXPIRED",
  "message": "返金期限（7日）を超過しています"
}
```

#### サブスク一覧（管理者）
```http
GET /api/admin/subscriptions?status=active
Authorization: Bearer <token>
```

---

### イベント (Events)

#### イベント一覧（公開）
```http
GET /api/events?status=active
```

**Response: 200 OK**
```json
{
  "events": [
    {
      "id": "summer-2025",
      "name": "夏祭り2025",
      "description": "今年の夏祭りを応援！",
      "goalAmount": 100000,
      "currentAmount": 45000,
      "donationCount": 23,
      "priceOptions": [
        { "label": "応援", "amount": 500 },
        { "label": "サポーター", "amount": 1000 },
        { "label": "カスタム", "amount": null }
      ],
      "status": "active",
      "endsAt": "2025-08-31T23:59:59Z",
      "donateUrl": "/donate/summer-2025",
      "qrCodeUrl": "/qr/summer-2025.png"
    }
  ]
}
```

#### イベント詳細（公開）
```http
GET /api/events/:id
```

#### イベント作成（管理者）
```http
POST /api/admin/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "summer-2025",
  "name": "夏祭り2025",
  "description": "今年の夏祭りを応援！",
  "goalAmount": 100000,
  "priceOptions": [
    { "label": "応援", "amount": 500 },
    { "label": "サポーター", "amount": 1000 },
    { "label": "スポンサー", "amount": 5000 },
    { "label": "カスタム", "amount": null }
  ],
  "startsAt": "2025-07-01T00:00:00Z",
  "endsAt": "2025-08-31T23:59:59Z"
}
```

#### イベント更新（管理者）
```http
PUT /api/admin/events/:id
Authorization: Bearer <token>
```

#### イベント削除（管理者）
```http
DELETE /api/admin/events/:id
Authorization: Bearer <token>
```

---

### 認証 (Auth)

#### ログイン
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "secure_password"
}
```

**Response: 200 OK**
```json
{
  "token": "session_token_here",
  "csrfToken": "csrf_token_here",
  "expiresAt": "2025-12-21T10:00:00Z",
  "user": {
    "id": "usr_001",
    "email": "admin@example.com",
    "role": "editor"
  }
}
```

**Response: 200 OK（パスワード変更必須）**
```json
{
  "requirePasswordChange": true,
  "tempToken": "temp_token_for_password_change"
}
```

**Response: 403 Forbidden**（IP制限）
```json
{
  "error": "IP_NOT_ALLOWED",
  "message": "このIPアドレスからのアクセスは許可されていません"
}
```

**Response: 429 Too Many Requests**（Rate Limit超過）
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "ログイン試行回数が上限を超えました。15分後に再試行してください",
  "retryAfter": 900
}
```

#### パスワード変更（初回ログイン時）
```http
POST /api/auth/change-password
Content-Type: application/json

{
  "tempToken": "temp_token_for_password_change",
  "newPassword": "new_secure_password"
}
```

**パスワード要件:**
- 最小12文字
- 大文字・小文字・数字を含む
- 一般的なパスワードリストに含まれない

#### パスワード変更（通常）
```http
POST /api/auth/change-password
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
Content-Type: application/json

{
  "currentPassword": "current_password",
  "newPassword": "new_secure_password"
}
```

#### ログアウト
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### 現在のユーザー
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

### 設定 (Settings)

#### 設定取得（管理者）
```http
GET /api/admin/settings
Authorization: Bearer <token>
```

**Response: 200 OK**
```json
{
  "site": {
    "name": "My Donation Site",
    "url": "https://donate.example.com"
  },
  "refund": {
    "subscriptionRefundDays": 7
  },
  "notification": {
    "adminEmail": "admin@example.com",
    "webhookUrl": "https://hooks.example.com/donations"
  },
  "legal": {
    "businessName": "株式会社○○",
    "representative": "山田太郎",
    "address": "東京都...",
    "phone": "03-xxxx-xxxx",
    "email": "support@example.com"
  },
  "embed": {
    "allowedDomains": ["example.com", "wordpress.example.com"]
  }
}
```

#### 設定更新（管理者・editor権限）
```http
PUT /api/admin/settings
Authorization: Bearer <token>
Content-Type: application/json
```

---

### 統計 (Stats)

#### ダッシュボード統計（管理者）
```http
GET /api/admin/stats?period=30d
Authorization: Bearer <token>
```

**Response: 200 OK**
```json
{
  "period": "30d",
  "totalAmount": 450000,
  "donationCount": 89,
  "activeSubscriptions": 12,
  "monthlyRecurring": 15000,
  "byPaymentMethod": {
    "card": 350000,
    "paypay": 80000,
    "bank_transfer": 20000
  },
  "topEvents": [
    { "id": "summer-2025", "name": "夏祭り2025", "amount": 120000 }
  ]
}
```

---

### Webhook受信 (Stripe)

#### Stripe Webhook
```http
POST /api/webhooks/stripe
Stripe-Signature: <signature>
```

処理するイベント:
- `checkout.session.completed` - 決済完了
- `invoice.payment_succeeded` - サブスク更新成功
- `invoice.payment_failed` - 決済失敗
- `customer.subscription.deleted` - サブスク解約

---

## エラーレスポンス

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

| コード | HTTP Status | 説明 |
|--------|-------------|------|
| VALIDATION_ERROR | 400 | 入力値エラー |
| UNAUTHORIZED | 401 | 認証必要 |
| FORBIDDEN | 403 | 権限なし |
| NOT_FOUND | 404 | リソースなし |
| REFUND_PERIOD_EXPIRED | 400 | 返金期限超過 |
| IP_NOT_ALLOWED | 403 | IP制限 |
| RATE_LIMIT_EXCEEDED | 429 | レート制限超過 |
| CSRF_TOKEN_MISMATCH | 403 | CSRFトークン不一致 |
| PASSWORD_TOO_WEAK | 400 | パスワード要件不足 |
| DUPLICATE_REQUEST | 409 | 重複リクエスト（Idempotency） |
| WEBHOOK_SIGNATURE_INVALID | 400 | Webhook署名不正 |
| STRIPE_ERROR | 500 | Stripe API エラー |
| INTERNAL_ERROR | 500 | 内部エラー（詳細非公開） |

### 本番環境でのエラー詳細

本番環境では内部エラーの詳細は返さない:

```json
// 開発環境
{
  "error": "INTERNAL_ERROR",
  "message": "Database connection failed",
  "stack": "Error: Database connection failed\n    at ..."
}

// 本番環境
{
  "error": "INTERNAL_ERROR",
  "message": "An error occurred. Please try again later.",
  "requestId": "req_abc123"  // サポート問い合わせ用
}
```

---

## Usage Examples

```typescript
// 寄付作成
const response = await fetch("/api/donations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "one-time",
    amount: 1000,
    paymentMethod: "card",
    donor: { email: "user@example.com" },
  }),
});

const { stripeSessionUrl } = await response.json();
window.location.href = stripeSessionUrl;
```

```typescript
// 管理者: イベント作成
const response = await fetch("/api/admin/events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({
    id: "winter-2025",
    name: "冬のキャンペーン",
    priceOptions: [
      { label: "応援", amount: 500 },
      { label: "カスタム", amount: null },
    ],
  }),
});
```
