# SaaS rebuild diff summary

## Added

- `apps/saas` — Vue SaaS dashboard built on the same stack as the original app.
- `apps/api` — Fastify API for development auth, tenants, cases, audit logs, billing, and Stripe webhooks.
- `packages/db` — Prisma schema and exported Prisma client.
- `docker-compose.yml` — local PostgreSQL service.
- `.env.example` — local SaaS/API/database/Stripe variables.
- `docs/SAAS_MIGRATION.md` — architecture and migration guide.
- `docs/SAAS_DEPLOYMENT.md` — deployment notes.
- `docs/SECURITY_AND_COMPLIANCE.md` — healthcare SaaS controls.

## Preserved

- `apps/mobile`
- `packages/clinical`
- `packages/ui`
- `packages/persistence`
- `tools/legacy-source`
- existing roadmap and development docs

## Root script changes

- `dev:mobile`
- `dev:saas`
- `dev:api`
- `dev:cloud`
- `build:mobile`
- `build:saas`
- `db:generate`
- `db:push`
- `db:migrate`
- `db:studio`

## Important caveat

The new SaaS code is a starter implementation. It is suitable for local development and architecture iteration. It is not yet production-ready for ePHI or regulated clinical decision support.
