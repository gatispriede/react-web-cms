import {Page, expect} from '@playwright/test';
import {byTid, tid, moduleTypeSlug} from '../../fixtures/testIds';
import {EItemType} from '@enums/EItemType';

/**
 * Shared module harness used by every spec under `tests/e2e/modules/`.
 *
 * Each module spec follows the same shape: navigate to a freshly-created
 * page → add a section → add the module under test → fill its editor →
 * save → load the public page and assert the marker rendered. The harness
 * exposes those steps as building blocks so the per-module spec only
 * needs to declare the editor-fill closure + the public-render assertion.
 *
 * DECISION: per-spec page creation through the admin UI (no direct DB
 * writes) — matches the rule documented in `seedFactories.ts`. Each spec
 * gets its own slug-namespaced page so parallel workers can't collide.
 *
 * DECISION: harness owns timing knobs (drawer-open waits, public reload
 * after save) so individual specs stay declarative. When public-render
 * timing changes (ISR refresh, revalidate scope), only the harness needs
 * a tweak — not 30 specs.
 */

/** Per-spec scenario state — slug + run id + page name. */
export interface ModuleScenario {
    /** Stable for one spec invocation; rolls into testid + page slug. */
    runId: string;
    /** Page slug under `/<lang>/<slug>` on the public site. */
    pageSlug: string;
    /** Page name as shown in the admin navigation tree. */
    pageName: string;
    /** Marker text the harness asserts on the public site. */
    marker: string;
}

export function buildScenario(moduleSlug: string): ModuleScenario {
    const stamp = Date.now().toString(36);
    const runId = `e2e-${moduleSlug}-${stamp}`;
    // Page name doubles as the URL slug — use hyphens, no spaces, so the
    // testid `nav-page-row-<page.toLowerCase()>` and the public URL stay
    // sane. Pages render as `/[lang]/[slug]` where slug is derived from
    // the page name; the admin nav row testid uses the same lowercased
    // string with no further normalization.
    const pageName = `e2e-${moduleSlug}-${stamp}`;
    return {
        runId,
        pageSlug: pageName,
        pageName,
        marker: `${moduleSlug}-marker-${stamp}`,
    };
}

/**
 * Create a brand-new page through the admin Build surface and return
 * once it's the active page in the editor.
 *
 * Caller must already be signed in (use the `adminPage` fixture).
 */
export async function createPage(page: Page, scenario: ModuleScenario): Promise<void> {
    await page.goto('/admin/build');
    // Existing testids (instrumented in AdminApp + AddNewDialogNavigation):
    //   nav-add-page-btn          — opens the new-page dialog
    //   nav-page-name-input       — page name field inside the dialog
    //   nav-page-save-btn         — Modal's OK button (instrumented via okButtonProps)
    //   nav-page-row-<page name>  — sider row, uses `tp.page.toLowerCase()`
    const addPageBtn = byTid(page, tid('nav', 'add', 'page', 'btn'));
    await expect(addPageBtn).toBeVisible({timeout: 15_000});
    await addPageBtn.click();

    const nameInput = byTid(page, tid('nav', 'page', 'name', 'input'));
    await expect(nameInput).toBeVisible({timeout: 5_000});
    await nameInput.fill(scenario.pageName);
    await byTid(page, tid('nav', 'page', 'save', 'btn')).click();

    // Sider row appears after the create round-trip + nav refresh. Click
    // it to make this page the active editing target.
    const row = byTid(page, tid('nav', 'page', 'row', scenario.pageName.toLowerCase()));
    await expect(row).toBeVisible({timeout: 15_000});
    await row.click();
}

/** Open the section-add dialog, pick the 100%-blank layout, create. */
export async function addBlankSection(page: Page): Promise<void> {
    await byTid(page, tid('section', 'add', 'section', 'btn')).click();
    await byTid(page, tid('section', 'layout', 'picker', '1')).click();
    await byTid(page, tid('section', 'create', 'btn')).click();
    // Section row appears in the layout — the "add module" button inside
    // it is what the next step will click. Wait for at least one to be
    // attached so the click target exists.
    await expect(byTid(page, tid('section', 'add', 'module', 'btn')).first())
        .toBeVisible({timeout: 10_000});
}

/**
 * Open the add-module drawer and pick the module type. After this returns,
 * the editor's `module-editor-*` inputs are addressable; caller fills them.
 */
export async function openAddModuleDrawer(page: Page, type: EItemType): Promise<void> {
    await byTid(page, tid('section', 'add', 'module', 'btn')).first().click();
    // The picker dialog opens off the Content tab. AddNewSectionItem
    // exposes the trigger via `section-module-type-picker-btn`; the per-
    // type tile inside ModulePickerDialog is `section-module-picker-<slug>`.
    await byTid(page, tid('section', 'module', 'type', 'picker', 'btn')).click();
    await byTid(page, tid('section', 'module', 'picker', moduleTypeSlug(type))).click();
    // Picker closes; the editor is back. Save button is always rendered
    // in the drawer extra — wait for it.
    await expect(byTid(page, tid('module-editor', 'save', 'btn'))).toBeVisible({timeout: 5_000});
}

/**
 * Add a single stat row first via the "Add stat" button, then fill its
 * label. Used by StatsStrip whose `cells` array starts empty so the
 * primary-text-input doesn't render until at least one row exists.
 */
export async function addStatsStripRow(page: Page, value: string): Promise<void> {
    await page.getByRole('button', {name: /add stat/i}).click();
    const input = byTid(page, tid('module-editor', 'primary', 'text', 'input'));
    await expect(input).toBeAttached({timeout: 5_000});
    await input.fill(value);
}

/** Fill the canonical primary text input, used by Text / RichText / Manifesto. */
export async function fillPrimaryText(page: Page, value: string): Promise<void> {
    const input = byTid(page, tid('module-editor', 'primary', 'text', 'input'));
    await expect(input).toBeAttached({timeout: 5_000});
    await input.fill(value);
}

/** Save the open editor and wait for the drawer to close. */
export async function saveModuleDrawer(page: Page): Promise<void> {
    const save = byTid(page, tid('module-editor', 'save', 'btn'));
    await save.click();
    await expect(save).toBeHidden({timeout: 10_000});
}

/**
 * Visit the public page (defaults to /lv/<slug> + cache-buster) and assert
 * the marker rendered. ISR regen is async — after a save, the admin's
 * `triggerRevalidate` returns immediately and Next regenerates the page
 * in the background. A bare `goto` can land on the stale-cached version
 * before regen finishes, so we poll: reload up to N times, looking for
 * the marker each time. Each reload busts the URL cache with a fresh
 * `?ts=…` and forces the worker to serve the latest ISR snapshot.
 */
export async function assertPublicMarker(
    page: Page,
    scenario: ModuleScenario,
    opts: {selector?: string; lang?: string; markerOverride?: string; path?: string} = {},
): Promise<void> {
    const lang = opts.lang ?? 'lv';
    const marker = opts.markerOverride ?? scenario.marker;
    const basePath = opts.path ?? `/${lang}/${scenario.pageSlug}`;

    const deadline = Date.now() + 30_000;
    let lastBody = '';
    while (Date.now() < deadline) {
        await page.goto(`${basePath}?ts=${Date.now()}`);
        if (opts.selector) {
            const loc = page.locator(opts.selector).first();
            if (await loc.count() && await loc.isVisible()) return;
        } else {
            lastBody = (await page.textContent('body')) ?? '';
            if (lastBody.includes(marker)) return;
        }
        await page.waitForTimeout(750);
    }
    throw new Error(
        opts.selector
            ? `assertPublicMarker: selector "${opts.selector}" never visible at ${basePath}`
            : `assertPublicMarker: marker "${marker}" never appeared at ${basePath}. Last body excerpt: "${lastBody.slice(0, 200)}"`,
    );
}
