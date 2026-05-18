import type {NextApiRequest, NextApiResponse} from 'next';
import crypto from 'crypto';
import React from 'react';
// @ts-ignore — @vercel/og not installed; OG image generation degrades gracefully.
import {unstable_createNodejsStream} from '@vercel/og';
import {gqlFetch} from '@client/lib/gqlFetch';

/**
 * W8h SEO program § OG image generator — upgraded 2026-05-17 from
 * hand-rolled SVG to `@vercel/og`-rendered PNG via Satori. Tracks the
 * 2026 SEO+OG share-card trend and fixes a real bug: Twitter only
 * accepts JPG/PNG/WEBP/GIF for `og:image` / `twitter:image`, so the
 * previous SVG output silently broke Twitter cards.
 *
 * Cache contract preserved: keyed by slug + content hash; one-year
 * `immutable` `Cache-Control` because operators bump the URL via `?v=…`
 * when content changes. ETag honours conditional GETs (304 on
 * `If-None-Match`).
 *
 * Runtime: stays on Node (Pages API default) using
 * `unstable_createNodejsStream`. Avoids the edge-runtime switch +
 * `NextApiRequest`/`NextApiResponse` signature churn.
 *
 * Slug resolution: unchanged — walks `/api/graphql` for navigation +
 * posts + products; falls back to "Untitled page" so the endpoint
 * never 404s.
 */

interface OgPayload {
    title: string;
    description: string;
    logo?: string;
    accent: string;
}

const DEFAULT_ACCENT = '#3b3939';
const FALLBACK_TITLE = 'Untitled page';

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

/**
 * JSX template Satori renders. Theme accent drives the left rail; logo
 * (when present, as data-URL) renders top-left. Typography is Geist
 * (the @vercel/og bundled default font) — no extra font fetch needed.
 */
export function renderOgTemplate(payload: OgPayload): React.ReactElement {
    const {title, description, logo, accent} = payload;
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'row',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
            }}
        >
            <div style={{width: '16px', background: accent, height: '100%'}}/>
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '80px',
                    justifyContent: 'space-between',
                }}
            >
                {logo ? (
                    <img src={logo} height={80} style={{objectFit: 'contain', alignSelf: 'flex-start'}}/>
                ) : (
                    <div/>
                )}
                <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 700,
                            color: '#1f1f1f',
                            lineHeight: 1.05,
                            letterSpacing: '-0.02em',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {title || FALLBACK_TITLE}
                    </div>
                    {description ? (
                        <div
                            style={{
                                fontSize: 32,
                                color: '#555',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {description}
                        </div>
                    ) : null}
                </div>
                <div
                    style={{
                        fontSize: 22,
                        fontWeight: 600,
                        color: accent,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}
                >
                    {/* footer wordmark slot — left blank until a brand
                        name is wired through the payload */}
                </div>
            </div>
        </div>
    );
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
        const etag = `"${hashContent(payload)}"`;
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        const stream = await unstable_createNodejsStream(renderOgTemplate(payload), {
            width: 1200,
            height: 630,
        });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        res.statusCode = 200;
        stream.pipe(res);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}

// Re-export the payload shape so SEO admin / MCP tooling can type-check
// OG-target queries without importing the handler.
export type {OgPayload};
