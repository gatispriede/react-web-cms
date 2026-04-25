/**
 * Static image imports co-located with the modules-preview feature (C10).
 *
 * Next.js resolves each `import 'path/to/file.jpg'` as a static asset at
 * build time — the imported value is a URL string the browser can fetch.
 * Keeping these imports isolated from `samples.ts` means the plain-JSON
 * sample fixtures stay test-friendly (Jest doesn't have to teach Babel
 * how to load `.jpg`).
 *
 * Sample JSON strings use tokens like `preview:cosmos1080p`; the preview
 * renderer calls `resolveSampleMedia()` to swap those for real URLs just
 * before rendering a module's `Display`.
 */
/** Sample images live under `public/preview-samples/` so Next.js serves
 *  them as static assets at a stable URL — bare `require('./img.jpg')`
 *  paths under `ui/client/lib/...` aren't picked up by Next's webpack
 *  as static assets, which is what produced the broken-image icons in
 *  the modules-preview screen. Public-dir paths Just Work in dev,
 *  prod and SSG, and stay portable for tests too (the URL string is
 *  inert outside the browser). Originals also remain in
 *  `samples-media/` for reference / future loader changes. */

/** Registry of `preview:<key>` tokens → runtime image URLs. */
export const SAMPLE_MEDIA_URLS: Record<string, string> = {
    'cosmos1080p': '/preview-samples/cosmos1080p.jpg',
    'coalescence1080p': '/preview-samples/coalescence1080p.jpg',
    'maya21080p': '/preview-samples/maya21080p.jpg',
    'nanocyte1080p': '/preview-samples/nanocyte1080p.jpg',
    'deepblue1080p': '/preview-samples/deepblue1080p.jpg',
};

const TOKEN_PREFIX = 'preview:';

/**
 * Walk a sample content JSON string and swap every `preview:<key>` value
 * for its real URL. Runs before the rendered module sees its `content` —
 * keeps the fixtures in `samples.ts` portable across Node/Jest/browser,
 * and lets operators swap the backing images by editing this one file.
 */
export function resolveSampleMedia(contentJson: string): string {
    if (!contentJson.includes(TOKEN_PREFIX)) return contentJson;
    try {
        const parsed = JSON.parse(contentJson);
        const swapped = walkAndReplace(parsed);
        return JSON.stringify(swapped);
    } catch {
        return contentJson;
    }
}

function walkAndReplace(v: unknown): unknown {
    if (typeof v === 'string' && v.startsWith(TOKEN_PREFIX)) {
        const key = v.slice(TOKEN_PREFIX.length);
        return SAMPLE_MEDIA_URLS[key] ?? v;
    }
    if (Array.isArray(v)) return v.map(walkAndReplace);
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            out[k] = walkAndReplace(val);
        }
        return out;
    }
    return v;
}
