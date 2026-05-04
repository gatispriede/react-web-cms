# End-to-end tests

Playwright suite covering the public + admin surfaces. Per-worker `mongodb-memory-server` + `next dev`. See [`docs/features/e2e-testing.md`](../../docs/features/e2e-testing.md) for the full design.

## First-time setup

```bash
npm install
npm run e2e:install     # downloads chromium browser (~150 MB)
```

## Running

```bash
npm run e2e             # full suite, headless
npm run e2e:headed      # full suite, headed (debug)
PLAYWRIGHT_E2E_VERBOSE=1 npm run e2e   # pipe child next-server logs
```

## Iterating on one spec

If you already have a `next dev` running on port 80 and a Mongo handy:

```bash
npm run e2e:dev -- tests/e2e/features/theming.spec.ts
```

This skips the per-worker server boot and reuses the running dev server. Override the URL with `PLAYWRIGHT_E2E_REUSE_URL=http://localhost:3000`.

## Layout

```
tests/e2e/
├── fixtures/
│   ├── db.ts               # mongodb-memory-server per worker
│   ├── server.ts           # next dev per worker
│   ├── seedFactories.ts    # direct-Mongo seed helpers
│   └── auth.ts             # Playwright test.extend with adminPage/etc.
└── features/               # one spec per docs/features/*.md (Phase 2+)
    ├── auth-admin.spec.ts
    ├── content-management.spec.ts
    └── theming.spec.ts
```

## Phases

- **Phase 1 (this PR)** — infra + 3 representative specs (auth, content, theming).
- **Phase 2** — one spec per `EItemType` × style under `tests/e2e/modules/`.
- **Phase 3** — e-commerce specs (customer-auth, products, cart, checkout, inventory).
- **Phase 4** — visual regression under `tests/e2e/visual/`.

## Updating screenshots (Phase 4+)

```bash
npm run e2e:update-screenshots
```

Review the diff, commit baseline PNGs alongside the spec change.
