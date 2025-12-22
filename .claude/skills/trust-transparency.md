# Trust & Transparency Skill

信頼性・透明性を構築するUIパターンを適用するスキル。

## 適用タイミング

- 寄付進捗表示時
- 決済画面設計時
- サブスク管理画面作成時

## 統計（重要）

- 91%: 透明性のある組織を支援したい
- 86%: 財務状況が明確だと寄付しやすい
- 22%: 正直なコミュニケーションでドナー維持率向上

## 必須パターン

### 1. 進捗サーモメーター

```tsx
<ProgressBar
  current={340000}
  goal={500000}
  donors={128}
  daysLeft={14}
/>
// 表示: ████████████░░░░░ 68% 達成
```

- リアルタイム更新（WebSocket）
- 支援者数表示（社会的証明）

### 2. 使途報告

```tsx
<UsageChart data={[
  { label: '教育支援', percent: 60, icon: '📚' },
  { label: '住居支援', percent: 25, icon: '🏠' },
  { label: '食料支援', percent: 10, icon: '🍙' },
  { label: '運営費', percent: 5, icon: '⚙️' },
]} />
```

### 3. セキュリティバッジ

```tsx
<SecurityBadges>
  <Badge icon="🔒" label="SSL暗号化" />
  <Badge icon="💳" label="Stripe" />
  <Badge icon="✅" label="PCI DSS準拠" />
</SecurityBadges>
<Note>カード情報は当サイトには保存されません</Note>
```

### 4. サポート常時表示

```tsx
<SupportPanel>
  💬 お困りですか？
  📧 support@example.com
  📞 0120-XXX-XXX
  平均応答時間: 30分以内
</SupportPanel>
```

### 5. ワンクリックキャンセル（FTC規制対応）

```tsx
// 登録と同じ方法でキャンセル可能にする
<SubscriptionManager>
  <Button variant="secondary">金額変更</Button>
  <Button variant="secondary">一時停止</Button>
  <Button variant="danger">キャンセル</Button>
</SubscriptionManager>
```

## 成功事例: Charity: Water

- 100%の寄付がプロジェクトへ（運営費は別寄付者負担）
- リアルタイム進捗公開
- 累計$500M以上調達

## 参照

- [デザインパターン詳細](../../docs/DESIGN_PATTERNS.md)
- [調査レポート](../../docs/DONATION_SERVICE_RESEARCH.md)
