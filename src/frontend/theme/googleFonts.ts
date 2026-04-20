import googleFontsCatalogue from '../data/google-fonts.json';

export interface IGoogleFont {
    family: string;
    category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
    variants: string[];
    subsets: string[];
}

interface IGoogleFontsCatalogue {
    fonts: IGoogleFont[];
}

export const GOOGLE_FONTS: IGoogleFont[] = (googleFontsCatalogue as unknown as IGoogleFontsCatalogue).fonts;

const GOOGLE_FAMILY_INDEX: Map<string, IGoogleFont> = new Map(
    GOOGLE_FONTS.map(f => [f.family.toLowerCase(), f]),
);

/**
 * Pull the first quoted family name out of a CSS font-family stack — that's
 * the slot's primary face (the rest is fallback). Returns `null` for stacks
 * with no quoted leading family (system-only stacks like `system-ui, sans-serif`).
 */
export function extractFontFamily(stack: string | undefined | null): string | null {
    if (!stack) return null;
    const m = stack.match(/^\s*['"]([^'"]+)['"]/);
    return m ? m[1].trim() : null;
}

/** Sensible CSS fallback chain for each Google-Fonts category. */
const FALLBACK_BY_CATEGORY: Record<IGoogleFont['category'], string> = {
    'sans-serif': `system-ui, -apple-system, 'Segoe UI', sans-serif`,
    serif: `ui-serif, Georgia, 'Times New Roman', serif`,
    display: `system-ui, -apple-system, 'Segoe UI', sans-serif`,
    handwriting: `cursive, system-ui, sans-serif`,
    monospace: `ui-monospace, 'SF Mono', Menlo, monospace`,
};

/** Build the canonical CSS font-family string for a picked Google family. */
export function buildFontStack(family: string): string {
    const meta = GOOGLE_FAMILY_INDEX.get(family.toLowerCase());
    const fallback = meta ? FALLBACK_BY_CATEGORY[meta.category] : `system-ui, sans-serif`;
    return `'${family}', ${fallback}`;
}

/**
 * Build the `https://fonts.googleapis.com/css2?…&display=swap` URL for the
 * supplied family list. Each entry is matched against the local catalogue so
 * we can request only the variants that family actually publishes (avoids
 * 400s for nonexistent weights). Unknown families fall back to `wght@400;700`
 * so a runtime-typed value still loads something usable.
 *
 * When `selfHost` is true, emits the same params against our local proxy
 * at `/api/fonts/css` instead — the proxy fetches from Google server-side
 * and rewrites gstatic URLs in the CSS body, so the visitor's browser
 * never talks to Google and their IP stays out of Google's logs.
 */
export function buildGoogleFontsUrl(
    families: Array<string | null | undefined>,
    opts: {selfHost?: boolean} = {},
): string | null {
    const seen = new Set<string>();
    const params: string[] = [];
    for (const raw of families) {
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const meta = GOOGLE_FAMILY_INDEX.get(key);
        const variants = meta?.variants?.length ? meta.variants : ['400', '700'];
        const family = (meta?.family ?? raw).replace(/\s+/g, '+');

        const italicWeights = variants
            .filter(v => v.endsWith('italic'))
            .map(v => parseInt(v, 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
        const uprightWeights = variants
            .filter(v => !v.endsWith('italic'))
            .map(v => parseInt(v, 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        if (italicWeights.length > 0) {
            // Google Fonts CSS2: ital,wght axis pairs — 0=upright, 1=italic.
            // Pairs must be sorted first by ital then by wght.
            const pairs = [
                ...uprightWeights.map(w => `0,${w}`),
                ...italicWeights.map(w => `1,${w}`),
            ].join(';');
            params.push(`family=${family}:ital,wght@${pairs}`);
        } else {
            // Upright-only — simpler wght@ form.
            const weights = uprightWeights.join(';');
            params.push(`family=${family}:wght@${weights}`);
        }
    }
    if (params.length === 0) return null;
    const base = opts.selfHost ? '/api/fonts/css' : 'https://fonts.googleapis.com/css2';
    return `${base}?${params.join('&')}&display=swap`;
}
