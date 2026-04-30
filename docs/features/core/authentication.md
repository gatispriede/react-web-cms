# Authentication

## Overview

Authentication uses **NextAuth** with a `CredentialsProvider` and **JWT strategy** (no database sessions). All admin routes require a valid session; the public site is unauthenticated.

## Login flow

1. User submits email + password to `/api/auth/[...nextauth]`.
2. `CredentialsProvider` calls `UserService.validateCredentials` — bcrypt compare against stored hash.
3. On success, NextAuth issues a signed JWT containing `{id, email, role, canPublishProduction, mustChangePassword}`.
4. The JWT is stored in an HTTP-only cookie and verified on each admin request by the `authz` Proxy.

## Roles

| Role | Level |
|---|---|
| `viewer` | Read-only |
| `editor` | Content edits, no publish |
| `admin` | Full access |

The `authz` Proxy wraps `MongoDBConnection` and gates every mutation by role, injecting the session for audit stamping (`editedBy`). See [`../architecture/auth-roles.md`](../architecture/auth-roles.md) for the full model.

## First-boot admin password

On first boot, if no `ADMIN_DEFAULT_PASSWORD` or `ADMIN_PASSWORD_HASH` env var is set:

1. `setupAdmin` generates a 24-char URL-safe random password via `crypto.randomBytes(18).toString('base64url')`.
2. The plain value is bcrypt-hashed immediately; it is never re-read from disk.
3. The plain password is written once to `var/admin-initial-password.txt` (mode 0600) and printed to the console on interactive boot.
4. The seeded user gets `mustChangePassword: true`, which renders a persistent red banner in the admin until the password is changed.
5. Changing the password refreshes the JWT session so the banner clears immediately.

## Password change

After changing their own password, the session JWT is refreshed server-side to clear `mustChangePassword` without requiring a re-login.

## Production hardening

For MongoDB auth setup (adding a password to the MongoDB instance), see [`../../roadmap/production/mongodb-auth.md`](../../roadmap/production/mongodb-auth.md).
