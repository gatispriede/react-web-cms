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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cosmos = require('./samples-media/cosmos1080p.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const coalescence = require('./samples-media/coalescence1080p.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const maya = require('./samples-media/maya21080p.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nanocyte = require('./samples-media/nanocyte1080p.jpg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deepblue = require('./samples-media/deepblue1080p.jpg');

/** Next's jpg require yields one of three shapes depending on loader +
 *  module interop: a plain string (old next-images loader), a
 *  `{src, height, width}` object (next/image StaticImport), or a CJS
 *  interop wrapper `{default: {src, …}}` (how TS compiles `import` to
 *  `require` under moduleResolution=node). Normalise every shape to a
 *  usable URL string. */
const toUrl = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
        const obj = v as {src?: unknown; default?: unknown};
        if (typeof obj.src === 'string') return obj.src;
        if (obj.default) return toUrl(obj.default);
    }
    return '';
};

/** Registry of `preview:<key>` tokens → runtime image URLs. */
export const SAMPLE_MEDIA_URLS: Record<string, string> = {
    'cosmos1080p': toUrl(cosmos),
    'coalescence1080p': toUrl(coalescence),
    'maya21080p': toUrl(maya),
    'nanocyte1080p': toUrl(nanocyte),
    'deepblue1080p': toUrl(deepblue),
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
