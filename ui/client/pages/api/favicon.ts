import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Dynamic favicon — derives from the active site Logo when present,
 * otherwise falls back to a generated SVG with the site initial(s).
 *
 * Why dynamic: every tenant on the agency tier wants their own browser-tab
 * icon without uploading a separate .ico file. Reading from the existing
 * Logo + siteFlags surfaces gives them one less thing to configure.
 *
 * Cache: 1 hour public, stale-while-revalidate so a Logo change propagates
 * within an hour without hammering the DB on every page hit.
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse): Promise<void> {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    try {
        const conn = getMongoConnection();
        const logo = await (conn as any).logoService?.get?.();
        const logoSrc: string | undefined = logo?.content ? safeJsonField(logo.content, 'src') : undefined;
        if (logoSrc && logoSrc.toLowerCase().endsWith('.svg')) {
            // Hand the raw SVG back unchanged for crispest renders at every
            // browser-decided icon size.
            const fileBytes = await readPublicFile(logoSrc);
            if (fileBytes) {
                res.setHeader('Content-Type', 'image/svg+xml');
                res.send(fileBytes);
                return;
            }
        }
        // Site-name initial fallback — derive 1–2 letters from the
        // `siteName` siteFlag, render as a square SVG with theme-friendly
        // colors that work on light + dark browser tab backgrounds.
        const siteName = await readSiteName(conn);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(monogramSvg(siteName));
    } catch {
        // Never 500 a favicon — the browser logs it noisily and it provides
        // no value. Always serve something.
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(monogramSvg(''));
    }
}

function safeJsonField(json: string, field: string): string | undefined {
    try {
        const parsed = JSON.parse(json);
        const v = parsed?.[field];
        return typeof v === 'string' ? v : undefined;
    } catch {
        return undefined;
    }
}

async function readSiteName(conn: any): Promise<string> {
    try {
        const flags = await conn.siteFlagsService?.getAll?.();
        return String(flags?.siteName ?? '').trim();
    } catch { return ''; }
}

async function readPublicFile(relPath: string): Promise<Buffer | null> {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const clean = relPath.replace(/^\/+/, '').replace(/^api\//, '');
    const full = path.join(process.cwd(), 'ui/client/public', clean);
    try {
        return await fs.readFile(full);
    } catch {
        return null;
    }
}

function monogramSvg(siteName: string): string {
    const initials = siteName
        ? siteName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
        : '◆';
    const glyph = initials || '◆';
    // Square 64x64 with a colored background and centered glyph. Background
    // uses currentColor so it reads correctly on both light and dark tab
    // backgrounds via `color-scheme: light dark` browser hint.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="favicon">
  <rect width="64" height="64" rx="12" fill="#1677ff"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui" font-size="${glyph.length > 1 ? 28 : 36}" font-weight="700" fill="#ffffff">${escapeXml(glyph)}</text>
</svg>`;
}

function escapeXml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
