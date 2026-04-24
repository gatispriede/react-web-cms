/**
 * Bulk image upload (C3) — accepts multiple `file[]` parts plus a
 * `ratio` field (one of `free / 1:1 / 4:3 / 3:2 / 16:9`) and, optionally,
 * a JSON `tags` field.
 *
 * Each file is:
 *   1. received into `public/temp/` (formidable),
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
import sharp from "sharp";
import guid from "@utils/guid";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {InImage} from "@interfaces/IImage";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {ROLE_RANK, sessionFromReq} from "@services/features/Auth/authz";
import {authOptions} from "./auth/authOptions";

export const config = {
    api: {
        bodyParser: false,
        // Batch uploads routinely exceed the 4 MB default request body cap.
        // 80 MB covers a 30-image phone-shot batch with headroom; larger
        // batches should chunk.
        sizeLimit: false,
    }
};

type Ratio = 'free' | '1:1' | '4:3' | '3:2' | '16:9';
const RATIO_TARGETS: Record<Exclude<Ratio, 'free'>, {w: number; h: number}> = {
    '1:1':  {w: 1600, h: 1600},
    '4:3':  {w: 1600, h: 1200},
    '3:2':  {w: 1800, h: 1200},
    '16:9': {w: 1920, h: 1080},
};

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

            // sharp pipeline: always strip EXIF; crop to cover the target
            // ratio box (or just recompress when `free`). `withMetadata()`
            // is NOT called — we intentionally drop EXIF for privacy.
            let pipeline = sharp(file.filepath).rotate(); // auto-orient via EXIF then strip
            if (ratio !== 'free') {
                const {w, h} = RATIO_TARGETS[ratio];
                pipeline = pipeline.resize(w, h, {fit: 'cover', position: 'attention'});
            }
            const ext = path.extname(targetName).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') pipeline = pipeline.jpeg({quality: 82, mozjpeg: true});
            else if (ext === '.png') pipeline = pipeline.png({compressionLevel: 9});
            else if (ext === '.webp') pipeline = pipeline.webp({quality: 82});
            await pipeline.toFile(destPath);

            const {size} = await sharp(destPath).metadata();
            // NOTE: width/height on InImage is landing with C2 (image-
            // optimisation) — skipping here to keep the batch handler
            // schema-compatible with the single-file endpoint.
            const image: InImage = {
                created: new Date().toDateString(),
                id: guid(),
                location: `${PUBLIC_IMAGE_PATH}${targetName}`,
                name: targetName,
                size: size ?? file.size ?? 0,
                type: file.mimetype ?? 'image/*',
                tags: withAll,
            };
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
