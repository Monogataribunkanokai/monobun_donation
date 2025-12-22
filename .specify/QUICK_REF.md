# Quick Reference (圧縮版)

## Tech Stack
```
Runtime: Bun | DB: PostgreSQL(Bun.sql) | Payment: Stripe | Auth: Argon2id+JWT
```

## 寄付タイプ
| Type | 返金 | 手数料 |
|------|-----|--------|
| one-time | × | 3.6% |
| monthly/yearly | 7日以内○ | 3.6%+0.7% |
| event | × | 3.6% |

## API (主要)
```
POST /api/donations          寄付作成(公開)
POST /api/subscriptions      サブスク作成(公開)
POST /api/auth/login         ログイン
GET  /api/admin/donations    一覧(認証必須)
POST /api/webhooks/stripe    Webhook
```

## Rate Limits
```
login: 5/15min | donations: 10/min | admin: 120/min
```

## Security Checklist
- [ ] Argon2id(memoryCost:65536,timeCost:3)
- [ ] CSRF: SameSite=Strict + X-CSRF-Token
- [ ] Rate Limit全API
- [ ] Stripe Idempotency Key
- [ ] Webhook署名検証
- [ ] IP制限(信頼プロキシ考慮)
- [ ] 入力Zodバリデーション

## DB Tables
```sql
admins(id,email,password_hash,role,must_change_password)
donations(id,type,amount,donor_email,status,stripe_session_id)
subscriptions(id,donor_email,amount,interval,stripe_subscription_id)
events(id,name,goal_amount,price_options,status)
sessions(id,admin_id,token,expires_at,ip_address)
audit_logs(id,admin_id,action,target_type,target_id)
```

## File Structure
```
src/
  routes/     API
  lib/        db,stripe,auth,mail
  middleware/ auth,rate-limit,security
  types/      型定義
```

## 詳細参照
- 仕様: .specify/specs/*.spec.md
- 設計: docs/DESIGN_PATTERNS.md
- 調査: docs/DONATION_SERVICE_RESEARCH.md
