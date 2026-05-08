import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Mobile bottom-sheet modal placement
//
// Below 768 px the AdminAntdOverrides.scss reroutes every AntD Modal
// inside `[data-admin-theme]` to a bottom-sheet:
//
//   - `.ant-modal-wrap` : flex / align-items: flex-end
//   - `.ant-modal`      : 100 vw width, no top offset, no margins
//   - `.ant-modal-content` : 16px 16px 0 0 border-radius (rounded top)
//
// Above the breakpoint AntD's standard centered placement applies.
// We exercise both via the Users page "Add user" modal — it's the
// simplest always-available admin modal.
// ──────────────────────────────────────────────────────────────────

const IPHONE13 = {width: 390, height: 844};
const DESKTOP = {width: 1440, height: 900};

const TOP_RADIUS_RE = /^(\d+(?:\.\d+)?)px$/;

async function openUsersAddModal(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/admin/system/users');
    const trigger = page.getByTestId('users-create-button');
    await expect(trigger).toBeVisible({timeout: 20_000});
    await trigger.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({timeout: 10_000});
}

test.describe('feature — admin modal mobile placement', () => {
    test('mobile: Users "Add user" modal renders as a bottom-sheet', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: IPHONE13,
            hasTouch: true,
            isMobile: true,
        });
        const page = await ctx.newPage();
        try {
            await openUsersAddModal(page);

            const modal = page.locator('.ant-modal').first();
            const content = page.locator('.ant-modal-content').first();

            const modalBox = await modal.boundingBox();
            const contentBox = await content.boundingBox();
            expect(modalBox).not.toBeNull();
            expect(contentBox).not.toBeNull();

            // Bottom of the modal sits at the viewport bottom (allow ~10px
            // tolerance for sub-pixel rounding / safe-area-inset).
            expect(Math.abs((modalBox!.y + modalBox!.height) - IPHONE13.height))
                .toBeLessThanOrEqual(10);

            // Full viewport width.
            expect(Math.abs(modalBox!.width - IPHONE13.width)).toBeLessThanOrEqual(2);

            // Rounded top corners (16px in CSS).
            const topLeft = await content.evaluate(el => getComputedStyle(el).borderTopLeftRadius);
            const topRight = await content.evaluate(el => getComputedStyle(el).borderTopRightRadius);
            const tl = Number(TOP_RADIUS_RE.exec(topLeft)?.[1] ?? '0');
            const tr = Number(TOP_RADIUS_RE.exec(topRight)?.[1] ?? '0');
            expect(tl).toBeGreaterThan(0);
            expect(tr).toBeGreaterThan(0);
        } finally {
            await ctx.close();
        }
    });

    test('desktop: Users "Add user" modal is centered, not full-width', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: DESKTOP,
        });
        const page = await ctx.newPage();
        try {
            await openUsersAddModal(page);

            const modal = page.locator('.ant-modal').first();
            const box = await modal.boundingBox();
            expect(box).not.toBeNull();

            // Standard AntD modal default width is 520; in any case it should
            // be far narrower than the viewport, with horizontal margin on
            // both sides.
            expect(box!.width).toBeLessThan(DESKTOP.width - 100);
            expect(box!.x).toBeGreaterThan(20);
            expect((DESKTOP.width - (box!.x + box!.width))).toBeGreaterThan(20);
        } finally {
            await ctx.close();
        }
    });
});
