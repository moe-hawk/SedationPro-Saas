# Cloud case source of truth

This build makes the SaaS SQL database the source of truth for Sedation Pro cases.

## Implemented behavior

- The embedded Sedation Pro interface can create, reopen, edit, save, and delete cloud cases.
- Reopening a case loads the existing SQL record and updates that same `caseId`; it does not create a duplicate.
- Local-only persistence is disabled in SaaS mode through `__SEDATION_PRO_CLOUD_ONLY__`.
- The original local reset/new-case action is intercepted and converted into a cloud new-case request.
- Patient identifiers are saved in first-class case columns and in the full `sedationAppJson` payload.
- `sedationAppJson` stores all major Sedation Pro phase state: Phase 1 assessment, local anesthetic, IV sedation, recovery/discharge, event log, and current phase.
- Case detail shows the full Sedation Pro JSON and the derived clinical snapshot JSON.

## Database change

`SedationCase` now includes:

```prisma
sedationAppJson Json @default("{}")
```

Run after pulling this version:

```bash
pnpm db:generate
pnpm db:push
```

## Routes

- `/sedation` starts the cloud-backed Sedation Pro interface.
- `/phase/1?caseId=<id>` opens an existing case in edit mode.
- `/cases/<id>` reviews the SQL record and full JSON.
