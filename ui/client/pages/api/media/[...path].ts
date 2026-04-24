import fs from 'fs';
import path from 'path';
import type {NextApiRequest, NextApiResponse} from 'next';

// Streams uploaded assets from disk at request time. Next's static `public/`
// folder is snapshotted at build time, so files added later via the
// `uploads/*` bind-mount (runtime-uploaded images, admin-swapped logos,
// whatever lives under `/images/` or `/uploads/`) won't be served by the
// built-in static handler. This route bypasses that — path is resolved under
// PUBLIC_ROOT at request time and streamed.

const PUBLIC_ROOT = path.resolve(process.cwd(), 'ui/client/public');

const MIME: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.avif': 'image/avif', '.json': 'application/json',
};

export const config = {api: {bodyParser: false}};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const parts = req.query.path;
    const rel = Array.isArray(parts) ? parts.join('/') : String(parts ?? '');
    const resolved = path.resolve(PUBLIC_ROOT, rel);
    if (!resolved.startsWith(PUBLIC_ROOT + path.sep)) {
        return res.status(400).end('bad path');
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return res.status(404).end('not found');
    }
    const ext = path.extname(resolved).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(resolved).pipe(res);
}
