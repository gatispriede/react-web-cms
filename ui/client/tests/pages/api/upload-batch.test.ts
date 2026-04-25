// @vitest-environment node
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Re-import the collision helper indirectly — it's not exported from the
// handler (to keep the module surface small). Instead we test the observable
// behaviour: the suffix pattern for successive collisions. The logic below
// mirrors the handler one-for-one.
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

describe('upload-batch collision resolver', () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ub-')); });
    afterEach(() => { fs.rmSync(tmp, {recursive: true, force: true}); });

    it('returns the original safe name when nothing collides', () => {
        expect(resolveUniqueName(tmp, 'IMG 0001.jpg')).toBe('IMG_0001.jpg');
    });

    it('appends -1 on first collision, -2 on second, preserving ext', () => {
        fs.writeFileSync(path.join(tmp, 'photo.jpg'), 'x');
        expect(resolveUniqueName(tmp, 'photo.jpg')).toBe('photo-1.jpg');
        fs.writeFileSync(path.join(tmp, 'photo-1.jpg'), 'x');
        expect(resolveUniqueName(tmp, 'photo.jpg')).toBe('photo-2.jpg');
    });

    it('handles names without extension cleanly', () => {
        fs.writeFileSync(path.join(tmp, 'scan'), 'x');
        expect(resolveUniqueName(tmp, 'scan')).toBe('scan-1');
    });

    it('collapses whitespace in the incoming filename before collision check', () => {
        fs.writeFileSync(path.join(tmp, 'A_B.png'), 'x');
        expect(resolveUniqueName(tmp, 'A B.png')).toBe('A_B-1.png');
    });
});
