# Firebase Google Authentication

Sedation Pro Cloud supports Firebase Google sign-in as the production authentication path. The development login remains available only when `ENABLE_DEV_LOGIN=true` and `NODE_ENV` is not `production`.

## API environment

Set these on the API service:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The API verifies the Firebase ID token with revocation checking enabled, links the user by Firebase UID with verified-email fallback for pre-existing accounts, creates a default organization for first-time users, and then issues the existing HTTP-only `sedation_pro_session` cookie.

## SaaS web environment

Set these on the SaaS frontend build:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

When all four frontend values are present, the login page shows **Continue with Google**. If they are blank, only the local development login is shown. In production builds with Firebase configured, the development email form is hidden unless explicitly enabled for local development.

## Production notes

- Disable `ENABLE_DEV_LOGIN` outside local development.
- Use HTTPS so the API sends the session cookie with `secure: true` in production.
- Treat Firebase as the identity provider only; practice membership and role authorization remain enforced by the SaaS API database.

## Secret-management note

`FIREBASE_PRIVATE_KEY` is the highest-value identity secret in this stack. Do not store it in source control, `.env` files committed to a repo, CI logs, or shared tickets. For staging and production, load it from a managed secret store such as GCP Secret Manager, AWS Secrets Manager, Doppler, 1Password Secrets Automation, or the hosting provider's encrypted secret facility. Keep the existing `replace(/\n/g, '\n')` formatting support for platforms that store multi-line private keys as escaped newline strings.
