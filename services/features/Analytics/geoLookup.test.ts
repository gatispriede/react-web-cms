import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {geoLookup, loadDataset, _resetDatasetForTests} from './geoLookup';

let tmpDir: string;
let dsPath: string;
const ORIGINAL_PATH = process.env.GEOLITE_DATASET_PATH;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'geolite-'));
    dsPath = join(tmpDir, 'ip-to-country.json');
    process.env.GEOLITE_DATASET_PATH = dsPath;
    _resetDatasetForTests();
});

afterEach(() => {
    rmSync(tmpDir, {recursive: true, force: true});
    if (ORIGINAL_PATH === undefined) delete process.env.GEOLITE_DATASET_PATH;
    else process.env.GEOLITE_DATASET_PATH = ORIGINAL_PATH;
    _resetDatasetForTests();
});

describe('geoLookup', () => {
    it('returns the country for an IP inside a known range (binary search)', () => {
        const toN = (ip: string): number => ip.split('.').reduce((acc, p) => acc * 256 + Number(p), 0) >>> 0;
        writeFileSync(dsPath, JSON.stringify([
            {s: toN('1.0.0.0'),   e: toN('1.0.0.255'),   cc: 'US'},
            {s: toN('8.8.8.0'),   e: toN('8.8.8.255'),   cc: 'US'},
            {s: toN('91.121.1.0'), e: toN('91.121.1.255'), cc: 'FR'},
        ]));
        expect(geoLookup('8.8.8.8')).toBe('US');
        expect(geoLookup('1.0.0.5')).toBe('US');
        expect(geoLookup('91.121.1.42')).toBe('FR');
    });

    it('returns undefined for an IP outside every range', () => {
        writeFileSync(dsPath, JSON.stringify([{s: 16777216, e: 16777471, cc: 'US'}]));
        expect(geoLookup('200.0.0.1')).toBeUndefined();
    });

    it('returns undefined for malformed input (not an IPv4 address)', () => {
        writeFileSync(dsPath, JSON.stringify([{s: 16777216, e: 16777471, cc: 'US'}]));
        expect(geoLookup('not-an-ip')).toBeUndefined();
        expect(geoLookup('')).toBeUndefined();
        expect(geoLookup(undefined)).toBeUndefined();
        expect(geoLookup(null)).toBeUndefined();
        // IPv6 — DB1 is IPv4-only.
        expect(geoLookup('::1')).toBeUndefined();
        expect(geoLookup('2001:db8::1')).toBeUndefined();
    });

    it('strips IPv4-mapped IPv6 prefix (::ffff:1.2.3.4)', () => {
        writeFileSync(dsPath, JSON.stringify([{s: 16777216, e: 16777471, cc: 'US'}]));
        expect(geoLookup('::ffff:1.0.0.1')).toBe('US');
    });

    it('returns undefined when the dataset file is missing (graceful degradation)', () => {
        // Dataset never written. loadDataset should log + return [].
        expect(loadDataset()).toEqual([]);
        expect(geoLookup('8.8.8.8')).toBeUndefined();
    });

    it('caches the dataset across calls (idempotent loadDataset)', () => {
        writeFileSync(dsPath, JSON.stringify([{s: 16777216, e: 16777471, cc: 'US'}]));
        const first = loadDataset();
        const second = loadDataset();
        expect(first).toBe(second);
    });
});
