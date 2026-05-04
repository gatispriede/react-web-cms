# Bundle fixtures

Canonical bundle JSON files used by the smoke chain spec. The bundle import is the smoke test's entry-point — it seats a known content state so the rest of the chain has real data to edit.

## `cv-latest.json`

The maintainer's CV bundle. Smoke spec [`tests/e2e/smoke/cv-bundle-chain.spec.ts`](../../smoke/cv-bundle-chain.spec.ts) imports this in step 2 and edits five modules in step 3.

**Regenerate:**

```bash
npm run e2e:bundle:refresh
```

The script signs in to your local dev server as the seeded admin, calls the existing Bundle export endpoint, and writes the result here. Commit the regenerated file when intentional changes to the bundle should reach the smoke gate (e.g. you added a new module to the CV and want CI to verify it).

**Don't hand-edit.** The bundle has interlocking ids (Section IDs referenced by Navigation rows, Theme IDs in SiteSettings); a hand-tweak that breaks one of those references makes step 2 fail with a confusing error. Refresh from the source.

## How the smoke spec handles this file

`cv-latest.json` ships with a `__stub: true` sentinel. The smoke spec's `beforeAll` reads the file and aborts the run with a clear message if it sees the sentinel — so the first time you run smoke you get "regenerate via npm run e2e:bundle:refresh", not nine cascading assertion failures against empty content.

Once you regenerate, `__stub` is gone and the chain runs against real content.
