# Project Constitution

## Project Overview

Monobun Donation - Bun製のセルフホスト型寄付管理システム。
Stripe統合による決済処理、管理画面、WordPress埋め込みに対応。

## Core Principles

1. **Usage-First Development**: 使用例を先に書く
2. **Spec-Driven Design**: 仕様を先に定義
3. **Test-First Approach**: テストで振る舞いを定義
4. **Simple & Minimal**: 最小限の実装
5. **Bun-Native**: Bunのネイティブ機能を活用
6. **Security-First**: セキュリティを優先

## Technology Stack

| レイヤー | 技術 |
|---------|------|
| Runtime | Bun |
| Language | TypeScript (strict) |
| Server | Bun.serve() |
| Database | PostgreSQL (Bun.sql) |
| Payment | Stripe (クレカ, PayPay, 銀行振込) |
| Testing | bun:test |
| Frontend | HTML imports + TypeScript |

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                 Monobun Donation                │
├─────────────────────────────────────────────────┤
│  管理画面 /admin  │  埋め込み /embed  │  寄付 /donate │
├─────────────────────────────────────────────────┤
│                   REST API /api                 │
├─────────────────────────────────────────────────┤
│  PostgreSQL  │  Stripe  │  Mail Service         │
└─────────────────────────────────────────────────┘
```

## Key Features

### 寄付タイプ
- 単発寄付（返金不可）
- 月額サブスク（7日以内返金可、解約可）
- 年額サブスク（7日以内返金可、解約可）
- イベント寄付（固定価格オプション対応）

### 決済
- Stripe統合（クレカ3.6%、PayPay3.6%、銀行振込1.5%）
- サブスクはStripe Billing（+0.7%）

### 認証・認可
- メール+パスワード+IP制限
- 権限: viewer / editor

### 通知
- 管理者メール
- 寄付者メール
- Webhook

### 埋め込み
- iframe方式（セキュリティ重視）
- スタイルカスタマイズ可能（色、背景画像等）
- QRコード自動生成

### デプロイ
- セルフホスト
- Docker対応

## Development Workflow

1. **Specify**: `/speckit.specify` で仕様定義
2. **Plan**: `/speckit.plan` で技術計画
3. **Tasks**: `/speckit.tasks` でタスク分解
4. **Implement**: `/speckit.implement` で実装

## Code Standards

- TypeScript strict mode
- 関数は小さく、単一責任
- エラーハンドリングを明確に
- セキュリティ: XSS, CSRF, SQLi対策

## File Structure

```
src/
  api/          # REST API routes
  admin/        # 管理画面
  embed/        # 埋め込みWidget
  donate/       # 寄付ページ
  lib/
    db.ts       # PostgreSQL接続
    stripe.ts   # Stripe連携
    mail.ts     # メール送信
    auth.ts     # 認証
  types/        # 型定義
```

## Specifications

詳細仕様は `.specify/specs/` を参照:
- `system-overview.spec.md` - システム全体
- `api.spec.md` - REST API
- `admin.spec.md` - 管理画面
- `embed-widget.spec.md` - 埋め込み・寄付ページ
