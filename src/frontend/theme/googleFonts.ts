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
 */
export function buildGoogleFontsUrl(families: Array<string | null | undefined>): string | null {
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
        // css2 wants weights ascending; sort numerically so 400 < 500 < 700.
        const weights = [...variants].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).join(';');
        params.push(`family=${family}:wght@${weights}`);
    }
    if (params.length === 0) return null;
    return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
