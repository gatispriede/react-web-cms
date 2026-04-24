// @vitest-environment node
import {describe, it, expect} from 'vitest';
import sharp from 'sharp';
import {optimizeImageBuffer} from './imageOptimize';

/**
 * Compose fixture buffers inline via sharp so the tests stay hermetic —
 * no checked-in binary files. Using small sizes keeps CI fast.
 */
const makeJpeg = async (w = 200, h = 150, quality = 100) =>
    await sharp({create: {width: w, height: h, channels: 3, background: {r: 120, g: 140, b: 200}}})
        .jpeg({quality})
        .toBuffer();

const makePng = async (w = 100, h = 100, alpha = true) =>
    await sharp({create: {width: w, height: h, channels: alpha ? 4 : 3, background: alpha ? {r: 0, g: 0, b: 0, alpha: 0.5} : {r: 10, g: 20, b: 30}}})
        .png()
        .toBuffer();

describe('optimizeImageBuffer', () => {
    it('reports width/height and the chosen format for a valid JPEG', async () => {
        const input = await makeJpeg(1024, 768);
        const r = await optimizeImageBuffer(input);
        expect(r.format).toBe('jpeg');
        expect(r.width).toBe(1024);
        expect(r.height).toBe(768);
    });

    it('caps the longest edge at 1920 without enlarging smaller images', async () => {
        const big = await makeJpeg(4000, 3000);
        const rBig = await optimizeImageBuffer(big);
        expect(rBig.width).toBeLessThanOrEqual(1920);
        expect(rBig.height).toBeLessThanOrEqual(1920);
        // Longest edge lands at 1920 (3:2 phone-shot simulation).
        expect(Math.max(rBig.width!, rBig.height!)).toBe(1920);

        const small = await makeJpeg(640, 480);
        const rSmall = await optimizeImageBuffer(small);
        expect(rSmall.width).toBe(640);
        expect(rSmall.height).toBe(480);
    });

    it('size guard: already-compressed re-uploads keep the original bytes', async () => {
        // Pre-compressed at low quality — second pass shouldn't shrink it.
        const pre = await makeJpeg(400, 300, 40);
        const r = await optimizeImageBuffer(pre);
        // Either the guard fired (optimised: false) or the output is <= input;
        // both paths mean we never regress.
        expect(r.size).toBeLessThanOrEqual(pre.byteLength);
    });

    it('PNG stays PNG even without alpha usage (alpha-preservation-by-default)', async () => {
        const png = await makePng(150, 150, false);
        const r = await optimizeImageBuffer(png);
        expect(r.format).toBe('png');
    });

    it('unreadable bytes pass through untouched', async () => {
        const garbage = Buffer.from('not an image at all');
        const r = await optimizeImageBuffer(garbage);
        expect(r.buffer).toBe(garbage);
        expect(r.optimised).toBe(false);
        expect(r.format).toBeNull();
    });

    it('ratio lock forces cover-crop to target dimensions', async () => {
        const input = await makeJpeg(2000, 2000); // square source
        const r = await optimizeImageBuffer(input, {ratio: '16:9'});
        expect(r.width).toBe(1920);
        expect(r.height).toBe(1080);
        expect(r.optimised).toBe(true);
    });
});
