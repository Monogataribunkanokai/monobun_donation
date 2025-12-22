# 寄付・送金サービス ユーザー調査レポート

## 目次

1. [調査概要](#調査概要)
2. [国内寄付サービスの口コミ分析](#国内寄付サービスの口コミ分析)
3. [海外寄付サービスの口コミ分析](#海外寄付サービスの口コミ分析)
4. [送金サービスの口コミ分析](#送金サービスの口コミ分析)
5. [決済プロバイダー（Stripe）の課題](#決済プロバイダーstripeの課題)
6. [UI/UX・アクセシビリティの課題](#uiuxアクセシビリティの課題)
7. [ユーザーが求めるもの](#ユーザーが求めるもの)
8. [まとめ：改善すべきポイント](#まとめ改善すべきポイント)

---

## 調査概要

### 調査対象サービス

| カテゴリ | サービス名 |
|---------|-----------|
| 国内クラウドファンディング | CAMPFIRE, READYFOR, Syncable |
| 海外寄付プラットフォーム | GoFundMe, Patreon, Ko-fi |
| 送金サービス | PayPay, LINE Pay |
| 決済プロバイダー | Stripe |

### 調査方法

- レビューサイト（みん評、Trustpilot、BBB）の口コミ分析
- SNS・コミュニティでのユーザーフィードバック
- 業界レポート・調査データの収集

---

## 国内寄付サービスの口コミ分析

### CAMPFIRE

**良い点 ✓**
- 500名以上からの支援を集めた成功事例が多数
- 目標金額の2.5倍以上を達成するプロジェクトも
- フットワークの軽さ、始めやすさ

**不満点 ✗**
- 「トラブルは当事者間で解決してください」というサポート姿勢への不満
- プロジェクト立案者と支援者間のトラブル対応が不十分
- 「あんしん保証は口だけ」という厳しい声

> 出典: [CAMPFIRE口コミ - みん評](https://minhyo.jp/camp-fire)

### READYFOR

**良い点 ✓**
- 社会貢献型で公益性・信頼性が高い
- 寄付控除が受けられる案件あり
- 法人・高所得者層からの支援が多い

**不満点 ✗**
- 審査が厳しく掲載までに時間がかかる
- 手数料が比較的高め

### Syncable

**良い点 ✓**
- 任意団体から法人まで幅広く対応
- クレジットカード、Amazon Pay対応
- マンスリー寄付にも対応

**不満点 ✗**
- 知名度が低く、支援者が集まりにくい

### 共通の課題

| 課題 | 詳細 |
|-----|------|
| 手数料の不透明さ | 9〜20%の手数料が「高い」という声 |
| サポート対応 | トラブル時の対応への不満が多い |
| プラットフォームロックイン | 一度使い始めると移行が困難 |

---

## 海外寄付サービスの口コミ分析

### GoFundMe

**評価**: ★1.6/5（490件のレビュー）、Trustpilot ★2.3/5

**良い点 ✓**
- 個人でも簡単に始められる
- 緊急の資金調達に適している

**不満点 ✗**
- 資金の引き出しに繰り返し情報を求められる
- カスタマーサポートへの連絡が困難
- 誤って定期寄付に登録してしまう問題
- 検証プロセスによる資金引き出しの遅延

> 出典: [GoFundMe BBB Complaints](https://www.bbb.org/us/ca/redwood-city/profile/crowdfunding/gofundme-1116-876254/complaints)

### Patreon

**評価**: Trustpilot ★1.2/5

**良い点 ✓**
- クリエイター向けの継続支援モデル
- ティア制で柔軟な支援設計が可能

**不満点 ✗**
- アカウントの突然の停止
- カスタマーサービスからの返信がない
- 料金改定の通知が不十分（8日前に通知なく値上げ）
- 有用な機能が高額プランに制限

> 出典: [Patreon Frustrations](https://www.patreon.com/posts/my-frustrations-104236684)

### Ko-fi

**評価**: 比較的良好

**良い点 ✓**
- 低手数料（0〜5%）
- チップ・寄付は手数料0%も可能
- シンプルで使いやすい

**不満点 ✗**
- 知名度が低く、自力での集客が必要
- Patreonほどの機能がない

> 出典: [Ko-fi vs GoFundMe比較](https://www.saashub.com/compare-ko-fi-vs-gofundme)

---

## 送金サービスの口コミ分析

### PayPay

**良い点 ✓**
- 加盟店数が多い
- キャンペーンが豊富

**不満点 ✗**
- 2024年導入の送金手数料への不満
- 「アプリの使い方が複雑になった」
- 初心者・高齢者から「チャージ方法が分からない」
- 送金には双方が本人確認済みである必要がある
- PayPayマネーライトは出金不可

> 出典: [PayPayをやめたほうがいい理由](https://t-1.co.jp/column/2025/10/17/reasons-to-quit-paypay-and-downsides/)

### LINE Pay

**良い点 ✓**
- LINEトーク画面から直接送金可能
- 銀行口座への振込も対応
- 割り勘機能が便利

**不満点 ✗**
- ポイント還元率が低い（0.5%）
- 利用できる店舗が少ない
- クレジットカード勧誘広告がしつこい

> 出典: [LINE Pay レビュー - mybest](https://my-best.com/products/187775)

---

## 決済プロバイダー（Stripe）の課題

### 最も多い不満

| 問題 | 影響 |
|-----|------|
| **突然のアカウント停止** | 説明なく資金が凍結される |
| **資金の長期保留** | 運転資金が枯渇し事業に支障 |
| **サポート対応の遅さ** | 問題解決までに長時間 |

> Trustpilotの1/3以上のレビューが「資金凍結とサポート不在」を報告

### チェックアウトUXの課題

- **18%** のカート放棄はフォームの長さ・複雑さが原因（Baymard Institute 2024）
- **73%** のモバイルユーザーが最適化されていないチェックアウトで離脱
- Apple Pay/Google Payボタンが表示されない技術的問題

### 改善効果

> チェックアウトUXの改善で**コンバージョン率が最大35%向上**する可能性

> 出典: [Stripe Checkout UI設計](https://stripe.com/resources/more/checkout-ui-strategies-for-faster-and-more-intuitive-transactions)

---

## UI/UX・アクセシビリティの課題

### 高齢者・ITリテラシーが低い層の課題

**視覚的な問題**
- フォントサイズを大きくするだけでは不十分
- コントラスト感度の低下への対応が必要
- 周辺視野のぼやけへの配慮

**操作上の問題**
- 小さなタップターゲット（最低11mm必要）
- スクロールバーの操作困難
- 横スワイプへの不慣れ
- 無意識のタップによる誤操作

**認知上の問題**
- 「ハンバーガーメニュー」「共有アイコン」が理解されない
- 専門用語（CAPTCHA、アップロード等）への困惑

> 出典: [高齢者ユーザーのためのUXデザイン](https://uxmilk.jp/68303)

### フォーム離脱率の現状

| 指標 | 数値 |
|-----|------|
| 一般的なフォーム離脱率 | 40〜70% |
| 対策なしのフォーム | 約60%が離脱 |
| 電話番号必須の場合 | 37%以上が離脱 |

> 出典: [EFOとは - keywordmap](https://keywordmap.jp/academy/what-is-efo/)

### 定期寄付のキャンセル問題

**ユーザーの声**
> 「数年間寄付していて、選挙後に止まると思っていたが止まらなかった。3ヶ月前に電話で止めたのに、また$55請求された」

**FTC「Click to Cancel」規則（2024年）**
- 登録と同じ方法でキャンセルできなければならない
- オンライン登録→オンラインでキャンセル可能に
- キャンセル手順は簡単で見つけやすくする必要あり

> 出典: [Click to Cancel規制](https://www.doinggoodagency.com/click-to-cancel-new-regulations-for-your-recurring-gift-program/)

---

## ユーザーが求めるもの

### 透明性への期待

| 要素 | ユーザーの反応 |
|-----|---------------|
| 透明性・説明責任への信頼 | 91%が「支援しやすくなる」|
| 財務状況の明確な開示 | 86%が「寄付しやすくなる」|
| 正直なコミュニケーション | ドナー維持率が22%向上 |

> 出典: [Nonprofit Transparency - Donorbox](https://donorbox.org/nonprofit-blog/nonprofit-transparency)

### 成功事例：Charity: Water

- 運営費は別の寄付者がカバー
- 公開寄付の**100%がプロジェクトに直接使用**
- リアルタイムで進捗を公開
- **累計$500M以上を調達**

### コンバージョン最適化のベストプラクティス

| 施策 | 効果 |
|-----|------|
| デジタルウォレット対応 | チェックアウト時間が4倍高速化 |
| 大きなボタンでの金額選択 | ドロップダウンより高いCVR |
| インパクトの可視化 | 寄付額の増加 |
| ステップ表示 | 入力完了率が55%改善 |
| マルチステップフォーム | CVR 22.6%（業界平均17%） |

> 出典: [Donation Page Conversion Tips - Donorbox](https://donorbox.org/nonprofit-blog/5-tips-improve-donation-page-conversion-rates)

---

## まとめ：改善すべきポイント

### 信頼性・透明性

| 課題 | 対策 |
|-----|------|
| 手数料が不透明 | 事前に明確に表示、計算例を提示 |
| 寄付金の使途が不明 | リアルタイムの進捗表示、使途報告 |
| サポート対応への不信 | 迅速なサポート、FAQ充実 |

### ユーザー体験

| 課題 | 対策 |
|-----|------|
| フォームが長い・複雑 | 最小限の入力項目、ステップ表示 |
| モバイル最適化不足 | タッチフレンドリー、大きなボタン |
| 定期寄付のキャンセルが困難 | ワンクリックキャンセル、セルフサービスポータル |
| 高齢者への配慮不足 | 大きな文字、高コントラスト、アイコン+文字 |

### 決済・技術

| 課題 | 対策 |
|-----|------|
| 決済方法が限定的 | 複数の決済手段（カード、ウォレット、銀行） |
| 資金凍結リスク | 信頼性の高い決済プロバイダー選定 |
| Apple Pay等が動作しない | 徹底したテスト、フォールバック用意 |

### 差別化ポイント

1. **手数料の透明性**: 他サービスより明確に
2. **簡単なキャンセル**: FTC規則に先行対応
3. **アクセシビリティ**: 高齢者・障害者に配慮
4. **リアルタイム透明性**: 寄付金の使途を可視化
5. **優れたサポート**: 迅速・親切な対応

---

## 参考リンク

### 国内サービス
- [CAMPFIRE口コミ - みん評](https://minhyo.jp/camp-fire)
- [クラウドファンディング手数料比較 - gooddo](https://gooddo.jp/magazine/donation/22811/)
- [PayPayレビュー - mybest](https://my-best.com/products/187774)
- [LINE Payレビュー - mybest](https://my-best.com/products/187775)

### 海外サービス
- [GoFundMe BBB Complaints](https://www.bbb.org/us/ca/redwood-city/profile/crowdfunding/gofundme-1116-876254/complaints)
- [Patreon Frustrations](https://www.patreon.com/posts/my-frustrations-104236684)
- [Ko-fi vs GoFundMe比較](https://www.saashub.com/compare-ko-fi-vs-gofundme)

### UX/アクセシビリティ
- [高齢者のユーザビリティ - u-site](https://u-site.jp/alertbox/usability-for-senior-citizens)
- [高齢者ユーザーのためのUXデザイン - UX MILK](https://uxmilk.jp/68303)
- [EFOとは - keywordmap](https://keywordmap.jp/academy/what-is-efo/)

### 決済・コンバージョン
- [Stripe Checkout UI設計](https://stripe.com/resources/more/checkout-ui-strategies-for-faster-and-more-intuitive-transactions)
- [Donation Page Conversion Tips - Donorbox](https://donorbox.org/nonprofit-blog/5-tips-improve-donation-page-conversion-rates)
- [Nonprofit Transparency - Donorbox](https://donorbox.org/nonprofit-blog/nonprofit-transparency)

### 規制
- [Click to Cancel規制 - Doing Good Agency](https://www.doinggoodagency.com/click-to-cancel-new-regulations-for-your-recurring-gift-program/)
