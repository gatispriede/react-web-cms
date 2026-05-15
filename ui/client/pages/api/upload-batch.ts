/**
 * Bulk image upload (C3) — accepts multiple `file[]` parts plus a
 * `ratio` field (one of `free / 1:1 / 4:3 / 3:2 / 16:9`) and, optionally,
 * a JSON `tags` field. Also accepts a `urls` field (JSON array or
 * newline-separated) — the server fetches each URL and runs the same
 * pipeline. Admin-only (editor role), so the URL fetch is unguarded
 * beyond an http(s) scheme check + content-type/size sanity checks.
 *
 * Each input is:
 *   1. received into `public/temp/` (formidable for files, fetch-to-disk
 *      for urls),
 *   2. processed with sharp — `resize(cover, width?, height?)` to lock the
 *      aspect ratio, EXIF stripped, re-encoded jpeg/png (quality 82);
 *   3. written to `public/images/<safe-name>` (collision-safe suffix),
 *   4. registered via `assetService.saveImage` with the same shape as the
 *      single-file `/api/upload` endpoint.
 *
 * Unlike the single-file endpoint, this one NEVER aborts the batch on a
 * per-file error — each file's result is returned in a parallel array so
 * the admin UI can show per-file status. Same-name collisions get `-N`
 * appended instead of being rejected, which is the behaviour the single-
 * file handler regrets (see `upload.ts:80` — "Image already exists …"
 * breaks phone-batch uploads of `IMG_0001.jpg`).
 */
import * as Formidable from 'formidable';
import fs from "fs";
import path from "node:path";
import guid from "@utils/guid";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {InImage} from "@interfaces/IImage";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {ROLE_RANK, sessionFromReq} from "@services/features/Auth/authz";
import {optimizeImageFile, type RatioLock} from "@services/features/Assets/imageOptimize";
import {buildImageRecord} from "@services/infra/imageMetadata";
import {adminAuthOptions as authOptions} from "./auth/authOptions";

export const config = {
    api: {
        bodyParser: false,
        // Batch uploads routinely exceed the 4 MB default request body cap.
        // 80 MB covers a 30-image phone-shot batch with headroom; larger
        // batches should chunk.
        sizeLimit: false,
    }
};

type Ratio = RatioLock;

interface PerFileResult {
    ok: boolean;
    error?: string;
    image?: InImage;
    originalName?: string;
}

/**
 * Resolve a collision-free destination filename in `public/images/`.
 * Appends `-N` (numeric, starting at 1) until the target path is free.
 * Whitespace in the original is collapsed to `_`; the extension is
 * preserved as-is (sharp handles jpeg/png/webp transparently).
 */
const resolveUniqueName = (imagesDir: string, originalFilename: string): string => {
    const safe = originalFilename.replace(/\s+/g, '_');
    const ext = path.extname(safe);
    const stem = path.basename(safe, ext);
    let candidate = safe;
    let n = 1;
    while (fs.existsSync(path.join(imagesDir, candidate))) {
        candidate = `${stem}-${n}${ext}`;
        n += 1;
        if (n > 9999) throw new Error('collision resolver exhausted');
    }
    return candidate;
};

const handler = async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

    let session;
    try {
        session = await sessionFromReq(req, res, authOptions);
    } catch {
        return res.status(401).json({error: 'auth required'});
    }
    if (ROLE_RANK[session.role] < ROLE_RANK.editor) {
        return res.status(403).json({error: 'editor role required'});
    }

    const tempDir = path.join(process.cwd(), 'ui/client/', 'public/temp/');
    const imagesDir = path.join(process.cwd(), 'ui/client/', 'public/images/');
    fs.mkdirSync(tempDir, {recursive: true});
    fs.mkdirSync(imagesDir, {recursive: true});

    const form = new Formidable.IncomingForm({
        multiples: true,
        keepExtensions: true,
        uploadDir: tempDir,
        maxFileSize: 25 * 1024 * 1024,   // per-file
        maxTotalFileSize: 200 * 1024 * 1024,
    });

    const parsed = await new Promise<{fields: any; files: any}>((resolve, reject) => {
        form.parse(req, (err, fields, files) => err ? reject(err) : resolve({fields, files}));
    }).catch((err) => {
        console.error('upload-batch: parse failed', err);
        return null;
    });
    if (!parsed) return res.status(400).json({error: 'multipart parse failed'});

    const rawRatio = (parsed.fields?.ratio?.[0] ?? parsed.fields?.ratio ?? 'free') as Ratio;
    const ratio: Ratio = (['free', '1:1', '4:3', '3:2', '16:9'] as Ratio[]).includes(rawRatio) ? rawRatio : 'free';
    const rawTags = (() => {
        const v = parsed.fields?.tags?.[0] ?? parsed.fields?.tags;
        try { return JSON.parse(v) } catch { return [] }
    })();
    const tags = Array.isArray(rawTags) ? rawTags.filter(Boolean) : [];
    const withAll = tags.includes('All') ? tags : ['All', ...tags];

    const rawUrls = parsed.fields?.urls?.[0] ?? parsed.fields?.urls;
    const urlList: string[] = (() => {
        if (!rawUrls) return [];
        try {
            const j = JSON.parse(rawUrls);
            if (Array.isArray(j)) return j.map(String).map(s => s.trim()).filter(Boolean);
        } catch { /* fall through to newline split */ }
        return String(rawUrls).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    })();

    // Formidable gives us `files.file` as either an array or a single record
    // depending on count. Also accept `file[]` as the field name — browsers'
    // `FormData.append('file[]', …)` convention.
    const raw = parsed.files?.file ?? parsed.files?.['file[]'] ?? [];
    const fileList: any[] = Array.isArray(raw) ? raw : [raw];

    const results: PerFileResult[] = [];
    const mongo = getMongoConnection();

    for (const file of fileList) {
        const originalName: string | undefined = file?.originalFilename;
        try {
            if (!file || !originalName) {
                results.push({ok: false, error: 'missing file'});
                continue;
            }
            const targetName = resolveUniqueName(imagesDir, originalName);
            const destPath = path.join(imagesDir, targetName);

            // Shared pipeline (C2) — resize cap + ratio crop + recompress +
            // EXIF strip. Falls back to the original bytes if the optimised
            // output would be larger (already-compressed re-uploads).
            const result = await optimizeImageFile(file.filepath, destPath, {ratio});
            if (!result.readable) {
                // Corrupt / undecodable — don't leave the file or a DB row.
                try { fs.unlinkSync(destPath); } catch { /* best-effort */ }
                results.push({ok: false, error: 'unrecognised or corrupt image file', originalName});
                continue;
            }

            // Build the persisted record via the shared helper so the batch
            // endpoint writes the SAME shape as single-file `/api/upload` —
            // width/height/sizeBytes/originalName/uploadedBy/uploadedAt/
            // optimised/format all ride through to Mongo (write-through; the
            // GraphQL SDL exposure of them is a separate read-side migration).
            const image: InImage = buildImageRecord(result, {
                id: guid(),
                storedName: targetName,
                location: `${PUBLIC_IMAGE_PATH}${targetName}`,
                type: file.mimetype ?? 'image/*',
                tags: withAll,
                originalName,
                uploadedBy: session?.email,
                fallbackSize: file.size,
            });
            await mongo.assetService.saveImage(image);
            results.push({ok: true, image, originalName});
        } catch (e: any) {
            console.error('upload-batch: per-file failure', originalName, e?.message ?? e);
            results.push({ok: false, error: String(e?.message ?? e), originalName});
        } finally {
            // Always clean up the temp upload regardless of outcome.
            try { if (file?.filepath) fs.unlinkSync(file.filepath); } catch { /* already gone */ }
        }
    }

    // URL fetch pass — runs after files so per-batch ordering is files-first,
    // urls-after. Each URL writes to a temp file and reuses the same sharp
    // pipeline below. 25 MB cap mirrors the formidable per-file cap; we abort
    // any download that exceeds it instead of streaming forever.
    const URL_MAX_BYTES = 25 * 1024 * 1024;
    for (const url of urlList) {
        let originalName = '';
        let tempPath = '';
        try {
            let parsedUrl: URL;
            try { parsedUrl = new URL(url); }
            catch { results.push({ok: false, error: 'invalid url', originalName: url}); continue; }
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                results.push({ok: false, error: 'only http/https supported', originalName: url});
                continue;
            }

            const resp = await fetch(parsedUrl.toString(), {redirect: 'follow'});
            if (!resp.ok) {
                results.push({ok: false, error: `fetch ${resp.status}`, originalName: url});
                continue;
            }
            const ct = resp.headers.get('content-type') ?? '';
            if (!/^image\//i.test(ct)) {
                results.push({ok: false, error: `not an image (${ct || 'no content-type'})`, originalName: url});
                continue;
            }
            const lenHeader = resp.headers.get('content-length');
            if (lenHeader && Number(lenHeader) > URL_MAX_BYTES) {
                results.push({ok: false, error: `too large (${lenHeader} bytes)`, originalName: url});
                continue;
            }
            const buf = Buffer.from(await resp.arrayBuffer());
            if (buf.byteLength > URL_MAX_BYTES) {
                results.push({ok: false, error: `too large (${buf.byteLength} bytes)`, originalName: url});
                continue;
            }

            // Derive a sensible filename: prefer the URL's basename, fall back
            // to the content-type extension. Strip query strings / fragments.
            const extFromCt = (ct.split(';')[0].split('/')[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
            const urlBase = path.basename(parsedUrl.pathname) || `image-${guid().slice(0, 8)}.${extFromCt}`;
            originalName = urlBase.includes('.') ? urlBase : `${urlBase}.${extFromCt}`;

            tempPath = path.join(tempDir, `url-${guid()}-${originalName.replace(/\s+/g, '_')}`);
            fs.writeFileSync(tempPath, buf);

            const targetName = resolveUniqueName(imagesDir, originalName);
            const destPath = path.join(imagesDir, targetName);
            const result = await optimizeImageFile(tempPath, destPath, {ratio});
            if (!result.readable) {
                try { fs.unlinkSync(destPath); } catch { /* best-effort */ }
                results.push({ok: false, error: 'unrecognised or corrupt image file', originalName: url});
                continue;
            }

            // Same shared record shape as the file path above — the URL the
            // operator pasted is the `originalName` here.
            const image: InImage = buildImageRecord(result, {
                id: guid(),
                storedName: targetName,
                location: `${PUBLIC_IMAGE_PATH}${targetName}`,
                type: ct.split(';')[0] || 'image/*',
                tags: withAll,
                originalName: url,
                uploadedBy: session?.email,
                fallbackSize: buf.byteLength,
            });
            await mongo.assetService.saveImage(image);
            results.push({ok: true, image, originalName: url});
        } catch (e: any) {
            console.error('upload-batch: url fetch failure', url, e?.message ?? e);
            results.push({ok: false, error: String(e?.message ?? e), originalName: url});
        } finally {
            try { if (tempPath) fs.unlinkSync(tempPath); } catch { /* already gone */ }
        }
    }

    const okCount = results.filter(r => r.ok).length;
    return res.status(200).json({
        ratio,
        total: results.length,
        succeeded: okCount,
        failed: results.length - okCount,
        results,
    });
};

export default handler;
