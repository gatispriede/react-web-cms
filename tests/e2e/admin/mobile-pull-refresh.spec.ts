import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Mobile pull-to-refresh on Inquiries
//
// `usePullToRefresh` wires touchstart/touchmove/touchend on the
// inquiries scroll container; pulling > 80 px past scrollTop:0
// triggers `vm.refresh()`, which fetches `GET /api/inquiries`.
// We assert the refetch fires after a synthetic touch gesture by
// counting `/api/inquiries` GETs before and after the gesture.
//
// Synthetic TouchEvent dispatch is brittle in headless Chromium —
// the hook re-binds its listeners on every distance change because
// of an inline closure dep, which can drop the touchmove that
// crosses the threshold. If the gesture path proves flaky on CI,
// see the `test.fixme` comment below.
// ──────────────────────────────────────────────────────────────────

const IPHONE13 = {width: 390, height: 844};

test.describe('feature — admin inquiries pull-to-refresh', () => {
    test('mobile: pulling the inquiries list past 80 px refetches /api/inquiries', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: IPHONE13,
            hasTouch: true,
            isMobile: true,
        });
        const page = await ctx.newPage();

        let inquiriesGets = 0;
        page.on('request', req => {
            if (req.method() === 'GET' && /\/api\/inquiries(?:\?|$)/.test(req.url())) {
                inquiriesGets += 1;
            }
        });

        try {
            await page.goto('/admin/system/inquiries');
            const target = page.getByTestId('inquiries-list-pull-refresh');
            await expect(target).toBeVisible({timeout: 20_000});

            // The initial mount issues `vm.refresh()` once; wait for that to
            // settle so our before/after delta is unambiguous.
            await page.waitForLoadState('networkidle');
            const before = inquiriesGets;

            // Synthesize a >80 px downward pull from y=50 → y=260 (≈210 px raw,
            // 84 px after the hook's 0.4 resistance multiplier — just over the
            // PULL_THRESHOLD_PX = 80 floor).
            await target.evaluate((el) => {
                const x = el.getBoundingClientRect().left + 50;
                const make = (type: string, y: number) => {
                    const t = new Touch({
                        identifier: 1,
                        target: el,
                        clientX: x,
                        clientY: y,
                        pageX: x,
                        pageY: y,
                    });
                    return new TouchEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        touches: type === 'touchend' ? [] : [t],
                        targetTouches: type === 'touchend' ? [] : [t],
                        changedTouches: [t],
                    });
                };
                el.dispatchEvent(make('touchstart', 50));
                el.dispatchEvent(make('touchmove', 150));
                el.dispatchEvent(make('touchmove', 260));
                el.dispatchEvent(make('touchend', 260));
            });

            // Allow the post-touchend microtask + fetch to fire.
            await page.waitForTimeout(500);
            await page.waitForLoadState('networkidle');

            expect(inquiriesGets).toBeGreaterThan(before);
        } finally {
            await ctx.close();
        }
    });

    // Skipped: TouchEvent / Touch constructor isn't available in every
    // Chromium build, and the hook's `useEffect([distance])` rebinds
    // listeners on each move — both make this flow legitimately
    // hard to drive from Playwright. Unit-level coverage of the hook
    // sits in vitest. Re-enable if the spec above proves stable.
    test.fixme('mobile: pull-to-refresh stress (multi-gesture)', async () => {
        // Intentional placeholder — see comment above.
    });
});
