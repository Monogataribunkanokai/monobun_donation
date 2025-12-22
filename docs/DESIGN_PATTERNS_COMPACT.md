# Design Patterns (Compact)

圧縮版デザインパターン。詳細→DESIGN_PATTERNS.md

## Core Stats
```
離脱率: 60-70%(未対策) → 40%(対策後)
透明性で支援意向: 91%
ステップ表示効果: +55%完了率
デジタルウォレット: 4x高速
```

## Must-Have Patterns

### 1. ステップフォーム
```
① 金額 ─── ② 支払 ─── ③ 完了
    ●          ○          ○
「あと1分で完了」
```

### 2. 金額ボタン (not dropdown)
```tsx
<Btn amount={1000} impact="子ども1人/1週間の食事" />
<Btn amount={3000} impact="学用品1人分" popular />
// 最小48x48px
```

### 3. 手数料透明
```
¥10,000 - ¥360(3.6%) = ¥9,640届く
☐ 手数料負担(+¥360)
```

### 4. 決済順序
```
1. Apple Pay / Google Pay (優先)
2. ───または───
3. クレジットカード
```

### 5. キャンセル (FTC対応)
```tsx
<Btn>金額変更</Btn>
<Btn>一時停止</Btn>  // 3ヶ月まで
<Btn>キャンセル</Btn> // 1クリック
```

## Accessibility (A11y)

| Item | Spec |
|------|------|
| Font | ≥16px |
| Contrast | ≥4.5:1 |
| Tap | ≥48x48px |
| Gap | ≥8px |

```tsx
// アイコン+テキスト必須
<Btn><Icon/>メニュー</Btn>
// 電話サポート表示
📞 0120-XXX-XXX
```

## Trust Elements

```tsx
<ProgressBar current={340000} goal={500000} />
// ████████░░░ 68%

<SecurityBadges>
  🔒SSL | 💳Stripe | ✅PCI-DSS
</SecurityBadges>

<Support avgResponse="30分" />
```

## CSS Tokens
```css
--primary: #2563EB;
--success: #22C55E;
--error: #EF4444;
--min-touch: 48px;
--min-font: 16px;
```

## Validation
```tsx
// インライン即時
<Input error="残り1桁" />  // not 送信後エラー
```

## 完了画面
```
✨ ありがとうございます！
¥3,000で子ども3人に食事を届けられます
📧 確認メール送信済
[SNSシェア] [ホーム]
```
