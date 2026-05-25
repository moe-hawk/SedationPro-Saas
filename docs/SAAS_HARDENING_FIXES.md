# SaaS hardening fixes implemented

This build applies the requested pre-production hardening fixes.

## Security and data integrity

- `assessmentJson` is scrubbed server-side when `containsPhi=false`; `patientName`, `patientId`, `careName`, and `carePhone` are removed before persistence.
- JWT cookies now have an 8-hour expiry via `JWT_EXPIRES_IN` and `/auth/refresh` can issue a fresh session cookie.
- Session cookie `secure` is now tied to production mode.
- Route-level role guards are enforced:
  - case read/list: any organization member
  - case create/update: `OWNER`, `ADMIN`, `PROVIDER`, `STAFF`
  - case lock: `OWNER`, `ADMIN`, `PROVIDER`
  - audit logs: `OWNER`, `ADMIN`
  - billing checkout: `OWNER`
- Dev login now requires `ENABLE_DEV_LOGIN=true` and remains disabled in production.

## Correctness

- Dosing percentage severity now uses `safe < 70`, `caution 70–99`, and `limit >= 100`.
- Discharge SpO₂ logic uses the clinical classifier as the single source of truth, with 95% documented as the first safe tier.
- Cases are linked to the organization default `FormularyProfile` at creation/update.

## Infrastructure

- API rate limiting is registered globally, with a stricter limit on `/auth/dev-login`.
- Case listing now supports cursor pagination with `limit` and `cursor` query parameters.
- CI install commands were changed to `pnpm install --frozen-lockfile`.

## Notes

Because the build environment did not have npm registry access, regenerate and commit `pnpm-lock.yaml` after running `pnpm install` in your local environment.
