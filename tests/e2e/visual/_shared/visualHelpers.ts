import {Page, Locator} from '@playwright/test';

/**
 * Shared helpers for `tests/e2e/visual/` specs.
 *
 * Determinism is the whole game here — anything that can vary frame-to-frame
 * (font load timing, network image decode, animations, "X minutes ago"
 * timestamps) gets neutralised before `toHaveScreenshot()` fires.
 */

/** Wait for fonts + lazy images to finish loading before capture. */
export async function waitForVisualReady(page: Page): Promise<void> {
    // `document.fonts.ready` resolves once all CSS-declared fonts have
    // either loaded or failed. Without this, the first screenshot in a
    // suite catches a flash of fallback-font glyph metrics.
    await page.evaluate(async () => {
        if ('fonts' in document) {
            try {
                await (document as any).fonts.ready;
            } catch {
                // older browsers — best-effort, fall through.
            }
        }
        // Force every <img> to settle. `decode()` rejects for broken sources;
        // ignore those so a missing fixture image doesn't kill the whole spec.
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
    });
    // One additional rAF tick so any decode-driven layout shift settles
    // before we click the shutter.
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => r(true))));
}

/**
 * Selectors that contain wall-clock-driven text or volatile content.
 * Pass the result as `mask` to `toHaveScreenshot()` so the differ ignores
 * these regions instead of comparing pixels there.
 */
export function maskVolatile(page: Page): Locator[] {
    return [
        // "Updated 3 minutes ago" — relative timestamps.
        page.locator('[data-volatile="time"]'),
        // Build SHA badges (next.config.js bakes the short SHA in).
        page.locator('[data-build-id]'),
        // Order numbers / IDs that are uuid-shaped.
        page.locator('[data-volatile="id"]'),
    ];
}

/** Build a `/dev/visual` URL with the given params. */
export function visualSlotUrl(opts: {
    type: string;
    editor?: boolean;
    style?: string;
    sample?: number;
    lang?: string;
    /** First-class theme slug — applies `[data-theme-name="<slug>"]` to the
     *  slot wrapper so the per-theme SCSS layer (editorial, agency,
     *  commerce) cascades over the module. Used by
     *  `tests/e2e/visual/themes/<slug>.spec.ts`. */
    theme?: string;
}): string {
    const params = new URLSearchParams();
    params.set('type', opts.type);
    if (opts.editor) params.set('editor', '1');
    if (opts.style) params.set('style', opts.style);
    if (typeof opts.sample === 'number') params.set('sample', String(opts.sample));
    if (opts.theme) params.set('theme', opts.theme);
    // `/dev/visual` lives at the i18n default locale (en) without the prefix;
    // pass `lang` if you need a non-default locale to drive a translated
    // copy variant. Most module Display components are locale-neutral so the
    // default works for the overwhelming majority of baselines.
    const lang = opts.lang;
    const base = lang ? `/${lang}/dev/visual` : '/dev/visual';
    return `${base}?${params.toString()}`;
}
