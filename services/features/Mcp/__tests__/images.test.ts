/**
 * MCP image tools — coverage for the F8 follow-up extensions.
 *
 *   - `image.list` with `includeUsage:true` annotates rows with
 *     `usageCount` + `usedIn[]`. With `unusedOnly:true` the response is
 *     filtered to `usageCount === 0`.
 *   - `image.delete` accepts both single `id` (back-compat shape) and
 *     bulk `ids[]` (new shape with `deletedCount` / `failed[]`).
 *   - `scanImageUsage` is exercised directly with hand-rolled fixtures
 *     covering hero portrait, post coverImage, post body HTML, logo,
 *     site SEO defaultImage, and a section blob (regex fallback).
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

// Stateful in-memory inventory + AssetService stub. Reset per test via
// `inventory.length = 0; deletes.length = 0;` in beforeEach.
const inventory: Array<{id: string; name: string}> = [];
const deletes: string[] = [];

const fakeConn = {
    getImages: vi.fn(async () => inventory.slice()),
    getNavigationCollection: vi.fn(async () => [
        {page: 'Home', seo: {image: '/images/og-home.jpg'}, sections: ['s1']},
    ]),
    getSections: vi.fn(async () => [
        {id: 's1', content: [{type: 'HERO', content: JSON.stringify({portraitImage: {src: 'api/portrait.jpg'}})}]},
    ]),
    getPosts: vi.fn(async () => JSON.stringify([
        {slug: 'hello', coverImage: 'api/cover.jpg', body: '<p><img src="/images/inline.png"/></p>'},
    ])),
    getLogo: vi.fn(async () => ({content: JSON.stringify({src: 'api/logo.svg'})})),
    getFooter: vi.fn(async () => JSON.stringify({columns: [], bottom: ''})),
    getSiteSeo: vi.fn(async () => JSON.stringify({defaultImage: 'api/og-default.jpg'})),
    getThemes: vi.fn(async () => JSON.stringify([])),
    assetService: {
        deleteImage: vi.fn(async (id: string) => {
            deletes.push(id);
            const idx = inventory.findIndex(r => r.id === id);
            if (idx >= 0) inventory.splice(idx, 1);
            return JSON.stringify({deletedCount: 1});
        }),
        // Stand-in for rescanDiskImages — drives a fake 3-file walk and
        // calls the optional `onProgress` callback once per file so the
        // progress-notification tests can assert monotonic ticks.
        rescanDiskImages: vi.fn(async (_actor: string, onProgress?: (p: {progress: number; total: number; message: string}) => Promise<void>) => {
            const files = ['a.jpg', 'b.png', 'c.svg'];
            if (onProgress) await onProgress({progress: 0, total: files.length, message: `Scanning ${files.length} files`});
            for (let i = 0; i < files.length; i++) {
                if (onProgress) await onProgress({progress: i + 1, total: files.length, message: `Scanned ${files[i]}`});
            }
            return {added: files.length, skipped: 0, total: files.length};
        }),
    },
};

vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => fakeConn,
}));

// Mock fs so the on-disk unlink path doesn't try to touch the real
// filesystem during tests. existsSync always returns false → fileDeleted
// stays false; that's fine for these tests.
vi.mock('fs', async () => {
    const real = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...real,
        default: real,
        existsSync: () => false,
        unlinkSync: () => undefined,
        mkdirSync: () => undefined,
    };
});

import {imageList, imageDelete, imageRescan} from '../tools/images';
import {scanImageUsage} from '@services/features/Assets/ImageUsageService';

const ACTOR = 'mcp:test';
const makeCtx = () => ({actor: ACTOR, audit: undefined, services: {}, token: null, tokenSecret: null} as any);
const decode = (r: any): any => JSON.parse(r.content[0].text);

beforeEach(() => {
    inventory.length = 0;
    deletes.length = 0;
    vi.clearAllMocks();
});

describe('scanImageUsage (pure)', () => {
    it('records refs from page.seo.image, hero portrait, post coverImage, post body, logo, siteSeo', () => {
        const usage = scanImageUsage({
            images: [
                {name: 'og-home.jpg'},
                {name: 'portrait.jpg'},
                {name: 'cover.jpg'},
                {name: 'inline.png'},
                {name: 'logo.svg'},
                {name: 'og-default.jpg'},
                {name: 'orphan.jpg'},
            ],
            pages: [{page: 'Home', seo: {image: '/images/og-home.jpg'}}],
            sections: [
                {id: 's1', content: [{type: 'HERO', content: JSON.stringify({portraitImage: {src: 'api/portrait.jpg'}})}]},
            ],
            posts: [
                {slug: 'hello', coverImage: 'api/cover.jpg', body: '<img src="/images/inline.png"/>'},
            ],
            logo: {content: JSON.stringify({src: 'api/logo.svg'})},
            footer: null,
            siteSeo: {defaultImage: 'api/og-default.jpg'},
            themes: [],
        });
        expect(usage.get('og-home.jpg')!.count).toBeGreaterThanOrEqual(1);
        expect(usage.get('og-home.jpg')!.refs[0].location).toBe('page:Home');
        expect(usage.get('portrait.jpg')!.refs[0].location).toBe('section:s1');
        expect(usage.get('cover.jpg')!.refs[0].location).toBe('post:hello');
        expect(usage.get('inline.png')!.refs[0].location).toBe('post:hello');
        expect(usage.get('logo.svg')!.refs[0].location).toBe('logo');
        expect(usage.get('og-default.jpg')!.refs[0].location).toBe('siteSeo');
        // Orphan is in inventory but not referenced anywhere
        expect(usage.get('orphan.jpg')!.count).toBe(0);
        expect(usage.get('orphan.jpg')!.refs).toEqual([]);
    });

    it('drops false positives for filenames not in the inventory', () => {
        const usage = scanImageUsage({
            images: [{name: 'real.jpg'}],
            pages: [],
            sections: [{id: 's1', body: 'this mentions some-fake.jpg but it is not in inventory'}],
            posts: [{slug: 'p', body: 'and api/another-fake.png'}],
        });
        // Only the inventory image surfaces; fakes are dropped.
        expect([...usage.keys()]).toEqual(['real.jpg']);
        expect(usage.get('real.jpg')!.count).toBe(0);
    });
});

describe('image.list — includeUsage', () => {
    it('returns plain inventory when includeUsage is omitted', async () => {
        inventory.push({id: 'i1', name: 'a.jpg'}, {id: 'i2', name: 'b.jpg'});
        const r = decode(await imageList.handler({}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.map((x: any) => x.name)).toEqual(['a.jpg', 'b.jpg']);
        expect(r.data[0].usageCount).toBeUndefined();
    });

    it('annotates with usageCount + usedIn when includeUsage is true', async () => {
        inventory.push(
            {id: 'i1', name: 'portrait.jpg'},
            {id: 'i2', name: 'cover.jpg'},
            {id: 'i3', name: 'orphan.jpg'},
        );
        const r = decode(await imageList.handler({includeUsage: true}, makeCtx()));
        expect(r.ok).toBe(true);
        const byName = Object.fromEntries(r.data.map((x: any) => [x.name, x]));
        expect(byName['portrait.jpg'].usageCount).toBeGreaterThanOrEqual(1);
        expect(byName['portrait.jpg'].usedIn[0].location).toBe('section:s1');
        expect(byName['cover.jpg'].usageCount).toBeGreaterThanOrEqual(1);
        expect(byName['orphan.jpg'].usageCount).toBe(0);
    });

    it('filters to unused when unusedOnly is true', async () => {
        inventory.push(
            {id: 'i1', name: 'portrait.jpg'},
            {id: 'i2', name: 'orphan.jpg'},
        );
        const r = decode(await imageList.handler({includeUsage: true, unusedOnly: true}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.map((x: any) => x.name)).toEqual(['orphan.jpg']);
    });

    it('unusedOnly without includeUsage is a no-op', async () => {
        inventory.push({id: 'i1', name: 'a.jpg'});
        const r = decode(await imageList.handler({unusedOnly: true}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.length).toBe(1);
    });
});

describe('image.delete — single + bulk', () => {
    it('single id form returns the back-compat shape', async () => {
        inventory.push({id: 'i1', name: 'a.jpg'});
        const r = decode(await imageDelete.handler({id: 'i1'}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.deleted).toBe(1);
        expect(r.data.name).toBe('a.jpg');
        // Bulk-shape fields absent
        expect(r.data.deletedCount).toBeUndefined();
        expect(deletes).toEqual(['i1']);
    });

    it('ids[] form returns per-id results and counts', async () => {
        inventory.push(
            {id: 'i1', name: 'a.jpg'},
            {id: 'i2', name: 'b.jpg'},
            {id: 'i3', name: 'c.jpg'},
        );
        const r = decode(await imageDelete.handler({ids: ['i1', 'i2', 'i3']}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.deletedCount).toBe(3);
        expect(r.data.failedCount).toBe(0);
        expect(r.data.deleted).toEqual(['i1', 'i2', 'i3']);
        expect(deletes).toEqual(['i1', 'i2', 'i3']);
    });

    it('ids[] form reports per-id failures without aborting the batch', async () => {
        inventory.push({id: 'i1', name: 'a.jpg'}, {id: 'i3', name: 'c.jpg'});
        // Make i2 throw inside the underlying service.
        fakeConn.assetService.deleteImage.mockImplementationOnce(async (id: string) => {
            deletes.push(id); return JSON.stringify({deletedCount: 1});
        });
        fakeConn.assetService.deleteImage.mockImplementationOnce(async () => {
            throw new Error('mongo timeout');
        });
        fakeConn.assetService.deleteImage.mockImplementationOnce(async (id: string) => {
            deletes.push(id); return JSON.stringify({deletedCount: 1});
        });
        const r = decode(await imageDelete.handler({ids: ['i1', 'i2', 'i3']}, makeCtx()));
        // Handler ran to completion — outer envelope is ok. Per-id
        // failures live in `data.failed[]` so the caller can decide.
        expect(r.ok).toBe(true);
        expect(r.data.ok).toBe(false); // inner-shape flag for partial failure
        expect(r.data.deletedCount).toBe(2);
        expect(r.data.failedCount).toBe(1);
        expect(r.data.failed[0].id).toBe('i2');
        expect(r.data.failed[0].error).toMatch(/mongo timeout/);
    });

    it('rejects when neither id nor ids supplied', async () => {
        const r = decode(await imageDelete.handler({}, makeCtx()));
        expect(r.ok).toBe(false);
        expect(r.error.message).toMatch(/requires `id` or/);
    });
});

describe('image.rescan — progress notifications (F8 wave-2)', () => {
    it('forwards ctx.notify to assetService.rescanDiskImages with monotonic ticks', async () => {
        const calls: Array<{progress: number; total?: number; message?: string}> = [];
        const ctx = {
            ...makeCtx(),
            notify: async (p: {progress: number; total?: number; message?: string}) => { calls.push(p); },
        };
        const r = decode(await imageRescan.handler({}, ctx));
        expect(r.ok).toBe(true);
        expect(r.data.added).toBe(3);
        // Initial tick + one per file → 4 calls; progress strictly non-decreasing.
        expect(calls.length).toBe(4);
        for (let i = 1; i < calls.length; i++) {
            expect(calls[i].progress).toBeGreaterThanOrEqual(calls[i - 1].progress);
        }
        expect(calls[calls.length - 1].progress).toBe(calls[calls.length - 1].total);
    });

    it('runs cleanly with no notify callback (token-less client)', async () => {
        const r = decode(await imageRescan.handler({}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.added).toBe(3);
    });
});
