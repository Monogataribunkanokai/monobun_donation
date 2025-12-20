# Security Review Report

## Executive Summary

現在の仕様・計画をセキュリティ観点でレビューした結果、**15件の懸念事項**を特定。
うち**高リスク5件**、**中リスク6件**、**低リスク4件**。

---

## 高リスク (Critical)

### 1. パスワードハッシュ化アルゴリズム未指定

**現状**: `password_hash`カラムのみ定義、アルゴリズム未指定

**リスク**: 弱いハッシュ（MD5, SHA1）使用でパスワード漏洩時に解読される

**推奨対策**:
```typescript
// Argon2id を使用（Bunネイティブ対応）
const hash = await Bun.password.hash(password, {
  algorithm: "argon2id",
  memoryCost: 65536,  // 64MB
  timeCost: 3,
});
```

---

### 2. Rate Limiting 未実装

**現状**: APIにレート制限なし

**リスク**:
- ブルートフォース攻撃（ログイン試行）
- DoS攻撃
- Stripe API枯渇

**推奨対策**:
```typescript
// エンドポイント別レート制限
const rateLimits = {
  "POST /api/auth/login": { window: "15m", max: 5 },   // 15分に5回
  "POST /api/donations": { window: "1m", max: 10 },   // 1分に10回
  "POST /api/admin/*": { window: "1m", max: 60 },     // 1分に60回
};
```

---

### 3. CSRF対策の具体実装なし

**現状**: 「CSRF対策」と記載のみ、具体的実装なし

**リスク**: 管理画面での不正操作（イベント削除、設定変更等）

**推奨対策**:
```typescript
// SameSite Cookie + CSRFトークン
// 1. セッションCookieにSameSite=Strict
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict

// 2. 状態変更リクエストにCSRFトークン必須
headers: { "X-CSRF-Token": csrfToken }
```

---

### 4. 二重決済防止機構なし

**現状**: 決済リクエストの冪等性保証なし

**リスク**: ネットワーク遅延でユーザーが再送信→二重課金

**推奨対策**:
```typescript
// Idempotency Key使用
const response = await stripe.checkout.sessions.create({
  // ...
}, {
  idempotencyKey: `donation_${uniqueRequestId}`,
});

// DB側でもユニーク制約
CREATE UNIQUE INDEX idx_donations_idempotency
ON donations(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
```

---

### 5. Webhook署名検証の詳細なし

**現状**: Webhookエンドポイントあり、署名検証の実装詳細なし

**リスク**: 偽造Webhookで決済ステータス改ざん

**推奨対策**:
```typescript
// 必ず署名検証を行う
const sig = request.headers.get("stripe-signature");
let event: Stripe.Event;

try {
  event = stripe.webhooks.constructEvent(
    await request.text(),
    sig!,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
} catch (err) {
  return new Response("Invalid signature", { status: 400 });
}

// Webhookの再送攻撃防止
// イベントIDをDBに保存して重複チェック
```

---

## 中リスク (Medium)

### 6. セッション管理の脆弱性

**現状**: トークン生成方法、有効期限未詳細

**リスク**: 予測可能なトークン、長すぎる有効期限

**推奨対策**:
```typescript
// 暗号論的に安全なトークン生成
import { randomBytes } from "crypto";
const token = randomBytes(32).toString("hex");

// 有効期限設定
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24時間
const IDLE_TIMEOUT = 30 * 60 * 1000;          // 30分無操作でログアウト
```

---

### 7. IP制限のバイパス可能性

**現状**: IP制限あり、プロキシ考慮なし

**リスク**: X-Forwarded-For偽装でIP制限バイパス

**推奨対策**:
```typescript
// 信頼できるプロキシからのみX-Forwarded-Forを受け入れ
const TRUSTED_PROXIES = ["10.0.0.0/8", "172.16.0.0/12"];

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const directIP = request.headers.get("x-real-ip") || "unknown";

  // 信頼できるプロキシ経由の場合のみforwardedを使用
  if (isTrustedProxy(directIP) && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return directIP;
}
```

---

### 8. 入力バリデーション不十分

**現状**: バリデーションの具体的ルールなし

**リスク**: 不正データ、XSS、NoSQLインジェクション

**推奨対策**:
```typescript
// Zodによる厳密なバリデーション
import { z } from "zod";

const DonationSchema = z.object({
  type: z.enum(["one-time", "monthly", "yearly", "event"]),
  amount: z.number().int().min(100).max(10_000_000), // 100円〜1000万円
  eventId: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  donor: z.object({
    email: z.string().email().max(255),
    name: z.string().max(100).optional(),
  }),
  message: z.string().max(1000).optional(),
});
```

---

### 9. エラーメッセージの情報漏洩

**現状**: エラーハンドリング詳細なし

**リスク**: スタックトレース、DB情報の漏洩

**推奨対策**:
```typescript
// 本番環境では詳細を隠す
function handleError(error: Error, isDev: boolean) {
  console.error(error); // ログには出力

  if (isDev) {
    return { error: error.message, stack: error.stack };
  }

  // 本番は汎用メッセージのみ
  return { error: "INTERNAL_ERROR", message: "An error occurred" };
}
```

---

### 10. 個人情報の保護不足

**現状**: メールアドレス平文保存、ログ出力不明

**リスク**: DB漏洩時のプライバシー侵害、GDPR違反

**推奨対策**:
```typescript
// センシティブデータのマスキング
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

// ログにはマスク済みデータのみ
logger.info("Donation created", {
  email: maskEmail(donor.email),
  amount
});
```

---

### 11. 管理者初期パスワードの扱い

**現状**: 環境変数で初期パスワード設定

**リスク**: 初期パスワードの変更忘れ、ログに残る可能性

**推奨対策**:
```typescript
// 初回ログイン時に強制パスワード変更
if (admin.mustChangePassword) {
  return { requirePasswordChange: true };
}

// 初期パスワードは一時的なもので、使用後は無効化
```

---

## 低リスク (Low)

### 12. ログの不整合

**現状**: ログ形式未定義

**リスク**: 監査・トラブルシュートの困難さ

**推奨対策**:
```typescript
// 構造化ログ
const logger = {
  info: (message: string, meta: object) => {
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message,
      ...meta,
    }));
  },
};
```

---

### 13. 依存関係の脆弱性

**現状**: 依存パッケージのセキュリティチェックなし

**リスク**: 既知の脆弱性を持つパッケージ使用

**推奨対策**:
```bash
# 定期的な脆弱性チェック
bun audit

# Renovate/Dependabotで自動更新
```

---

### 14. バックアップ戦略なし

**現状**: DBバックアップ未定義

**リスク**: データ喪失、ランサムウェア攻撃

**推奨対策**:
- 日次自動バックアップ
- 別リージョンへのレプリケーション
- 定期的なリストアテスト

---

### 15. iframe埋め込みのクリックジャッキング

**現状**: X-Frame-Optionsの設定方針あり

**リスク**: 許可ドメイン設定ミスでクリックジャッキング

**推奨対策**:
```typescript
// CSPも併用
const allowedOrigins = settings.embed.allowedDomains;
const csp = `frame-ancestors 'self' ${allowedOrigins.join(" ")}`;

response.headers.set("Content-Security-Policy", csp);
response.headers.set("X-Frame-Options", "SAMEORIGIN"); // フォールバック
```

---

## 追加で検討すべき事項

### A. 監査ログ

管理者の操作履歴を記録:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  admin_id UUID,
  action VARCHAR(100),      -- 'event.create', 'settings.update', etc.
  target_type VARCHAR(50),  -- 'event', 'donation', 'subscription'
  target_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### B. セキュリティヘッダー

```typescript
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
```

### C. 決済の監視

```typescript
// 異常検知
const alerts = {
  highAmount: 100000,       // 10万円以上で通知
  rapidDonations: 10,       // 1時間に10件以上で通知
  failureRate: 0.1,         // 失敗率10%超で通知
};
```

---

## 優先度別対応表

| 優先度 | 項目 | 対応 |
|--------|------|------|
| P0 | パスワードハッシュ | Argon2id使用を仕様に明記 |
| P0 | Rate Limiting | 実装計画に追加 |
| P0 | CSRF対策 | SameSite + トークンを仕様に明記 |
| P0 | 二重決済防止 | Idempotency Key必須を仕様に明記 |
| P0 | Webhook署名検証 | 実装詳細を計画に追加 |
| P1 | セッション管理 | 有効期限・トークン生成方法を明記 |
| P1 | IP制限改善 | 信頼プロキシ設定を追加 |
| P1 | 入力バリデーション | Zodスキーマを仕様に追加 |
| P1 | エラーハンドリング | 本番向け処理を明記 |
| P1 | 個人情報保護 | ログマスキングを明記 |
| P1 | 初期パスワード | 強制変更フローを追加 |
| P2 | ログ形式 | 構造化ログを採用 |
| P2 | 依存関係監査 | CI/CDに組み込み |
| P2 | バックアップ | 運用ドキュメントに追加 |
| P2 | クリックジャッキング | CSP設定を詳細化 |

---

## 結論

**実装前に必ず対応すべき項目**: P0の5件

**Phase 1に組み込むべき項目**: P1の6件

**運用開始前に対応すべき項目**: P2の4件
