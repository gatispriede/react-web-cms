import type {NextApiRequest, NextApiResponse} from 'next';
import crypto from 'crypto';
import {gqlFetch} from '@client/lib/gqlFetch';

/**
 * W8h SEO program § OG image generator (deferred bit).
 *
 * Serves a 1200×630 social card per slug. Uses SVG (zero runtime deps —
 * `@vercel/og` + `satori` both pull WASM/font binaries we don't need yet)
 * with the site logo + title + description + theme accent colour baked in.
 * Browsers + crawlers render SVG fine for `og:image` / `twitter:image`,
 * and Twitter accepts SVG when served with the right MIME type.
 *
 * Cache contract: keyed by slug + content hash; we emit an `immutable`
 * one-year `Cache-Control` because the URL itself includes the title
 * hash (`?v=…` query param) — operators bump the URL when content changes
 * via the same hash they'd compute server-side.
 *
 * Slug resolution: walks `/api/graphql` once to find the page/post/product
 * with the matching slug + title; falls back to "Untitled" when nothing
 * matches so the endpoint never 404s on a typo.
 *
 * URL shape: `/api/og/<slug...>` — accepts any depth (`/api/og/blog/foo`)
 * because Next maps `[...slug]` to an array. The trailing segment is
 * treated as the page slug; earlier segments are treated as a feature
 * hint (`blog` / `products`) and used to narrow lookup.
 */

interface OgPayload {
    title: string;
    description: string;
    logo?: string;
    accent: string;
}

const DEFAULT_ACCENT = '#3b3939';
const FALLBACK_TITLE = 'Untitled page';

function escapeSvg(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function wrap(text: string, max: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
        if ((current + ' ' + w).trim().length > max) {
            if (current) lines.push(current);
            current = w;
        } else {
            current = (current + ' ' + w).trim();
        }
        if (lines.length >= 4) break;
    }
    if (current && lines.length < 4) lines.push(current);
    return lines;
}

export function renderOgSvg(payload: OgPayload): string {
    const title = escapeSvg(payload.title || FALLBACK_TITLE);
    const description = escapeSvg(payload.description || '');
    const accent = payload.accent || DEFAULT_ACCENT;
    const titleLines = wrap(title, 32);
    const descLines = description ? wrap(description, 60).slice(0, 2) : [];
    const logoBlock = payload.logo
        ? `<image href="${escapeSvg(payload.logo)}" x="80" y="80" height="80" preserveAspectRatio="xMinYMin meet"/>`
        : '';
    const titleTSpans = titleLines
        .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 84}">${line}</tspan>`)
        .join('');
    const descTSpans = descLines
        .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 40}">${line}</tspan>`)
        .join('');
    const titleStartY = 280;
    const descStartY = titleStartY + titleLines.length * 84 + 40;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f0f0f0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="16" height="630" fill="${escapeSvg(accent)}"/>
  ${logoBlock}
  <text x="80" y="${titleStartY}" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="72" font-weight="700" fill="#1f1f1f">${titleTSpans}</text>
  <text x="80" y="${descStartY}" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="32" fill="#555555">${descTSpans}</text>
  <text x="80" y="580" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="22" fill="${escapeSvg(accent)}" font-weight="600">${escapeSvg(payload.logo ? '' : '')}</text>
</svg>`;
}

function hashContent(payload: OgPayload): string {
    const h = crypto.createHash('sha1');
    h.update(JSON.stringify(payload));
    return h.digest('hex').slice(0, 12);
}

async function resolvePayload(slugSegments: string[]): Promise<OgPayload> {
    const slug = slugSegments[slugSegments.length - 1] ?? '';
    const feature = slugSegments.length > 1 ? slugSegments[0] : '';
    try {
        const data = await gqlFetch<{mongo: {
            getNavigationCollection: Array<{page: string; slug?: any; seo?: {title?: string; description?: string; image?: string}}>;
            getPosts: string;
            getProducts: string;
            getLogo: string;
            getActiveTheme: string | null;
        }}>(
            `{ mongo { getNavigationCollection { id page slug seo } getPosts(limit: 500) getProducts getLogo getActiveTheme } }`,
        );
        const m = data?.mongo;
        let title = '';
        let description = '';
        if (feature === 'blog' && m?.getPosts) {
            try {
                const posts = JSON.parse(m.getPosts) as Array<{slug?: string; title?: string; excerpt?: string; coverImage?: string}>;
                const found = posts.find((p) => p.slug === slug);
                if (found) {
                    title = found.title ?? '';
                    description = found.excerpt ?? '';
                }
            } catch { /* tolerate */ }
        }
        if (!title && feature === 'products' && m?.getProducts) {
            try {
                const products = JSON.parse(m.getProducts) as Array<{slug?: string; name?: string; description?: string}>;
                const found = products.find((p) => (p.slug ?? p.name) === slug);
                if (found) {
                    title = found.name ?? '';
                    description = found.description ?? '';
                }
            } catch { /* tolerate */ }
        }
        if (!title && Array.isArray(m?.getNavigationCollection)) {
            const found = m.getNavigationCollection.find((n) => {
                const s = typeof n.slug === 'string' ? n.slug : (n.slug && typeof n.slug === 'object' ? Object.values(n.slug)[0] : '');
                return s === slug || n.page === slug;
            });
            if (found) {
                title = found.seo?.title || found.page;
                description = found.seo?.description || '';
            }
        }
        let logo: string | undefined;
        try {
            if (m?.getLogo) {
                const raw = JSON.parse(m.getLogo);
                logo = typeof raw?.content === 'string' && raw.content.startsWith('data:') ? raw.content : undefined;
            }
        } catch { /* tolerate */ }
        let accent = DEFAULT_ACCENT;
        try {
            if (m?.getActiveTheme) {
                const t = JSON.parse(m.getActiveTheme);
                if (typeof t?.tokens?.colorPrimary === 'string') accent = t.tokens.colorPrimary;
            }
        } catch { /* tolerate */ }
        return {title: title || FALLBACK_TITLE, description, logo, accent};
    } catch {
        return {title: FALLBACK_TITLE, description: '', accent: DEFAULT_ACCENT};
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const raw = req.query.slug;
        const segments: string[] = Array.isArray(raw) ? raw : (raw ? [String(raw)] : []);
        if (segments.length === 0) {
            res.status(400).json({error: 'slug required'});
            return;
        }
        const payload = await resolvePayload(segments);
        const svg = renderOgSvg(payload);
        const etag = `"${hashContent(payload)}"`;
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        res.status(200).send(svg);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
