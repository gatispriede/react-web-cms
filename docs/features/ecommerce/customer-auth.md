# Customer Authentication

## Overview

Adds a **second, distinct authentication surface** for end-customers of the e-commerce
storefront, alongside the existing admin auth (NextAuth + JWT, see
[`authentication.md`](./authentication.md) and [`../architecture/auth-roles.md`](../architecture/auth-roles.md)).
Customers sign in/up on the public site (`ui/client/pages/account/*`); admin staff
continue to sign in at `/auth/signin` and operate `ui/admin`. The two session
populations must not collide — an admin cookie must not authorise a customer-only
mutation, and a customer cookie must never satisfy any admin role check.

The new role is **purely additive**: `viewer | editor | admin` is preserved verbatim,
and a new top-level discriminator `kind: 'admin' | 'customer'` selects which
permission table the `authz` Proxy consults.

## 1. Data model

**Recommendation: extend the existing `Users` collection with a `kind` discriminator.**

- One collection, one `email` uniqueness constraint, one `UserService` shape — mirrors
  the existing module exactly (constraint from the brief).
- The existing `role: UserRole` field stays admin-only (`viewer | editor | admin`)
  and is **ignored** when `kind === 'customer'`. Customers always carry
  `kind: 'customer'` and `role: undefined`.
- All existing rows are implicitly `kind: 'admin'` — `UserService.setupAdmin` and
  `addUser` continue to default to admin; a one-shot migration in
  `setupAdmin()` back-fills `kind: 'admin'` on legacy docs the same way it
  back-fills `role: 'admin'` today (see `UserService.ts:36-39`).
- Customers never receive `canPublishProduction` / `mustChangePassword` /
  `preferredAdminLocale` — those remain admin-only fields.

### `shared/types/IUser.ts` additions

```ts
export type UserKind = 'admin' | 'customer';

export interface IUser {
  // existing fields …
  kind?: UserKind;          // undefined ≡ 'admin' for back-compat
  // Customer-only:
  googleSub?: string;       // Google OAuth `sub` for social link
  emailVerified?: string;   // ISO date; set on Google sign-in or post-confirm
  phone?: string;
  shippingAddresses?: IAddress[];
  createdAt?: string;
}
```

`InUser` mirrors the additions; the GraphQL `InUser` input gains `kind: String` and
`googleSub: String` (the address payload stays out of `InUser` — addresses ride a
separate `saveAddress` mutation, mirroring how themes/posts are split out today).

### Why not a separate `Customers` collection?

Discussed and rejected:
- Doubles the email-uniqueness story (admin@x.com vs customer@x.com — same human?).
- Forks `UserService` into two near-identical classes; violates "mirror existing
  module shape exactly".
- Forces NextAuth `authorize` to look up two collections; doubles the lockout-bucket
  surface area.

A single collection with a discriminator gives us the same isolation at query time
(every customer-facing query filters by `kind: 'customer'`; every admin one filters
by `kind: { $ne: 'customer' }`) without forking the service.

## 2. NextAuth configuration

We **do not** add a second NextAuth handler. We extend the existing handler at
`ui/client/pages/api/auth/[...nextauth].ts` to support both populations, keyed by
the request's call-site:

### Providers

The provider list grows from 2 to 4:

| Provider id | Purpose |
|---|---|
| `admin-credentials` (existing `CredentialsProvider`, renamed) | Admin email+password |
| `admin-google` (existing `GoogleProvider`, gated by `AUTH_GOOGLE_ID`) | Admin Google SSO |
| `customer-credentials` (new `CredentialsProvider`) | Customer email+password |
| `customer-google` (new `GoogleProvider`, gated by `AUTH_CUSTOMER_GOOGLE_ID` + `..._SECRET`) | Customer Google sign-in / sign-up |

Each `CredentialsProvider.authorize` looks up users with the matching `kind` filter,
so an admin email cannot sign in via the customer form and vice-versa. Lockout
buckets remain keyed by `(ip, email, providerId)` so the admin and customer flows
have independent retry counters.

### Callbacks

`jwt` and `session` callbacks copy the **discriminator** plus the relevant slice of
fields:

```ts
// in jwt callback, on initial sign-in
return {
  ...token,
  id: u.id,
  kind: u.kind ?? 'admin',
  email: u.email,
  // Admin-only slice — only present when kind === 'admin'
  role: u.kind === 'admin' ? (u.role ?? 'viewer') : undefined,
  canPublishProduction: u.kind === 'admin' ? Boolean(u.canPublishProduction) : undefined,
  mustChangePassword: u.kind === 'admin' ? Boolean(u.mustChangePassword) : undefined,
};
```

The `session` callback exposes the same shape on `session.user`. Downstream callers
read `session.user.kind` to branch.

The Google provider's `signIn` callback handles **first-touch sign-up** for
customers: if `account.provider === 'customer-google'` and no user exists with that
email or `googleSub`, insert a fresh `kind: 'customer'` doc via
`UserService.addCustomerFromGoogle({ profile, sub })`. Admin Google sign-in keeps
its current behaviour (must already exist).

### Cookie scoping (the collision concern)

NextAuth issues a **single** session cookie per host. To keep admin and customer
sessions from colliding without running two NextAuth handlers, we carry the
discriminator **inside** the JWT and let `authz` route on it:

- Single cookie name: `__Secure-next-auth.session-token` (default).
- The JWT carries `kind`. Admin code paths require `session.kind === 'admin'`;
  customer code paths require `session.kind === 'customer'`. A cookie of the wrong
  kind is treated as anonymous for that surface.
- The custom signin pages live at separate URLs:
  - `/auth/signin` → admin (existing, unchanged)
  - `/account/signin` → customer (new)
  - The `pages.signIn` config stays `/auth/signin`; the customer pages call
    `signIn('customer-credentials', { callbackUrl: '/account' })` directly so
    NextAuth's redirect-on-401 doesn't bounce customers into the admin form.

If, during review, the team prefers strict cookie isolation (e.g. an admin who is
also a customer wants both sessions live in the same browser), we can shard cookies
by path: admin under `path=/admin`, customer under `path=/account` — at the cost of
a second NextAuth handler. **Flagged as open question Q1.**

## 3. Authz integration

`services/features/Auth/authz.ts` is extended in three places, mirroring the
existing rank/requirements/capabilities tables — no new patterns invented.

### a) Session shape

```ts
export interface GraphqlSession {
  kind: 'admin' | 'customer' | 'anonymous';   // was: implicit 'admin' | 'anonymous'
  role: UserRole;                              // 'viewer' for non-admin
  email?: string;
  customerId?: string;                         // populated when kind === 'customer'
  canPublishProduction?: boolean;
}
```

`sessionFromReq` reads `user?.kind ?? 'admin'` and stamps the session accordingly;
absent JWTs collapse to `{ kind: 'anonymous', role: 'viewer' }` (matches today's
fallback).

### b) New requirements + capability tables

Two parallel tables for customer-only mutations/queries, consulted **only** when
`session.kind === 'customer'`:

```ts
export const CUSTOMER_MUTATION_REQUIREMENTS: Record<string, true> = {
  updateMyProfile: true,
  changeMyPassword: true,
  saveMyAddress: true,
  deleteMyAddress: true,
  placeOrder: true,             // future — listed for shape parity
};

export const CUSTOMER_QUERY_REQUIREMENTS: Record<string, true> = {
  me: true,
  myOrders: true,
};
```

`guardMethods` gains a third arg shape — a per-kind dispatch:

```ts
guardMethods(target, session, {
  admin: { required: MUTATION_REQUIREMENTS, capabilities: MUTATION_CAPABILITIES },
  customer: { required: CUSTOMER_MUTATION_REQUIREMENTS, capabilities: CUSTOMER_CAPABILITIES },
});
```

The Proxy's `get` trap selects the table by `session.kind`. Methods absent from the
selected table fall through to the existing role check (admin) or throw
`AuthzError('Forbidden: customer endpoint')` (customer trying to call admin
mutations).

### c) Session injection — customer flavour

`SESSION_INJECTED_METHODS` is split by kind so customer mutations stamp
`customerId` instead of `email`:

```ts
const CUSTOMER_SESSION_INJECTED_METHODS = new Set([
  'updateMyProfile', 'changeMyPassword', 'saveMyAddress', 'deleteMyAddress', 'placeOrder',
]);
```

Resolvers for these read `_session.customerId` to scope every Mongo query. **The
customer session never receives a method that mutates by raw `id` — `me`-style
endpoints derive the target id from the session, not from args.** This is the
critical IDOR guard.

## 4. Public UI surface

Existing under `ui/client/pages/`:
- `auth/signin.tsx` — admin sign-in (do not touch).
- `pages/admin.tsx`, `pages/admin/*` — admin-only routes (do not touch).
- No `account/*` directory exists today.

New, all under `ui/client/pages/account/`:

| Path | Purpose |
|---|---|
| `account/signin.tsx` | Customer sign-in: email+password form + "Continue with Google" button (only if `AUTH_CUSTOMER_GOOGLE_ID` env present, mirroring the admin gating pattern) |
| `account/signup.tsx` | Customer sign-up: email+password form (Google sign-up flows through the same `customer-google` provider on `signin.tsx`) |
| `account/index.tsx` | Logged-in dashboard: profile, addresses, order history (placeholder until orders ship) |
| `account/profile.tsx` | Edit name / email / password — calls `updateMyProfile` / `changeMyPassword` |
| `account/addresses.tsx` | CRUD on `shippingAddresses` |
| `account/forgot.tsx`, `account/reset.tsx` | Password reset (separate work, **flagged Q3**) |

All `account/*` pages use a `withCustomerSession` HOC (parallel to the existing
admin `withAdminSession`) that calls `getServerSession` server-side and redirects
to `/account/signin` if `session?.user?.kind !== 'customer'`. Admins hitting
`/account/*` are redirected to `/account/signin` — they're a different population.

UI components live under `ui/client/components/account/`, mirroring the existing
`ui/client/components/admin/` shape.

## 5. GraphQL surface

### `services/api/schema.graphql` — additions

```graphql
input InCustomer {
  id: String
  name: String
  email: String!
  password: String
  phone: String
}

input InAddress {
  id: String
  name: String!
  line1: String!
  line2: String
  city: String!
  postalCode: String!
  country: String!
  isDefault: Boolean
}

type ICustomer {
  id: String!
  name: String
  email: String!
  phone: String
  emailVerified: String
  shippingAddresses: [IAddress!]!
  createdAt: String
}

type IAddress { ... }

extend type QueryMongo {
  me: ICustomer                      # null when not signed in or kind !== 'customer'
}

extend type MutationMongo {
  signUpCustomer(customer: InCustomer!): String!   # returns JSON {createCustomer:{id}} or {error}
  updateMyProfile(customer: InCustomer!): String!
  changeMyPassword(oldPassword: String!, newPassword: String!): String!
  saveMyAddress(address: InAddress!): String!
  deleteMyAddress(id: String!): String!
}
```

`signUpCustomer` is the only customer-facing mutation reachable **without** a
session (anonymous → customer). It's gated by:
- The existing IP rate-limiter (`pages/api/_rateLimit.ts`).
- A same-origin guard (mirroring `/api/import`).
- An optional CAPTCHA (**Q4**).

### `services/api/graphqlResolvers.ts` — additions

New resolvers added to the `MutationMongo` and `QueryMongo` resolver objects, all
delegating to `UserService` methods (`getMe`, `signUpCustomer`,
`updateMyProfile`, `changeMyPassword`, `saveMyAddress`, `deleteMyAddress`). The
methods follow the existing `Promise<string>` JSON-envelope return convention.

The Apollo context already passes `session` to resolvers (see
`sessionFromReq`); the customer resolvers read `session.customerId` (never a
client-supplied id).

## 6. Test plan

Mirrors `services/features/Users/UserService.test.ts` and
`services/features/Auth/authz.test.ts` exactly — `mongodb-memory-server`,
`vi.mock('bcrypt')`, fresh collection per `beforeEach`.

### `UserService.test.ts` — new cases
- `signUpCustomer` creates a `kind: 'customer'` doc with `role` undefined and
  `canPublishProduction` absent.
- `signUpCustomer` rejects an email that already exists as an admin (cross-kind
  collision).
- `signUpCustomer` rejects an email already taken by another customer.
- `getMe` returns the customer doc with `password: ''` redacted (mirrors
  `getUsers`).
- `updateMyProfile` cannot mutate `role` / `canPublishProduction` / `kind` even
  when those keys are passed in args (escalation guard).
- `changeMyPassword` requires correct `oldPassword`.
- `addCustomerFromGoogle` is idempotent on `googleSub` and links to an existing
  customer if email matches.

### `authz.test.ts` — new cases
- `kind: 'customer'` session calling `addUser` (admin mutation) throws
  `AuthzError`.
- `kind: 'admin'` session calling `updateMyProfile` throws — admin sessions are
  not customers.
- `kind: 'customer'` session calling `me` succeeds and receives injected
  `_session.customerId`.
- `kind: 'anonymous'` calling `signUpCustomer` succeeds (only customer mutation
  open to anon); calling any other customer mutation throws.
- IDOR: customer session calling `saveMyAddress({ id: <other-customer-address-id> })`
  — service must scope by `_session.customerId` and reject mismatched id.

### NextAuth handler test (light)
- `customer-credentials.authorize` ignores users with `kind: 'admin'` (returns
  null + records lockout failure).
- `admin-credentials.authorize` ignores users with `kind: 'customer'`.

## 7. Open questions

1. **Cookie scoping.** Single shared cookie + JWT-internal `kind` discriminator
   (proposed) vs path-scoped cookies + a second NextAuth handler. The proposal
   reuses the existing handler; the alternative is stricter but doubles config
   surface. Which trade-off does the team want?
2. **Account merging.** If a person signs up with email+password as a customer,
   then later uses Google with the same email, do we link or fork? Proposal:
   link on email match, set `googleSub` on the existing doc. Confirm.
3. **Password reset / email verification.** Not in scope of this spec — needs
   an email transport decision (reuse the existing `_inquiryMailer`?). Should
   verification be required before first order, or only nudged?
4. **Bot abuse on `signUpCustomer`.** Rate-limit only, or add CAPTCHA / hCaptcha?
   Admin auth has progressive lockout; customer signup is anonymous and a
   different threat shape.
5. **Admin-as-customer.** Can a single human hold both an admin doc and a
   customer doc with the same email, or must the email-uniqueness index span
   both kinds? Proposal: span both (one email, one human). Confirm.
6. **`me` exposure of `password`.** The existing `getUsers` returns
   `password: ''` blanked but still present on `IUser`. For the customer-facing
   `ICustomer` type, should we drop the field from the GraphQL type entirely
   (cleaner) or keep parity with `IUser` (consistent)?
7. **NextAuth `Account` linking table.** With Google in the mix, do we want to
   adopt the NextAuth Mongo adapter's `accounts` collection for
   provider-account linking, or keep the lightweight `googleSub`-on-user
   approach proposed here? The latter mirrors existing simplicity.

---

## Implementation status

Status as of 2026-04-29: **shipped on `develop`** (uncommitted).

Implemented per spec with the following resolved decisions:
- Single shared cookie + JWT-internal `kind` discriminator (Q1).
- Google merging: link on email match, set `googleSub` on existing doc (Q2).
- Email unique across both kinds — one human, one email (Q5).
- Password reset / email verification deferred (Q3).
- Rate-limit only on `signUpCustomer`, no CAPTCHA (Q4).
- `password` field dropped from the `ICustomer` GraphQL type (Q6).
- `googleSub`-on-user approach kept, no NextAuth `accounts` collection (Q7).

Files: `shared/types/IUser.ts`, `services/features/Users/UserService.ts`, `services/features/Auth/authz.ts`, `services/infra/mongoDBConnection.ts`, `services/api/{schema.graphql,graphqlResolvers.ts,client/MongoApi.ts}`, `ui/client/pages/api/auth/authOptions.ts`, `ui/client/pages/api/graphql.ts`, `ui/client/pages/auth/signin.tsx`, `ui/client/pages/account/{_session.ts,_gqlClient.ts,signin.tsx,signup.tsx,index.tsx,profile.tsx,addresses.tsx}`. Tests: 11 new in `UserService.test.ts`, 5 new in `authz.test.ts`.
