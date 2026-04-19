import {useEffect} from 'react';
import SiteFlagsApi from '../../api/SiteFlagsApi';
import ThemeApi from '../../api/ThemeApi';
import {applyThemeCssVars} from '../../theme/applyThemeCssVars';
import {refreshBus} from '../../lib/refreshBus';

/**
 * When `siteFlags.autoHighContrast` is on and the browser reports
 * `prefers-contrast: more` (or the narrower `forced-colors: active`),
 * swap in the registered `high-contrast` theme for this visitor — every
 * other visitor keeps whatever the site owner configured as the active
 * theme, so this is purely additive.
 *
 * Stays a dumb effect — no UI. Lives under `common/` because it runs for
 * every visitor, not just admins.
 *
 * Design decisions:
 *   - The detector only **re-applies** tokens; it doesn't mutate the
 *     server-side active theme. That keeps the admin's "Set active" choice
 *     authoritative and makes the contrast pick a per-visitor override.
 *   - `prefers-contrast: more` fires on macOS "Increase contrast" and
 *     Windows "Turn on high contrast" before `forced-colors` does, so we
 *     listen to both and OR them.
 *   - If the media match flips back to `no-preference` we do nothing —
 *     a full page navigation will re-apply the site-wide active theme on
 *     mount. Swapping back inline would require caching the previous
 *     tokens, which we don't; editors hit this path rarely enough that
 *     the reload cost is fine.
 */
export function HighContrastAutoPick(): null {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const flagsApi = new SiteFlagsApi();
        const themeApi = new ThemeApi();
        let cancelled = false;
        let mqlList: MediaQueryList[] = [];

        const evaluate = async () => {
            const flags = await flagsApi.get();
            if (cancelled) return;
            if (!flags.autoHighContrast) return;

            const anyMatch = mqlList.some(m => m.matches);
            if (!anyMatch) return;

            const themes = await themeApi.listThemes();
            const hc = themes.find(t => (t as any).slug === 'high-contrast');
            if (!hc || cancelled) return;
            applyThemeCssVars((hc as any).tokens);
        };

        try {
            mqlList = [
                window.matchMedia('(prefers-contrast: more)'),
                window.matchMedia('(forced-colors: active)'),
            ];
        } catch { /* noop */ }

        void evaluate();
        const mqlHandler = () => void evaluate();
        mqlList.forEach(m => m.addEventListener?.('change', mqlHandler));
        const off = refreshBus.subscribe(evaluate, 'settings');

        return () => {
            cancelled = true;
            mqlList.forEach(m => m.removeEventListener?.('change', mqlHandler));
            off();
        };
    }, []);

    return null;
}

export default HighContrastAutoPick;
