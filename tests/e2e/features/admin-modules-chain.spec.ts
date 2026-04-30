import {test, expect} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {buildSamples, mulberry32, sampleMarker, shuffleInPlace, ModuleSample} from '../fixtures/moduleSamples';
import {byTid, tid, moduleTypeSlug} from '../fixtures/testIds';

// Testids follow `docs/architecture/test-ids.md` —
// `<feature>-<element>[-<context>]-<role>`. Composed inline at the call
// site; no registry.

// ──────────────────────────────────────────────────────────────────
// SCENARIO: admin creates a page → adds every module type → edits
// each → switches theme → asserts public render at every step.
//
// Tests run *serially* (`describe.serial`). Each step builds on the
// state left by the previous step, sharing one admin session, one
// page slug, and one random seed across the chain. A step failing
// skips the rest — there's no point editing modules if create-page
// failed.
//
// ## Random seed reproducibility
//
// Default: a fresh seed per run, derived from `Date.now()`. Override by
// exporting `E2E_RANDOM_SEED=<n>` to reproduce a specific run. The
// seed is logged at the start of every run (passing or failing) so
// CI failures can be replayed bit-for-bit.
//
// ## Why this is `test.skip`'d for now
//
// The admin shell doesn't expose `data-testid` attributes yet — the
// spec references the testid map in `fixtures/testIds.ts` that the
// instrumentation pass (Phase B in the e2e roadmap) will materialise.
// Until then this spec would fail on every selector. Remove the
// `test.skip` wrapper once the testids land in the JSX.
//
// ## What each step asserts
//
// Step 1 — create + populate
//   - Page exists in the admin nav after save
//   - Each module's marker text (or asserted selector for image-only
//     modules) is visible on the public page
//
// Step 2 — edit
//   - Each module's primary text field is updated (marker → marker +
//     ' edited'). Public render reflects the edit for every module.
//
// Step 3 — theme switch
//   - Active theme is changed via the Themes pane.
//   - A theme-token CSS variable on the public page resolves to the
//     newly-active theme's value (canary token: `--token-accent` or
//     equivalent).
//
// Step 4 (later) — delete
//   - Page deletion cascades; public URL 404s; Audit log records
//     the actor + action.

const RANDOM_SEED = process.env.E2E_RANDOM_SEED
    ? Number(process.env.E2E_RANDOM_SEED)
    : Date.now() & 0xffffffff;

// Skipped until Phase B lands data-testids on the admin shell. Set the
// env var `E2E_MODULES_CHAIN_ENABLED=1` to actually run the chain — until
// the testids exist, every selector fails and the suite goes red.
test.describe.serial('admin chain — page lifecycle across all modules', () => {
    test.skip(
        !process.env.E2E_MODULES_CHAIN_ENABLED,
        'gated on Phase B (data-testid instrumentation on admin shell). ' +
            'Set E2E_MODULES_CHAIN_ENABLED=1 once the testids in `fixtures/testIds.ts` exist in the JSX.',
    );

    // Per-scenario state. Populated by step 1, consumed by 2-3.
    const scenario: {
        runId: string;
        pageSlug: string;
        samples: ModuleSample[];
        addOrder: ModuleSample[];
    } = {
        runId: '',
        pageSlug: '',
        samples: [],
        addOrder: [],
    };

    test.beforeAll(async () => {
        scenario.runId = `e2e${(RANDOM_SEED >>> 0).toString(36).slice(0, 8)}`;
        scenario.pageSlug = `mods-${scenario.runId}`;
        scenario.samples = buildSamples(scenario.runId);
        scenario.addOrder = shuffleInPlace([...scenario.samples], mulberry32(RANDOM_SEED));
        // Surfaced in the report so a failed run can be replayed by
        // exporting the same seed.
        // eslint-disable-next-line no-console
        console.log(
            `[e2e/modules-chain] seed=${RANDOM_SEED} runId=${scenario.runId} ` +
                `slug=${scenario.pageSlug} order=[${scenario.addOrder.map(s => s.type).join(',')}]`,
        );
    });

    test('step 1 — create page and add every module in shuffled order', async ({adminPage, anonPage, serverUrl}) => {
        // Navigate the admin to the Navigation pane and click "Add page".
        await adminPage.goto('/admin');
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(scenario.pageSlug);
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        await expect(byTid(adminPage, tid('nav', 'page', 'row', scenario.pageSlug))).toBeVisible({timeout: 15_000});

        // Empty pages render a section-template chooser, not the
        // per-section module-add trigger. Create a blank 1-column
        // section first so the chain can target a real slot — this
        // mirrors the canonical "I'm building a new page" workflow.
        await byTid(adminPage, tid('section', 'add', 'section', 'btn')).click();
        await byTid(adminPage, tid('section', 'layout', 'picker', '1')).click();
        await byTid(adminPage, tid('section', 'create', 'btn')).click();

        // Add every module in the shuffled order. For each: open the
        // picker, click the type, fill the canonical text input with
        // the sample's marker text, save.
        for (const sample of scenario.addOrder) {
            await byTid(adminPage, tid('section', 'add', 'module', 'btn')).click();
            await byTid(adminPage, tid('section', 'module', 'picker', moduleTypeSlug(sample.type))).click();
            // Module editor opens — fill the canonical primary text
            // field with the marker. Modules without a primary text
            // field (Image, Gallery, Carousel, ProjectCard) take the
            // sample content's image alt as the marker — those don't
            // need a fill step here, they take whatever the editor
            // renders by default. The agent instrumenting testids
            // should expose `module-editor-primary-text-input` only
            // for modules with a meaningful single text field; gallery
            // / image flows save without typing.
            const editor = byTid(adminPage, tid('module-editor', 'primary', 'text', 'input'));
            if (await editor.count()) {
                await editor.fill(sample.markerText ?? '');
            }
            await byTid(adminPage, tid('module-editor', 'save', 'btn')).click();
            // Confirm the row appears in the section list before moving on.
            await expect(byTid(adminPage, tid('section', 'module', 'row', moduleTypeSlug(sample.type)))).toBeVisible();
        }

        // Save the section as a whole if the admin requires an explicit
        // save step (some flows auto-save; this is a no-op if the button
        // doesn't exist yet).
        const sectionSave = byTid(adminPage, tid('section', 'save', 'btn'));
        if (await sectionSave.count()) await sectionSave.click();

        // Public render — fresh anon context so admin cookie doesn't
        // leak into the public path.
        await anonPage.goto(`/lv/${scenario.pageSlug}`);
        for (const sample of scenario.addOrder) {
            if (sample.markerText) {
                await expect(anonPage.getByText(sample.markerText)).toBeVisible({timeout: 15_000});
            } else if (sample.assertSelector) {
                await expect(anonPage.locator(sample.assertSelector).first()).toBeVisible({
                    timeout: 15_000,
                });
            } else {
                throw new Error(`module ${sample.type} has neither markerText nor assertSelector`);
            }
        }
    });

    test('step 2 — edit primary text on every module, public render reflects edits', async ({adminPage, anonPage}) => {
        await adminPage.goto('/admin');
        await byTid(adminPage, tid('nav', 'page', 'row', scenario.pageSlug)).click();

        const edited = scenario.addOrder.map(s => ({
            ...s,
            editedMarker: s.markerText ? `${s.markerText} edited` : undefined,
        }));

        for (const sample of edited) {
            // Skip image-only modules where there's no text to edit.
            if (!sample.markerText || !sample.editedMarker) continue;
            await byTid(adminPage, tid('section', 'module', 'edit', moduleTypeSlug(sample.type), 'btn')).click();
            const input = byTid(adminPage, tid('module-editor', 'primary', 'text', 'input'));
            await input.fill(sample.editedMarker);
            await byTid(adminPage, tid('module-editor', 'save', 'btn')).click();
        }

        await anonPage.goto(`/lv/${scenario.pageSlug}?ts=${Date.now()}`);
        for (const sample of edited) {
            if (sample.editedMarker) {
                await expect(anonPage.getByText(sample.editedMarker)).toBeVisible({timeout: 15_000});
            }
        }

        // Persist edited markers for step 3 — theme switch shouldn't
        // delete content.
        scenario.samples = edited.map(({editedMarker, ...rest}) =>
            editedMarker ? {...rest, markerText: editedMarker} : (rest as ModuleSample),
        );
    });

    test('step 3 — switch active theme, every module reflects new tokens', async ({adminPage, anonPage}) => {
        await adminPage.goto('/admin/settings/themes');

        // Capture the public-page accent before the switch so we can
        // assert it changed (rather than asserting an absolute value,
        // which would couple the test to a specific theme JSON).
        await anonPage.goto(`/lv/${scenario.pageSlug}?ts=${Date.now()}-pre`);
        const accentBefore = await readAccent(anonPage);

        // Find a theme row that isn't the currently-active one. The
        // testids include the theme id; the active theme has its
        // set-active button disabled — pick any row whose set-active
        // button is enabled.
        const themeRows = await adminPage.locator(`[data-testid^="${tid('themes', 'list', 'row')}-"]`).all();
        let switched = false;
        for (const row of themeRows) {
            const setActive = row.locator(`[data-testid="${tid('themes', 'set', 'active', 'btn')}"]`);
            if ((await setActive.count()) && (await setActive.isEnabled())) {
                await setActive.click();
                switched = true;
                break;
            }
        }
        expect(switched, 'expected at least one inactive theme to switch to').toBe(true);

        // Reload public; assert accent token CHANGED. Modules using
        // `--token-accent` (or the theme's primary accent variable
        // family) should pick up the new value with a hard reload.
        await anonPage.goto(`/lv/${scenario.pageSlug}?ts=${Date.now()}-post`);
        const accentAfter = await readAccent(anonPage);
        expect(accentAfter, `accent before=${accentBefore} after=${accentAfter}`).not.toBe(accentBefore);

        // Sanity — every module's marker is still visible (theme switch
        // shouldn't drop content).
        for (const sample of scenario.samples) {
            if (sample.markerText) {
                await expect(anonPage.getByText(sample.markerText)).toBeVisible();
            }
        }
    });
});

async function readAccent(page: import('@playwright/test').Page): Promise<string> {
    return page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const candidates = [
            '--token-accent',
            '--token-color-accent',
            '--color-accent',
            '--token-primary',
            '--token-color-primary',
            '--color-primary',
        ];
        for (const c of candidates) {
            const v = cs.getPropertyValue(c).trim();
            if (v) return v;
        }
        return '';
    });
}
