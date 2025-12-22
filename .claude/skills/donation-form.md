# Donation Form Design Skill

寄付フォームのUI/UXデザインパターンを適用するスキル。

## 適用タイミング

- 寄付フォームのUI作成時
- チェックアウトフロー設計時
- 金額選択UI実装時

## 必須パターン

### 1. ステップ表示（離脱率55%改善）

```
① 金額選択 ─── ② お支払い ─── ③ 完了
     ●              ○              ○
```

- ステップ数は3以下
- 残り時間目安表示（「約1分」）

### 2. 金額ボタン（ドロップダウン禁止）

```tsx
<AmountButton amount={1000} impact="子ども1人の1週間分の食事" />
<AmountButton amount={3000} impact="学用品1人分" popular />
```

- 最小48x48px
- インパクト表示付き
- カスタム金額も用意

### 3. 手数料透明表示

```
寄付金額          ¥10,000
決済手数料(3.6%)   - ¥360
実際に届く金額    ¥9,640

☐ 手数料も負担する (+¥360)
```

### 4. デジタルウォレット優先

```tsx
// Apple Pay/Google Payを上に配置（4倍高速）
<ApplePayButton />
<GooglePayButton />
<Divider text="または" />
<CreditCardForm />
```

## CSS仕様

```css
--primary: #2563EB;
--success: #22C55E;
--error: #EF4444;

button { min-height: 48px; min-width: 48px; }
input { height: 48px; font-size: 16px; }
```

## バリデーション

- インラインリアルタイム検証
- エラーは該当フィールド直下に表示
- 成功時は✅アイコン

## 参照

- [デザインパターン詳細](../../docs/DESIGN_PATTERNS.md)
- [調査レポート](../../docs/DONATION_SERVICE_RESEARCH.md)
