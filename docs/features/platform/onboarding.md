# Onboarding wizard (Q7)

First-run setup flow at `/admin/onboarding`. Three steps:

1. **Site name + default language** — siteName (required), locale picker
   sourced from `LANGUAGE_PRESETS`.
2. **Admin account** — email + password (min 12 chars) + confirm + "I
   understand this is the first admin" checkbox.
3. **Theme pick** — one of the four editorial presets seeded by
   `ThemeService` (Industrial / Studio / Paper / Classic). The pick is a
   theme **name**; the backend resolves it to the Themes-collection id.

After a successful bootstrap the wizard pushes to `/admin/build` with a
welcome toast.

## Detection contract

`OnboardingService.isFreshInstall()` returns `true` iff the Users
collection has zero admin-kind documents. Implemented as a Mongo
`countDocuments` over `{kind: 'admin'}` plus the legacy back-compat
filter (`{kind: {$exists: false}, role: 'admin' | 'editor' | 'viewer'}`)
so a pre-`kind` admin still occupies the slot. A connection error
returns `false` (refuse to expose the wizard on a flaky probe).

## Bootstrap contract

`OnboardingService.bootstrap({siteName, locale, adminEmail, adminPassword, themeKey})`:

1. Re-checks `isFreshInstall()` (race guard against double submit).
2. Inserts the first admin user (`role: 'admin'`, `kind: 'admin'`,
   `canPublishProduction: true`, bcrypt-hashed password).
3. Writes `siteName` + `defaultLocale` into the `siteFlags` document.
4. Upserts a default-language row with `default: true`.
5. Activates the requested theme by name (best-effort).

Atomicity: Mongo gives no multi-doc transaction here. Steps run in
order least-recoverable first; if step 3/4/5 fails after step 2 lands,
the admin can finish manually from the regular admin panes. Step 1's
race re-check is the only correctness-critical gate — once an admin
row exists, the route refuses to render and the service throws
`onboarding already complete`.

## Routes & guards

- **`/admin/onboarding`** — page-level `getServerSideProps` calls
  `isFreshInstall()` server-side. Returns 307 → `/admin/build` when
  false. No `LoginBtn` wrap; the wizard is pre-auth by design.
- **`AdminApp.componentDidMount`** — when on `/admin` or `/admin/build`,
  fires the `isFreshInstall` GraphQL query; if true, replaces the
  location with `/admin/onboarding`. Runs once per mount.
- **GraphQL `isFreshInstall` (query) + `onboardingBootstrap` (mutation)**
  — both bypass `guardMethods` (Cart-loader pattern) since there's no
  admin yet to check. The service-side fresh-install gate is the actual
  authorisation check.

## How to reset (dev)

Drop the Users collection in your Mongo and reload `/admin`:

```
mongosh mongodb://localhost:27017/<db>
> db.Users.deleteMany({})
> db.SiteSettings.deleteOne({key: 'siteFlags'})
```

The `INITIAL_PASSWORD_DIR`-keyed artefact may also need clearing if
the seed-time admin path ran before the wizard.

## Files

- `services/features/Onboarding/OnboardingService.ts` — detection + bootstrap.
- `services/features/Onboarding/OnboardingServiceLoader.ts` — manifest:
  SDL fragment + resolver bypass.
- `ui/admin/features/Onboarding/OnboardingViewModel.ts` — VM3 state.
- `ui/admin/features/Onboarding/OnboardingWizard.tsx` — render-only.
- `ui/client/pages/admin/onboarding.tsx` — Next page + SSR gate.
- `ui/admin/shell/AdminApp.tsx` — boot guard (mount-time redirect).
