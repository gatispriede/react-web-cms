# Users

The **Users** pane (`/admin/system/users`) manages who can sign into the admin and what they can do.

## Ranks

A user has exactly one **rank**:

- **admin** — full access; can manage users, features, and infrastructure.
- **editor** — can author content, themes, translations, posts.
- **viewer** — read-only admin (review drafts, see analytics).
- **customer** — public-site account (e-commerce); no admin access.

Ranks set the floor. Specific mutations may also require **functional roles** (e.g. `translator`, `publisher`) and **per-resource grants** (see `grants.md`).

## Customer auth split

Customer accounts (e-commerce sign-ups) live in the same collection but never receive admin access. The split is enforced server-side: `kind: 'customer'` users fail the admin gate even if their rank is mistakenly elevated.

## Fields

- Email, display name, avatar.
- Rank, functional roles, grants.
- Last login, created at.
- Mode preference — `simplified` or `advanced` (controls which admin UI variant they see).

## Onboarding

The first user is created in the onboarding wizard with rank `admin`. Subsequent admins are added here. Self-service signup is **off** for admin ranks; customer signup is on when e-commerce is enabled.
