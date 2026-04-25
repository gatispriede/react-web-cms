import fs from "node:fs";
import path from "node:path";
import type {NextApiRequest, NextApiResponse} from "next";

/**
 * Dev-mode (and production-safe-fallback) image fetcher.
 *
 * The legacy app stored `IImage.location = 'api/<file>.<ext>'` in Mongo,
 * so saved content references like `api/IMG_20250613.jpg` are baked into
 * existing data. In production Caddy intercepts those requests via the
 * `@legacyApiImages` matcher (see infra/Caddyfile) and serves them
 * directly from `/srv/uploads/images/`, never reaching this handler.
 *
 * Locally there's no Caddy in front of `next dev`, so without a route
 * here the browser receives Next's HTML 404 page in place of the bytes
 * — visible as `text/html` rows in the network panel and broken thumbs
 * in the image picker. This route patches that gap by streaming the
 * file from `ui/client/public/images/`.
 *
 * Restricted to image extensions so it can't be used as a path-traversal
 * read primitive against the rest of the public dir. `path.basename`
 * strips any directory traversal characters even before that check.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

const MIME: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
};

export const config = {
    api: {
        // Streaming the body — no parser needed.
        bodyParser: false,
    },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).end();
    }
    const raw = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
    if (!raw) return res.status(404).end();
    // `path.basename` collapses any traversal segments (`../`) to the
    // tail, so a malicious `?name=../../etc/passwd` resolves to `passwd`
    // and the extension guard then rejects it.
    const safe = path.basename(String(raw));
    if (!IMAGE_EXT.test(safe)) return res.status(404).end();

    const file = path.join(process.cwd(), 'ui/client/public/images', safe);
    fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) return res.status(404).end();
        const ext = path.extname(safe).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(stat.size));
        // Cheap freshness signal so the picker doesn't refetch every tile
        // on each Fast Refresh cycle in dev.
        res.setHeader('Cache-Control', 'public, max-age=300');
        if (req.method === 'HEAD') return res.status(200).end();
        fs.createReadStream(file).pipe(res);
    });
}
