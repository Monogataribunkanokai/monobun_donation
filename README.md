# Monobun Donation

Bun + PostgreSQL + Stripeで構築された寄付システムです。

## 特徴

- **高速**: Bunランタイムによる高速な処理
- **セキュア**: Argon2idパスワードハッシュ、CSRF保護、レート制限
- **柔軟な決済**: Stripe連携による複数の決済方法に対応
- **定期寄付**: サブスクリプション機能で毎月の定期寄付が可能
- **管理画面**: 寄付履歴の確認、払い戻し処理、統計表示

## 対応決済方法

- クレジットカード (Visa, Mastercard, JCB, American Express)
- PayPay
- 銀行振込
- Apple Pay / Google Pay

## セットアップ

### 必要なもの

- [Bun](https://bun.sh/) v1.0以上
- PostgreSQL 14以上
- Stripeアカウント

### インストール

```bash
bun install
```

### 環境変数

`.env`ファイルを作成:

```env
DATABASE_URL=postgres://user:password@localhost:5432/donation
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-secret-key
```

### データベース初期化

```bash
bun run src/scripts/init-db.ts
```

### 起動

```bash
bun run src/index.ts
```

開発時（ホットリロード有効）:

```bash
bun --hot src/index.ts
```

## テスト

```bash
bun test
```

現在117個のテストで品質を担保しています。

## ドキュメント

- [サービス概要（非エンジニア向け）](docs/SERVICE_OVERVIEW.md) - 機能説明、料金体系、セキュリティ対策

## デモ

GitHub Pagesでデモページを公開しています:

- [デモページ一覧](https://gs-bacon.github.io/monobun_donation/demo/)

## プロジェクト構成

```
src/
  ├── index.ts           # エントリーポイント
  ├── routes/            # APIルート
  ├── lib/               # ユーティリティ
  │   ├── auth.ts        # 認証処理
  │   ├── db.ts          # データベース操作
  │   ├── stripe.ts      # Stripe連携
  │   └── validation.ts  # バリデーション
  ├── middleware/        # ミドルウェア
  │   ├── auth.ts        # 認証ミドルウェア
  │   ├── rate-limit.ts  # レート制限
  │   └── security-headers.ts  # セキュリティヘッダー
  └── types/             # 型定義
docs/
  └── SERVICE_OVERVIEW.md  # サービス概要
public/
  └── demo/              # デモページ
```

## セキュリティ

- Argon2idによるパスワードハッシュ
- JWTトークン認証
- CSRF保護
- レート制限（ログイン試行制限）
- アカウントロックアウト
- セキュリティヘッダー（CSP, HSTS等）

## ライセンス

MIT
