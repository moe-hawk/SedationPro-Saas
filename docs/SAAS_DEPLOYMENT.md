# SaaS deployment sketch

## Recommended cloud layout

```text
Frontend: apps/saas on Vercel, Netlify, Cloudflare Pages, or S3/CloudFront
API:      apps/api on Render, Fly.io, ECS, Cloud Run, Azure App Service, or Kubernetes
DB:       Managed PostgreSQL
Billing:  Stripe
Auth:     Auth0, Clerk, Cognito, Entra ID, or another production identity provider
Logs:     Sentry + cloud logs + security log retention
```

## Local development

```sh
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev:api
pnpm dev:saas
```

## Production environment variables

At minimum:

```text
DATABASE_URL
JWT_SECRET or production auth provider secrets
SAAS_WEB_ORIGIN
API_PUBLIC_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_SOLO
STRIPE_PRICE_CLINIC
STRIPE_SUCCESS_URL
STRIPE_CANCEL_URL
```

## Lockfile note

This ZIP adds new workspaces and dependencies. Because the generation environment had no registry access, run `pnpm install` once to refresh `pnpm-lock.yaml`. After the lockfile is regenerated and committed, switch CI back to `pnpm install --frozen-lockfile`.
