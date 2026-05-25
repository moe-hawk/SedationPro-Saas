# Security and compliance notes

Sedation Pro is sedation-related clinical software. Treat the SaaS version as healthcare-adjacent from the beginning, even during MVP work.

## Current status

This code is a SaaS scaffold, not a production clinical system.

It includes:

- organization-scoped data model
- membership roles
- audit-log table
- clinical engine version capture
- local dev authentication
- billing scaffold

It does not yet include:

- production authentication
- SSO
- MFA enforcement
- backup/restore policy
- full HIPAA policies and procedures
- BAA-backed hosting configuration
- formal threat model
- FDA/CDS legal review
- penetration test
- production incident response process

## PHI decision

You need one explicit product decision before launch:

```text
Option A: No-PHI SaaS
  Store only anonymized cases and locally generated exports.

Option B: PHI SaaS
  Store patient identifiers and full case history in the cloud.
```

Option A is simpler. Option B may be more valuable, but requires HIPAA-grade operational controls and BAAs with relevant vendors.

## Minimum production controls

Before storing ePHI:

- use a cloud provider willing to sign a BAA
- use managed PostgreSQL with encryption at rest
- enforce TLS everywhere
- use production auth with MFA support
- implement least-privilege roles
- keep immutable audit logs or forward logs to an append-only target
- rotate secrets through a secret manager
- run dependency scanning and vulnerability management
- define backup retention and restore testing
- document breach/incident response process
- log all case views, exports, edits, and role changes
- verify tenant isolation through tests

## Clinical/regulatory controls

Before marketing as clinical decision support:

- document intended use
- document what the app does not do
- keep clinical formula/rule versioning
- add clinical references for every engine rule
- have a qualified sedation/anesthesia reviewer sign off
- review whether features fall under FDA clinical decision support guidance
- avoid claims that the software replaces provider judgment

## Safer MVP language

Use language like:

> Sedation workflow documentation and readiness tracking for trained clinicians.

Avoid language like:

> Automated sedation dosing recommendation engine.

## Audit log events to expand

The scaffold currently logs core events. Add more before production:

- login success/failure
- logout
- password/MFA changes
- user invite accepted
- role changed
- case exported
- case printed
- formulary changed
- billing plan changed
- API token created/revoked
