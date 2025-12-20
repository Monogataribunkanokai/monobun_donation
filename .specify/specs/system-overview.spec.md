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

- HTTPS必須
- CSRFトークン
- XSS対策
- SQLインジェクション対策（Bun.sqlパラメータ化）
- iframe: X-Frame-Options設定（許可ドメイン指定）
- 管理画面: IP制限 + セッション有効期限

## デプロイ

セルフホスト前提：
- Docker対応
- 環境変数で設定
- PostgreSQL接続
- Stripe API Key設定
