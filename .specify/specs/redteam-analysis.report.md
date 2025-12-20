# Red Team Analysis Report

## 攻撃者の目標

1. **データ抜き取り**: 寄付者メールアドレス、決済情報、管理者認証情報
2. **フィッシング**: 偽寄付ページで決済情報詐取
3. **なりすまし**: 管理者権限奪取、寄付者への偽メール送信
4. **金銭詐取**: 二重決済、返金悪用、寄付金横領

---

## Attack Vector 1: 管理者アカウント奪取

### 1.1 ブルートフォース攻撃

**攻撃**: ログインエンドポイントに大量のパスワード試行

**現状の対策**: Rate Limiting (15分に5回)

**残存リスク**: ⚠️ 中
- 分散攻撃（複数IP）でRate Limit回避可能
- ボットネット使用で1IPあたり5回×数万IPで十分な試行可能

**追加対策案**:
```typescript
// 1. アカウント単位のロックアウト（既存）
if (admin.failed_login_attempts >= 5) {
  admin.locked_until = now + 30min;
}

// 2. グローバルログイン遅延（追加推奨）
// 全体で失敗が急増したらシステム全体で遅延
if (globalFailedLogins > 100 per minute) {
  await sleep(5000); // 全ログインに5秒遅延
}

// 3. CAPTCHA（追加推奨）
// 3回失敗後はCAPTCHA必須
```

---

### 1.2 セッションハイジャック

**攻撃**: セッショントークンを盗んで管理者になりすます

**盗む方法**:
- XSSで`document.cookie`読み取り → **対策済み**: HttpOnly Cookie
- ネットワーク盗聴 → **対策済み**: Secure Cookie (HTTPS必須)
- サーバーログから漏洩 → **要確認**: トークンがログに出力されていないか

**残存リスク**: ⚠️ 中
- セッション固定攻撃の考慮がない

**追加対策案**:
```typescript
// ログイン成功時に新しいセッションID発行
// 既存セッションを破棄してから新規作成
await db.query("DELETE FROM sessions WHERE admin_id = $1", [admin.id]);
const newSession = await createSession(admin.id);

// IPアドレス変更時の再認証
if (session.ip_address !== currentIP) {
  return Response.json({ error: "SESSION_IP_CHANGED", requireReauth: true });
}
```

---

### 1.3 パスワードリセット悪用

**攻撃**: パスワードリセット機能を悪用してアカウント奪取

**現状**: パスワードリセット機能が仕様に**未定義**

**残存リスク**: 🔴 未対策
- リセット機能がないと運用上困る
- 実装時にセキュリティホールになりやすい

**追加対策案**:
```typescript
// パスワードリセットフロー（追加が必要）
// 1. リセットリンク送信
POST /api/auth/forgot-password
{ "email": "admin@example.com" }

// 2. リンクからリセット
POST /api/auth/reset-password
{
  "token": "one-time-token", // 1時間有効
  "newPassword": "..."
}

// セキュリティ要件:
// - トークンは1回のみ有効
// - 1時間で期限切れ
// - 異なるIPからのリセットは追加確認
// - リセット後、全セッション無効化
```

---

## Attack Vector 2: データ抜き取り

### 2.1 SQLインジェクション

**攻撃**: 入力値に悪意のあるSQLを注入してDB全体を抜き取り

**現状の対策**: Bun.sqlパラメータ化クエリ

**残存リスク**: 🟢 低
- Bun.sqlを正しく使えば安全
- ただしテンプレートリテラルで直接結合すると危険

**確認事項**:
```typescript
// ✅ 安全
await db.query("SELECT * FROM donations WHERE id = $1", [donationId]);

// ❌ 危険（これを禁止するルールが必要）
await db.query(`SELECT * FROM donations WHERE id = '${donationId}'`);
```

---

### 2.2 IDOR (Insecure Direct Object Reference)

**攻撃**: 他人の寄付詳細を直接IDで取得

**例**: `GET /api/admin/donations/don_other_user`

**現状**: 管理者なら全寄付を見れる（仕様通り）

**残存リスク**: 🟢 低（仕様通り）
- ただし、公開APIで寄付詳細が見れると問題

**確認事項**:
```typescript
// 公開APIに寄付詳細がないことを確認
// /api/donations/:id が存在しないことを確認

// イベントの currentAmount は集計値のみ公開
// 個別の寄付者情報は管理者のみ
```

---

### 2.3 API経由の大量データ取得

**攻撃**: 管理者APIで全寄付者メールを一括取得

**現状**: ページネーションあり、Rate Limitあり

**残存リスク**: ⚠️ 中
- 正規の管理者が悪意を持った場合
- 管理者アカウント奪取後のデータ流出

**追加対策案**:
```typescript
// 1. CSVエクスポートに制限
const MAX_EXPORT_ROWS = 1000;
const EXPORT_COOLDOWN = 1 * 60 * 60 * 1000; // 1時間に1回

// 2. 監査ログで大量アクセスを検知
if (action === "donations.list" && limit > 100) {
  await alertAdmin("Large data access detected", { adminId, count: limit });
}

// 3. 寄付者メールの表示制限（viewer権限）
if (admin.role === "viewer") {
  donation.donorEmail = maskEmail(donation.donorEmail);
}
```

---

## Attack Vector 3: フィッシング

### 3.1 偽寄付ページ

**攻撃**: 本物そっくりの偽ページを作成し、決済情報を詐取

**現状の対策**: なし（外部攻撃なので直接防げない）

**残存リスク**: 🔴 高
- ドメイン偽装は防げない
- 寄付者教育が必要

**対策案**:
```typescript
// 1. 正規ドメインの明示（寄付確認メールに記載）
const email = `
  ご寄付ありがとうございます。

  ⚠️ 重要: 当サービスの正規URLは https://donate.example.com です。
  他のURLでの寄付は詐欺の可能性があります。
`;

// 2. 寄付ページにドメイン確認表示
<div class="security-notice">
  🔒 URLが https://donate.example.com であることを確認してください
</div>

// 3. QRコードに署名を埋め込む（高度）
// QRコードに検証可能な署名を含め、アプリで検証
```

---

### 3.2 埋め込みWidget乗っ取り

**攻撃**: WordPressサイトが侵害された場合、iframeのsrcを偽サイトに変更

**現状**: iframe許可ドメインを設定

**残存リスク**: ⚠️ 中
- 許可ドメイン自体が侵害されると防げない

**対策案**:
```typescript
// 1. SRI (Subresource Integrity) 的なアプローチ
// 親サイトに検証用スクリプトを配置
<script src="https://donate.example.com/verify.js"
        integrity="sha384-..."></script>

// 2. postMessage認証
// 埋め込み時にワンタイムトークンで認証
window.parent.postMessage({ type: "VERIFY", token: oneTimeToken }, "*");
```

---

### 3.3 メールなりすまし

**攻撃**: 寄付完了メールを偽装して偽リンクに誘導

**現状**: SPF/DKIM/DMARCの記載なし

**残存リスク**: 🔴 高
- メール認証なしだと偽装容易

**追加対策案**:
```markdown
## 運用ドキュメントに追加必須

### メール認証設定
- SPF: `v=spf1 include:_spf.resend.com ~all`
- DKIM: Resend提供のキーを設定
- DMARC: `v=DMARC1; p=reject; rua=mailto:dmarc@example.com`

### メール内容
- 送金依頼リンクは含めない
- パスワード変更リンクは含めない
- 確認のみの情報提供
```

---

## Attack Vector 4: 決済詐取

### 4.1 返金詐欺

**攻撃**: 寄付後にカード会社経由でチャージバック、寄付金を二重取り

**現状**: Stripeがチャージバック処理

**残存リスク**: ⚠️ 中
- 寄付は対価なしなのでチャージバック争議が難しい

**対策案**:
```typescript
// 1. チャージバック時の自動処理
// Stripe Webhook: dispute.created
if (event.type === "charge.dispute.created") {
  const donation = await findDonationByPaymentIntent(event.data.object.payment_intent);
  await markDonationDisputed(donation.id);
  await notifyAdmin("Chargeback received", donation);
}

// 2. 高額寄付の追加確認
if (amount > 50000) { // 5万円以上
  // 手動確認フラグ
  donation.requires_review = true;
}
```

---

### 4.2 二重決済攻撃

**攻撃**: ネットワーク遅延を利用して同じ寄付を2回処理

**現状の対策**: Idempotency Key

**残存リスク**: 🟢 低
- Stripe側で同じIdempotency Keyなら重複処理されない
- DB側でもstripe_session_idにユニーク制約

**確認事項**:
```typescript
// クライアント側でIdempotency Keyを生成し、リトライ時も同じキーを使用
const idempotencyKey = localStorage.getItem("current_donation_key")
  || crypto.randomUUID();
localStorage.setItem("current_donation_key", idempotencyKey);

// 決済完了後にキーをクリア
localStorage.removeItem("current_donation_key");
```

---

### 4.3 Webhook偽造

**攻撃**: 偽のWebhookを送信して決済完了を偽装

**現状の対策**: Stripe署名検証 + イベントID重複チェック

**残存リスク**: 🟢 低
- 署名検証が正しく実装されていれば安全

**確認事項**:
```typescript
// 署名検証を絶対にスキップしない
// 開発環境でも本番同様の検証を行う

// ❌ 危険なコード
if (process.env.NODE_ENV === "development") {
  // 署名検証スキップ
}

// ✅ 安全
// 開発環境でもStripe CLIでローカルWebhookをテスト
```

---

## Attack Vector 5: サービス妨害

### 5.1 DoS攻撃

**攻撃**: 大量リクエストでサービスを停止

**現状**: Rate Limiting

**残存リスク**: ⚠️ 中
- 分散攻撃には弱い
- アプリケーション層のRate Limitのみ

**対策案**:
```typescript
// 1. Cloudflare等のCDN/WAF導入（運用）
// アプリ到達前にブロック

// 2. 接続数制限（Bun.serve設定）
Bun.serve({
  maxRequestBodySize: 1024 * 1024, // 1MB
  // 同時接続数制限はリバースプロキシで
});

// 3. 重い処理の非同期化
// メール送信、QRコード生成はキューに入れる
```

---

### 5.2 リソース枯渇攻撃

**攻撃**: 大量のイベント作成、大量の寄付レコード作成

**現状**: Rate Limitingのみ

**残存リスク**: ⚠️ 中
- 管理者権限があれば大量のデータ作成可能
- DBストレージ枯渇

**対策案**:
```typescript
// 1. リソース上限設定
const LIMITS = {
  maxEventsPerMonth: 100,
  maxPriceOptionsPerEvent: 10,
  maxActiveSubscriptions: 10000,
};

// 2. ストレージ監視
// DBサイズが閾値を超えたらアラート
```

---

## 未対策・要追加項目まとめ

### 🔴 高優先度（実装必須）

| 項目 | 対策 |
|------|------|
| パスワードリセット機能 | 安全なリセットフロー実装 |
| メール認証（SPF/DKIM/DMARC） | 運用ドキュメントに追加 |
| セッション固定攻撃 | ログイン時に新セッション発行 |
| グローバルログイン防御 | 大量失敗時の全体遅延 |

### ⚠️ 中優先度（推奨）

| 項目 | 対策 |
|------|------|
| CAPTCHA | 3回失敗後に要求 |
| IPアドレス変更検知 | セッション中のIP変更で再認証 |
| 大量データアクセス検知 | 監査ログでアラート |
| viewer権限のメールマスク | 閲覧者には部分表示 |
| CDN/WAF | Cloudflare等の導入 |

### 🟢 低優先度（将来対応）

| 項目 | 対策 |
|------|------|
| QRコード署名 | 検証可能なQRコード |
| postMessage認証 | 埋め込みWidget追加認証 |
| 2FA（二要素認証） | 管理者ログイン強化 |

---

## 結論

現在の仕様は**基本的なセキュリティは対策済み**だが、以下が未対策:

1. **パスワードリセット機能が未定義** → 運用不可能
2. **メール認証（SPF/DKIM/DMARC）** → なりすまし容易
3. **セッション固定攻撃** → アカウント奪取リスク
4. **分散ブルートフォース** → 複数IPからの攻撃に弱い

これらを仕様に追加することを推奨。
