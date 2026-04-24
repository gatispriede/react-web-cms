#!/usr/bin/env node
// Optimize base64-embedded images in a CMS bundle JSON.
// Usage: node scripts/optimize-bundle-images.mjs <input.json> <output.json>

import fs from 'node:fs';
import sharp from 'sharp';

const [,, inPath, outPath] = process.argv;
if (!inPath || !outPath) {
    console.error('usage: optimize-bundle-images.mjs <input.json> <output.json>');
    process.exit(1);
}

const MAX_DIM = 1920;
const JPEG_QUALITY = 78;

const raw = fs.readFileSync(inPath, 'utf8');
const inBytes = Buffer.byteLength(raw, 'utf8');

// Match data URIs for jpeg/png. Base64 chars only after the comma.
const RE = /"data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)"/g;

let count = 0;
let totalInB64 = 0;
let totalOutB64 = 0;
const matches = [...raw.matchAll(RE)];
console.log(`found ${matches.length} embedded images`);

// Process in parallel with a small pool to cap memory.
const POOL = 6;
const results = new Array(matches.length);
let next = 0;
async function worker() {
    while (true) {
        const i = next++;
        if (i >= matches.length) return;
        const [, fmt, b64] = matches[i];
        const inBuf = Buffer.from(b64, 'base64');
        totalInB64 += b64.length;
        try {
            let img = sharp(inBuf, {failOn: 'none'}).rotate();
            const meta = await img.metadata();
            const needsResize = (meta.width ?? 0) > MAX_DIM || (meta.height ?? 0) > MAX_DIM;
            if (needsResize) {
                img = img.resize({width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true});
            }
            let outBuf;
            let outFmt = 'jpeg';
            if (fmt === 'png' && meta.hasAlpha) {
                outFmt = 'png';
                outBuf = await img.png({compressionLevel: 9, palette: true}).toBuffer();
            } else {
                outBuf = await img.jpeg({quality: JPEG_QUALITY, progressive: true, mozjpeg: true}).toBuffer();
            }
            // Only accept if smaller; otherwise keep original.
            if (outBuf.length < inBuf.length * 0.95) {
                const outB64 = outBuf.toString('base64');
                results[i] = `"data:image/${outFmt};base64,${outB64}"`;
                totalOutB64 += outB64.length;
            } else {
                results[i] = matches[i][0];
                totalOutB64 += b64.length;
            }
            count++;
            if (count % 10 === 0) process.stderr.write(`  ${count}/${matches.length}\n`);
        } catch (e) {
            console.warn(`image ${i} failed (${fmt}, ${inBuf.length}B): ${e.message} — keeping original`);
            results[i] = matches[i][0];
            totalOutB64 += b64.length;
        }
    }
}
await Promise.all(Array.from({length: POOL}, worker));

// Splice results back into raw string without re-scanning (use indices from matches).
let out = '';
let cursor = 0;
for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index;
    out += raw.slice(cursor, start);
    out += results[i];
    cursor = start + m[0].length;
}
out += raw.slice(cursor);

fs.writeFileSync(outPath, out);
const outBytes = Buffer.byteLength(out, 'utf8');
console.log(`done: ${count} images`);
console.log(`  b64 payload: ${(totalInB64/1e6).toFixed(1)} MB → ${(totalOutB64/1e6).toFixed(1)} MB`);
console.log(`  json total:  ${(inBytes/1e6).toFixed(1)} MB → ${(outBytes/1e6).toFixed(1)} MB (${((1-outBytes/inBytes)*100).toFixed(1)}% smaller)`);
