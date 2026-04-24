/**
 * Shared image-optimisation pipeline (C2).
 *
 * Called from `/api/upload` (single-file) and `/api/upload-batch`. Produces
 * a resized / recompressed / EXIF-stripped buffer plus the dimensions and
 * size of the output.
 *
 * Design decisions kept deliberately defensive:
 *
 * - **1920 px max edge** — the longest-edge cap covers every public-site
 *   layout up to 2× retina and keeps disk under control. `withoutEnlargement`
 *   means originals smaller than 1920 are never scaled up.
 * - **Format-preserving recompress** — JPEG → mozjpeg q82 progressive, PNG
 *   keeps its format (alpha survives), WebP → q82. GIF/SVG aren't touched
 *   by the sharp pipeline and are passed through unchanged.
 * - **Size guard** — if the "optimised" output is larger than the input
 *   (which happens with already-optimised assets re-uploaded), the original
 *   bytes win. `width` / `height` are still read from the original so
 *   downstream consumers get real dimensions either way.
 * - **Optional aspect-ratio lock** — when passed, the cover-crop happens
 *   inside the same pipeline (this is what the batch endpoint relies on).
 * - **EXIF is dropped on purpose** — sharp drops metadata by default when
 *   re-encoding. We only call `.rotate()` first so EXIF orientation is
 *   baked into pixels before the tag is discarded.
 *
 * This module intentionally does NOT write files to disk or call the DB.
 * Callers handle I/O + persistence — keeps the helper unit-testable
 * against in-memory buffers.
 */
import sharp, {type Sharp} from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

export type RatioLock = 'free' | '1:1' | '4:3' | '3:2' | '16:9';

const RATIO_TARGETS: Record<Exclude<RatioLock, 'free'>, {w: number; h: number}> = {
    '1:1':  {w: 1600, h: 1600},
    '4:3':  {w: 1600, h: 1200},
    '3:2':  {w: 1800, h: 1200},
    '16:9': {w: 1920, h: 1080},
};

const MAX_EDGE = 1920;
const JPEG_QUALITY = 78;
const WEBP_QUALITY = 82;

export interface OptimizeOptions {
    /** Optional aspect-ratio lock — applies before the general resize cap. */
    ratio?: RatioLock;
}

export interface OptimizeResult {
    /** Output bytes to persist. */
    buffer: Buffer;
    /** Final width (of the output buffer). `undefined` when sharp can't read the format. */
    width?: number;
    height?: number;
    /** Final size in bytes (= `buffer.byteLength`). */
    size: number;
    /** Input MIME as sharp sees it (jpeg/png/webp/…); `null` for unreadable. */
    format?: string | null;
    /** True when the optimised path was smaller than the original, so we used it.
     *  False means the original was kept verbatim (size guard tripped). */
    optimised: boolean;
}

/**
 * Apply the shared pipeline to a buffer. The helper is pure — no FS, no DB.
 *
 * Unreadable formats (GIF pre-0.33, SVG, HEIC without plugin, corrupt data)
 * fall through as pass-through: the original buffer is returned along with
 * whatever metadata sharp could read (possibly none).
 */
export async function optimizeImageBuffer(input: Buffer, opts: OptimizeOptions = {}): Promise<OptimizeResult> {
    let meta: sharp.Metadata | null = null;
    try { meta = await sharp(input).metadata(); }
    catch { /* unreadable by sharp — pass through */ }

    if (!meta || !meta.format) {
        return {buffer: input, size: input.byteLength, optimised: false, format: null};
    }

    // Formats we don't try to transcode — animation / vector. Just report
    // the size+dims and return the input as-is.
    if (meta.format === 'gif' || meta.format === 'svg') {
        return {
            buffer: input,
            size: input.byteLength,
            width: meta.width,
            height: meta.height,
            format: meta.format,
            optimised: false,
        };
    }

    // Pipeline: orient → (crop) → resize cap → re-encode.
    let pipe: Sharp = sharp(input).rotate();

    if (opts.ratio && opts.ratio !== 'free') {
        const {w, h} = RATIO_TARGETS[opts.ratio];
        pipe = pipe.resize(w, h, {fit: 'cover', position: 'attention'});
    } else {
        pipe = pipe.resize({
            width: MAX_EDGE,
            height: MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
        });
    }

    switch (meta.format) {
        case 'jpeg':
        case 'jpg':
            pipe = pipe.jpeg({quality: JPEG_QUALITY, progressive: true, mozjpeg: true});
            break;
        case 'png':
            // Keep PNG — alpha might be in use. Compression is max; we don't
            // demote alpha-less PNGs to JPEG to avoid "why did my transparent
            // logo go solid?" confusion. Power users can re-export to JPEG.
            pipe = pipe.png({compressionLevel: 9, palette: true});
            break;
        case 'webp':
            pipe = pipe.webp({quality: WEBP_QUALITY});
            break;
        case 'avif':
            pipe = pipe.avif({quality: 60});
            break;
        default:
            // Unknown readable format — skip re-encode; still return dims.
            return {
                buffer: input,
                size: input.byteLength,
                width: meta.width,
                height: meta.height,
                format: meta.format,
                optimised: false,
            };
    }

    const {data, info} = await pipe.toBuffer({resolveWithObject: true});

    // Size guard — never regress. Already-compressed assets re-uploaded
    // wouldn't benefit from another lossy pass; keep the original.
    if (data.byteLength >= input.byteLength && !opts.ratio) {
        return {
            buffer: input,
            size: input.byteLength,
            width: meta.width,
            height: meta.height,
            format: meta.format,
            optimised: false,
        };
    }

    return {
        buffer: data,
        size: data.byteLength,
        width: info.width,
        height: info.height,
        format: meta.format,
        optimised: true,
    };
}

/**
 * File-path convenience wrapper — reads `srcPath`, runs the pipeline, writes
 * the result to `destPath`. Used by upload handlers whose multipart parser
 * already wrote the incoming bytes to a temp file.
 */
export async function optimizeImageFile(srcPath: string, destPath: string, opts: OptimizeOptions = {}): Promise<OptimizeResult> {
    const input = await fs.readFile(srcPath);
    const result = await optimizeImageBuffer(input, opts);
    // Ensure dest dir exists — callers sometimes pass a path into a
    // bind-mounted volume that the container overlay hasn't created yet.
    await fs.mkdir(path.dirname(destPath), {recursive: true});
    // Atomic write: Caddy's file_server streams straight from the
    // bind-mounted uploads dir, so a direct `fs.writeFile(destPath, …)`
    // races with in-flight reads — a client fetching the image mid-write
    // can get a truncated / partial buffer and lodge that in its HTTP
    // cache. Stage under `.tmp-<pid>-<rand>` and rename once fully on
    // disk; rename is atomic on the same filesystem (same bind mount).
    const tmpPath = `${destPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        await fs.writeFile(tmpPath, result.buffer);
        await fs.rename(tmpPath, destPath);
    } catch (err) {
        try { await fs.unlink(tmpPath); } catch { /* best-effort cleanup */ }
        throw err;
    }
    return result;
}
