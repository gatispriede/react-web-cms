# Visual regression baselines

Snapshot baselines for every CMS module + critical site surface, captured
by Playwright's `toHaveScreenshot()` and committed to the repo. Any pixel
drift in a refactor surfaces in CI before merge.

## What's covered

- **48 module baselines** — for every `EItemType` (excluding `Empty`):
  - one Display snapshot (renders against the canonical sample fixture
    in `ui/client/lib/preview/samples.ts`)
  - one Editor snapshot (renders the registry's `Editor` with
    `defaultContent` from `ui/admin/lib/itemTypes/registry.ts`)
- **9 critical surfaces**:
  1. `/[lang]` — public homepage
  2. `/[lang]/[slug]` — public page (`about` from the seeded bundle)
  3. `/admin` — admin shell entry
  4. `/admin/build` — page editor surface
  5. `/auth/signin` — sign-in form
  6. `/checkout` — checkout flow root
  7. `/[lang]/blog` — blog index
  8. `/[lang]/blog/[slug]` — blog post detail
  9. `/admin/release/bundle` — Bundle pane (admin-only)
- **1 Footer component** — captured from the public homepage's `<footer>`
  landmark, so a footer-only change can fail without blowing up the
  homepage baseline.

Total: ~58 baselines. Stored under `tests/e2e/visual/__snapshots__/`,
keyed by spec name + screenshot label (Playwright's default layout).

## Where the code lives

| Concern | File |
| --- | --- |
| Project config | `playwright.config.ts` (top-level `expect.toHaveScreenshot`, `visual` project) |
| Render slot | `ui/client/pages/dev/visual.tsx` (single-module mount; dev/E2E only) |
| Helpers | `tests/e2e/visual/_shared/visualHelpers.ts` |
| Display specs | `tests/e2e/visual/modules/displays.spec.ts` |
| Editor specs | `tests/e2e/visual/modules/editors.spec.ts` |
| Surface specs | `tests/e2e/visual/surfaces.spec.ts` |
| CI job | `.github/workflows/ci.yml` (`visual` job, sharded 4×, nightly + master push) |

## Running locally

The visual project is opt-in — `npx playwright test` (no `--project`) runs
the existing `chromium` project and ignores `tests/e2e/visual/**`. To
exercise the visual suite:

```bash
# All visual specs (uses isolated Mongo + dev server per worker)
npx playwright test --project=visual

# One spec
npx playwright test --project=visual tests/e2e/visual/surfaces.spec.ts

# One test by title
npx playwright test --project=visual -g "display . HERO"
```

> **Port 80 conflict** — the e2e fixtures spawn their own `next dev` per
> worker on a free port. Local runs are unaffected by anything already on
> port 80. Only the legacy `e2e:reuse` script (`PLAYWRIGHT_E2E_REUSE_DEV=1`)
> talks to a single :80 dev server.

## Updating baselines after an intentional UI change

1. Make the UI change on a feature branch.
2. Regenerate baselines locally:

   ```bash
   npx playwright test --project=visual --update-snapshots
   ```

   This rewrites every PNG under `tests/e2e/visual/__snapshots__/`. Use
   `-g <pattern>` to scope the regen to a subset.
3. **Eyeball every changed PNG** in `git diff` (binary diff in GitHub UI
   is acceptable — the side-by-side viewer renders the changed image).
   If a baseline changed that you didn't expect, your refactor leaked.
4. Commit the regen alongside the code change:

   ```
   visual-regressions: rebake hero baseline after spacing change
   ```

5. Push. Nightly CI confirms the new baselines hold against the master
   image; if a baseline is non-deterministic on Linux runners (font, SSR
   timing) the next nightly fails and you debug per the next section.

## Debugging a flaky baseline

Symptom: spec passes locally on macOS / Windows, fails on the Linux CI
runner with a small (<1%) pixel-ratio diff.

1. Check the failure artifact — the `visual` CI job uploads the
   `playwright-report/` on failure as `playwright-visual-report-shard-N`.
   Open `index.html` and click the failing test → "Image diff" tab.
2. Common causes (in order of likelihood):
   - **Font fallback flash.** `waitForVisualReady()` already awaits
     `document.fonts.ready`; if the failing baseline shows different
     glyph metrics, a webfont is being loaded outside the CSS
     `@font-face` declaration (e.g. injected at runtime via JS). Move it
     into a `<link rel="preload" as="font">` or bundle it.
   - **Image decode race.** Same helper awaits `img.decode()`, but a
     dynamically inserted `<img>` after first paint slips through. Add
     a fixed `width`/`height` attribute and the layout settles
     pre-decode; or `await page.locator('img').last().waitFor()` before
     the screenshot.
   - **Animation in flight.** `playwright.config.ts` already passes
     `animations: 'disabled'` to `toHaveScreenshot`, but a CSS
     transition with a non-zero `transition-delay` can still flicker
     mid-frame. Wrap the offending element in a `data-volatile="*"`
     selector and add it to `maskVolatile()`.
   - **Genuine drift.** The CI-rendered output really is different. Run
     `--update-snapshots` *on the same OS as CI* — easiest path is a
     Docker container (`mcr.microsoft.com/playwright:v<X>-jammy`) so
     baselines are baked against the same Chromium build.

## How CI sharding works

The `visual` job in `.github/workflows/ci.yml` runs four parallel
runners (matrix `shard: [1,2,3,4]`). Each invokes
`npx playwright test --project=visual --shard=N/4`. Playwright sorts
tests deterministically and slices the list — shard 1 runs tests
`[0..n/4)`, shard 2 runs `[n/4..n/2)`, etc. `fail-fast: false` keeps
the other three running when one trips so you see the full failure set
in one nightly cycle, not piecemeal across days.

The job is gated by

```yaml
if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/master')
```

— PRs do not trigger it. Once a PR's UI change merges to master, the
master push fires the visual job. The cron entry (`0 4 * * *`) runs a
nightly clean pass to catch baseline drift unrelated to merges (font
package update, OS image bump, etc.).

## First-run baseline capture

Baselines are **not yet committed** at the time this runbook lands —
the initial capture is gated on a free port-80 (`netstat -ano | grep :80`
must show no `LISTENING` entries on the box doing the capture).

When ready:

```bash
# Verify port 80 is free, then:
npx playwright test --project=visual --update-snapshots

# Commit the result under tests/e2e/visual/__snapshots__/
git add tests/e2e/visual/__snapshots__
git commit -m "visual-regressions: initial baseline capture"
```

If port 80 is busy and you cannot free it, the alternative is the
isolated-server script:

```bash
npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots
```

— this skips the shared `:80` dev server entirely and spawns a
disposable one per worker on a random port.

## Adding a new module type

The display + editor specs iterate `Object.values(EItemType)` directly,
so a new enum value picks up coverage automatically as long as:

1. The new type has a sample in `ui/client/lib/preview/samples.ts` (the
   existing `samples.test.ts` enforces this).
2. The registry entry in `ui/admin/lib/itemTypes/registry.ts` supplies
   `defaultContent` for the editor case.

After the first CI run flags the missing baseline, capture it locally
with `--update-snapshots -g <NEW_TYPE>` and commit.
