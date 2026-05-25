# SaaS Architecture Decisions

## ADR-001: SaaS-mode cloud sync is PHI-on

The embedded Sedation Pro workflow runs as a practice-facing clinical chart, not as an anonymous calculator. In SaaS mode, patient identifiers and the full sedation chart JSON are intentionally saved to PostgreSQL through the API with authorization, audit logs, and organization scoping.

Implementation notes:

- `patientAssessmentPayload()` uses `CLOUD_SYNC_CONTAINS_PHI = true` by design.
- `api.createCase()` and `api.updateCase()` also force `containsPhi: true` for SaaS Sedation Pro writes.
- The older anonymized/non-PHI behavior is not exposed from the embedded physician UI.
- If an anonymized demo or research mode is needed later, add it as a separate explicit workflow and endpoint. Do not silently toggle the production clinical chart into anonymized mode.

## ADR-002: The real physician app is embedded inside the SaaS shell

The SaaS app embeds the original mobile/physician Sedation Pro UI rather than maintaining a duplicate form. This keeps one clinical workflow, one set of clinical screens, and one store model.

Implications:

- `apps/saas` aliases `@` to `apps/mobile/src` so the original components/stores can run inside the SaaS shell.
- SaaS-specific cloud behavior is isolated in `apps/saas/src/sedation/*`.
- The embedded workflow must treat SQL as the source of truth for cases in SaaS mode.
- Local browser persistence may still exist in the original stores, but SaaS case create/update/delete operations must go through the API.
- Any future refactor should extract the physician UI into a package, for example `packages/physician-ui`, to remove cross-app aliasing.

## ADR-003: Cloud hydration validates JSON before mutating stores

`sedationAppJson` is untrusted once it leaves the browser and returns from SQL. Hydration validates the payload with Zod before mutating Pinia stores. Malformed records hydrate to a safe blank chart instead of partially corrupting clinical state.

The raw record remains visible on the case detail JSON screen for repair/debugging.
