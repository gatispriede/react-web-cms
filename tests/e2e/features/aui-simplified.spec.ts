import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — AUI simplified mode (shipped 2026-05-03)
//
// FLOW
//   In simplified mode, admin panes hide power-user knobs:
//     · Themes: only Activate per card (no New / Edit / Duplicate / Delete)
//     · Posts: title + body + cover image only (no slug / tags / author /
//              excerpt / draft toggle), Save publishes immediately.
//
// DATA STATE
//   Simplified mode is currently driven by a query string `?aui=simple`
//   (or a feature flag — TODO confirm the canonical entry point). Each
//   test goes straight to the pane in simplified mode; nothing to seed.
//
// SELECTOR GAPS (TODO):
//   - data-testid="aui-mode-simple"        → wrapper attribute on the
//          shell when simplified mode is active (entry-point assertion)
//   - data-testid="themes-set-active-btn"  → ALREADY WIRED
//   - data-testid="themes-new-btn"         → MUST BE ABSENT in simple
//   - data-testid="themes-edit-btn"        → MUST BE ABSENT in simple
//   - data-testid="themes-duplicate-btn"   → MUST BE ABSENT in simple
//   - data-testid="themes-delete-btn"      → MUST BE ABSENT in simple
//   - data-testid="posts-form-title-input" → kept in simple
//   - data-testid="posts-form-body-input"  → kept in simple
//   - data-testid="posts-form-cover-input" → kept in simple
//   - data-testid="posts-form-slug-input"  → MUST BE ABSENT
//   - data-testid="posts-form-tags-input"  → MUST BE ABSENT
//   - data-testid="posts-form-author-input"→ MUST BE ABSENT
//   - data-testid="posts-form-excerpt-input" → MUST BE ABSENT
//   - data-testid="posts-form-draft-toggle"→ MUST BE ABSENT
//   - data-testid="posts-form-save-btn"    → publishes-immediately in simple
// ──────────────────────────────────────────────────────────────────

const SIMPLE_QUERY = '?aui=simple';

test.describe('feature — AUI simplified mode', () => {
    test('themes pane shows only Activate per card', async ({adminPage}) => {
        await adminPage.goto(`/admin/client-config/themes${SIMPLE_QUERY}`);

        const activateBtn = adminPage.locator('[data-testid="themes-set-active-btn"]').first();
        await expect(activateBtn).toBeVisible({timeout: 15_000});

        // The forbidden buttons must not render.
        for (const tid of ['themes-new-btn', 'themes-edit-btn', 'themes-duplicate-btn', 'themes-delete-btn']) {
            await expect(
                adminPage.locator(`[data-testid="${tid}"]`),
                `expected ${tid} to be absent in simplified mode`,
            ).toHaveCount(0);
        }
    });

    test.skip('posts pane shows only title + body + cover', async ({adminPage}) => {
        // TODO: unskip once posts-form-* testids exist (header lists them).
        // Contract: title/body/cover present; slug/tags/author/excerpt/draft absent.
        await adminPage.goto(`/admin/content/posts/new${SIMPLE_QUERY}`);
        await expect(adminPage.getByTestId('posts-form-title-input')).toBeVisible();
        await expect(adminPage.getByTestId('posts-form-body-input')).toBeVisible();
        await expect(adminPage.getByTestId('posts-form-cover-input')).toBeVisible();
        for (const t of [
            'posts-form-slug-input',
            'posts-form-tags-input',
            'posts-form-author-input',
            'posts-form-excerpt-input',
            'posts-form-draft-toggle',
        ]) {
            await expect(adminPage.locator(`[data-testid="${t}"]`)).toHaveCount(0);
        }
    });

    test.skip('simplified Save publishes immediately and post appears on /blog', async ({adminPage, anonPage}) => {
        // TODO: unskip once posts-form-* testids exist + the simplified
        // save handler is wired to publish without the draft toggle.
        const stamp = Date.now().toString(36);
        const title = `Simple Post ${stamp}`;
        await adminPage.goto(`/admin/content/posts/new${SIMPLE_QUERY}`);
        await adminPage.getByTestId('posts-form-title-input').fill(title);
        await adminPage.getByTestId('posts-form-body-input').fill('Body of the simplified post.');
        await adminPage.getByTestId('posts-form-save-btn').click();
        await anonPage.goto('/blog');
        await expect(anonPage.getByText(title)).toBeVisible({timeout: 15_000});
    });
});
