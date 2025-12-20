# Tasks: Phase 1 - Foundation (Core + Security)

## Prerequisites

- [ ] Bun 1.0+ インストール済み
- [ ] PostgreSQL 15+ 接続可能
- [ ] 仕様書確認済み

---

## 1. プロジェクト構造セットアップ

- [ ] **1.1** ディレクトリ構造作成
  ```
  src/
    routes/api/
    lib/
    middleware/
    types/
    db/
  ```
- [ ] **1.2** package.json 更新（依存関係追加）
  - zod: バリデーション
  - stripe: 決済
- [ ] **1.3** tsconfig.json strict mode 確認

---

## 2. データベース

- [ ] **2.1** schema.sql 作成（全テーブル定義）
- [ ] **2.2** src/lib/db.ts 作成（Bun.sql接続）
- [ ] **2.3** DB接続テスト作成

---

## 3. 型定義

- [ ] **3.1** src/types/index.ts 作成
  - Admin, Session, Event, Donation, Subscription
  - DonationType, PaymentMethod, AdminRole
- [ ] **3.2** src/lib/validation.ts 作成（Zodスキーマ）
  - DonationSchema, SubscriptionSchema, EventSchema
  - LoginSchema, PasswordSchema

---

## 4. 認証システム

- [ ] **4.1** src/lib/auth.ts 作成
  - hashPassword (Argon2id)
  - verifyPassword
  - generateSessionToken (crypto.randomBytes)
  - generateCsrfToken
  - createSession
  - validateSession
  - destroySession
  - destroyAllSessions
- [ ] **4.2** 認証テスト作成
- [ ] **4.3** パスワードリセット機能
  - generateResetToken
  - validateResetToken
  - resetPassword

---

## 5. セキュリティミドルウェア

- [ ] **5.1** src/middleware/auth.ts
  - requireAuth: セッション検証
  - requireRole: 権限チェック
- [ ] **5.2** src/middleware/csrf.ts
  - validateCsrf: CSRFトークン検証
- [ ] **5.3** src/middleware/rate-limit.ts
  - rateLimit: エンドポイント別制限
  - globalLoginDelay: 分散攻撃対策
- [ ] **5.4** src/middleware/ip-filter.ts
  - ipFilter: IP許可リストチェック
  - getClientIP: プロキシ対応
- [ ] **5.5** src/middleware/security-headers.ts
  - securityHeaders: HSTS, CSP等設定

---

## 6. ログ・監査

- [ ] **6.1** src/lib/logger.ts
  - 構造化ログ（JSON形式）
  - maskEmail: メールマスキング
  - 開発/本番モード切替
- [ ] **6.2** src/lib/audit.ts
  - recordAudit: 監査ログ記録
  - 管理者操作の追跡

---

## 7. 基本サーバー

- [ ] **7.1** src/index.ts 更新
  - Bun.serve() セットアップ
  - ミドルウェア統合
  - ルーティング基盤
- [ ] **7.2** 認証API実装
  - POST /api/auth/login
  - POST /api/auth/logout
  - POST /api/auth/logout-all
  - GET /api/auth/me
  - POST /api/auth/change-password
  - POST /api/auth/forgot-password
  - POST /api/auth/reset-password

---

## 8. テスト

- [ ] **8.1** 認証フローテスト
- [ ] **8.2** Rate Limitingテスト
- [ ] **8.3** CSRF検証テスト
- [ ] **8.4** IP制限テスト

---

## Verification Checklist

- [ ] `bun test` 全テストパス
- [ ] Argon2idでハッシュ化確認
- [ ] セッショントークン32バイト以上
- [ ] CSRF検証動作確認
- [ ] Rate Limiting動作確認
- [ ] セキュリティヘッダー設定確認

---

## Done When

- [ ] 全タスク完了
- [ ] 全テストパス
- [ ] ログイン→操作→ログアウトのフロー動作確認
