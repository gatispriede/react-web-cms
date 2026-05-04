/**
 * secretBox round-trip + tamper-detection tests.
 *
 * The module reads `SECRETBOX_KEY` at call time, so each test sets the
 * env var explicitly, exercises the path, and restores. We deliberately
 * test the no-key fall-through too — it's the path existing deployments
 * boot through until the operator rotates.
 */
import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {randomBytes} from 'crypto';

import {encrypt, decrypt, mask, isEncrypted} from './secretBox';

describe('secretBox', () => {
    const ORIGINAL = process.env.SECRETBOX_KEY;
    const KEY = randomBytes(32).toString('base64');

    beforeEach(() => {
        process.env.SECRETBOX_KEY = KEY;
    });
    afterEach(() => {
        if (ORIGINAL === undefined) delete process.env.SECRETBOX_KEY;
        else process.env.SECRETBOX_KEY = ORIGINAL;
    });

    it('round-trips plaintext through encrypt/decrypt', () => {
        const plain = 're_live_abcDEF1234567890';
        const boxed = encrypt(plain);
        expect(boxed.startsWith('sb1:')).toBe(true);
        expect(boxed).not.toContain(plain);
        expect(decrypt(boxed)).toBe(plain);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', () => {
        const a = encrypt('hello');
        const b = encrypt('hello');
        expect(a).not.toBe(b);
        expect(decrypt(a)).toBe('hello');
        expect(decrypt(b)).toBe('hello');
    });

    it('detects tampered ciphertext', () => {
        const boxed = encrypt('shibboleth');
        // Flip a byte in the ciphertext region (after iv prefix).
        const buf = Buffer.from(boxed.slice(4), 'base64');
        buf[14] ^= 0x01;
        const tampered = 'sb1:' + buf.toString('base64');
        expect(() => decrypt(tampered)).toThrow();
    });

    it('falls back to plaintext when SECRETBOX_KEY is unset', () => {
        delete process.env.SECRETBOX_KEY;
        const out = encrypt('hello');
        expect(out).toBe('hello');
        expect(decrypt('hello')).toBe('hello');
    });

    it('rejects wrong-length keys', () => {
        process.env.SECRETBOX_KEY = Buffer.from('too-short').toString('base64');
        expect(() => encrypt('x')).toThrow();
    });

    it('mask shows last 4 of plaintext, encrypted marker for envelopes', () => {
        expect(mask('re_live_abcDEF1234567890')).toBe('sk_***7890');
        expect(mask(encrypt('whatever'))).toBe('sk_***[encrypted]');
        expect(mask('')).toBe('');
    });

    it('isEncrypted distinguishes wrapped from plain', () => {
        expect(isEncrypted(encrypt('x'))).toBe(true);
        expect(isEncrypted('plain')).toBe(false);
        expect(isEncrypted(null)).toBe(false);
    });
});
