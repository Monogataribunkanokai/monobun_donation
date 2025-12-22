# Monobun Donation

Bun製セルフホスト型寄付システム。Stripe統合。

## Quick Reference

```
Tech: Bun + PostgreSQL(Bun.sql) + Stripe | Auth: Argon2id+JWT
API: /api/donations, /api/subscriptions, /api/admin/*
Fee: 3.6%(card/paypay), +0.7%(subscription)
```

詳細→ `.specify/QUICK_REF.md`

## Skills (UI作成時に参照)

| Skill | 用途 |
|-------|------|
| `.claude/skills/donation-form.md` | 寄付フォームUI |
| `.claude/skills/accessibility.md` | アクセシビリティ |
| `.claude/skills/trust-transparency.md` | 信頼性・透明性 |

## Spec Commands

| Command | 用途 |
|---------|------|
| `/speckit.constitution` | プロジェクト原則 |
| `/speckit.specify` | 機能仕様作成 |
| `/speckit.plan` | 技術計画 |
| `/speckit.tasks` | タスク分解 |
| `/speckit.implement` | 実装 |

## Dev Flow

1. Specify → 2. Test → 3. Implement → 4. `bun test`

## Structure

```
.specify/QUICK_REF.md        # 圧縮リファレンス
.specify/specs/              # 詳細仕様
.claude/skills/              # UIスキル
docs/DESIGN_PATTERNS.md      # デザインパターン詳細
docs/DESIGN_PATTERNS_COMPACT.md  # 圧縮版
src/                         # ソースコード
```

## Bun Rules


- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
