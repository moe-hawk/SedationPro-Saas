# Sedation Pro SaaS migration

This branch keeps the original mobile app intact and adds a cloud SaaS layer around the existing monorepo.

## What changed

```text
apps/mobile/             Existing Vue/Vite/Capacitor app. Preserved.
packages/clinical/       Existing pure TypeScript clinical engine. Reused by SaaS API and SaaS web.
packages/ui/             Existing Vue UI primitives and design tokens. Reused by SaaS web.
packages/db/             New Prisma/PostgreSQL data model.
apps/api/                New Fastify API for auth, tenancy, cases, audit logs, and billing.
apps/saas/               New Vue SaaS dashboard for clinic users.
docker-compose.yml       Local PostgreSQL for development.
.env.example             Local API, web, database, and Stripe configuration.
```

## Design principle

The original app remains the clinical workflow source. The SaaS layer adds:

- organization tenancy
- user membership roles
- cloud case records
- versioned clinical snapshots
- audit logs
- billing hooks
- future custom formulary profiles

The SaaS app does **not** replace the clinical engine. It imports `@sedation-pro/clinical` and stores the clinical engine version with every case.

## Run locally

```sh
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev:api
pnpm dev:saas
```

Open the SaaS dashboard at:

```text
http://localhost:5174
```

The API runs at:

```text
http://localhost:4000
```

## Development login

`apps/api` includes `/auth/dev-login` for local development. It creates:

- a user
- an organization
- an OWNER membership
- a demo subscription
- a default formulary profile using `DEFAULT_FORMULARY`

This endpoint is disabled when `NODE_ENV=production`.

Before production launch, replace dev login with a production identity provider such as:

- Auth0
- Clerk
- AWS Cognito
- Azure AD / Entra ID B2B
- Supabase Auth, if the whole stack moves to Supabase

## Case storage model

`SedationCase` stores:

- organization ID
- creator ID
- PHI mode flag
- optional patient identifiers
- assessment JSON
- clinical snapshot JSON
- clinical engine version
- lock/archive state

When `containsPhi` is false, patient name, patient ID, caregiver name, and caregiver phone are not copied into first-class database fields. The assessment payload can still contain those fields unless production code strips them before save. For a stricter no-PHI mode, add a server-side scrubber before persisting `assessmentJson`.

## Billing

Billing is wired as a Stripe scaffold:

- `POST /organizations/:organizationId/billing/checkout`
- `POST /webhooks/stripe`
- `Subscription` Prisma model

Leave Stripe environment variables blank for demo billing mode. Add `STRIPE_SECRET_KEY`, price IDs, and webhook secret to enable real checkout.

## Next implementation steps

1. Replace dev login with real auth.
2. Add invite/user-management flows.
3. Add strict server-side PHI scrubbing for no-PHI organizations.
4. Add PDF generation for case snapshots and clinical notes.
5. Decide whether SaaS stores ePHI. If yes, complete HIPAA controls before production.
6. Add production Stripe webhook raw-body tests.
7. Add end-to-end tests for tenant isolation.
8. Add role-based authorization checks beyond membership existence.
9. Add custom formulary management UI backed by `FormularyProfile`.
10. Add deployment manifests for the selected cloud provider.
