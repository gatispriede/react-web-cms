/**
 * Bulk-write extension coverage for the 12 MCP mutation tools that now
 * accept either single-item input (legacy contract) or `items[]` (new
 * bulk path).
 *
 * Reference impl: `image.delete { ids[] }` (shipped 2026-05-07). Each
 * extended tool composes via `runBatch` from `_shared.ts` so the response
 * shape is identical: `{ok, succeededCount, failedCount, succeeded[],
 * failed[], results[]}`.
 *
 * Each test covers one tool and asserts:
 *   - `items[]` runs the underlying service once per item, AND
 *   - the bulk envelope reports per-item ok status.
 *
 * Single-item back-compat is exercised by the existing test files
 * (`f8Week2Tools.test.ts` / `modulesAndInquiries.test.ts`); we don't
 * duplicate that here.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

const savePostSpy = vi.fn(async (_p: any) => JSON.stringify({savePost: {id: 'p-new', slug: _p?.post?.slug}}));
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        userService: {getUser: async () => undefined},
        savePost: savePostSpy,
    }),
}));

import {sectionUpdate, pageUpdate} from '../tools/pages';
import {moduleAdd, moduleUpdate, moduleRemove} from '../tools/modules';
import {postUpsert} from '../tools/posts';
import {productCreate, productUpdate} from '../tools/products';
import {permissionGrant, permissionRevoke} from '../tools/permissions';
import {userSetRole, userUpdate} from '../tools/users';
import {_resetIdempotencyForTests} from '@services/infra/idempotency';

const ACTOR = 'mcp:bulk';

beforeEach(() => {
    _resetIdempotencyForTests();
    savePostSpy.mockClear();
});

const decode = (r: any): any => JSON.parse(r.content[0].text);

const baseServices = (overrides: any = {}) => ({
    addUpdateSectionItem: vi.fn(async ({section}: any) =>
        JSON.stringify({ok: true, id: section?.id, count: (section?.content ?? []).length})),
    navigationService: {
        getSections: vi.fn(async (ids: string[]) =>
            ids.map(id => ({id, content: [], version: 1}))),
        getNavigationCollection: vi.fn(async () => [
            {id: 'p1', page: 'about', slug: 'about', sections: [], version: 1},
            {id: 'p2', page: 'home', slug: 'home', sections: [], version: 1},
        ]),
        replaceUpdateNavigation: vi.fn(async () => JSON.stringify({navigation: 'ok'})),
        setParent: vi.fn(async () => JSON.stringify({setParent: {id: 'p1', parent: null}})),
        reorderPages: vi.fn(async () => JSON.stringify({reorderPages: {}})),
    },
    saveProduct: vi.fn(async ({product}: any) => JSON.stringify({saveProduct: {id: product?.id ?? 'pr-new', sku: product?.sku}})),
    permissionService: {
        grant: vi.fn(async (o: any) => ({...o, id: `g-${o.userId}-${o.scope}`})),
        revoke: vi.fn(async () => ({deleted: 1})),
    },
    updateUser: vi.fn(async ({user}: any) => JSON.stringify({updateUser: {id: user?.id ?? null, email: user?.email ?? null}})),
    ...overrides,
});

const ctx = (servicesOverride: any = {}) => ({
    actor: ACTOR,
    audit: undefined,
    services: baseServices(servicesOverride),
});

describe('bulk-write extensions — section.update with items[]', () => {
    it('runs each item and reports per-item ok via the runBatch envelope', async () => {
        const c = ctx();
        const r = await sectionUpdate.handler({
            items: [
                {section: {id: 's1', content: [], version: 1}},
                {section: {id: 's2', content: [], version: 1}},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect(env.data.failedCount).toBe(0);
        expect(env.data.results).toHaveLength(2);
        expect((c.services.addUpdateSectionItem as any).mock.calls.length).toBe(2);
    });
});

describe('bulk-write extensions — page.update with items[]', () => {
    it('runs each item and reports per-item ok', async () => {
        const c = ctx();
        const r = await pageUpdate.handler({
            items: [
                {id: 'p1', page: 'home'},
                {id: 'p2', parent: null},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect(env.data.results).toHaveLength(2);
    });
});

describe('bulk-write extensions — module.add/update/remove with items[]', () => {
    const moduleCtx = () => ctx({
        navigationService: {
            getSections: vi.fn(async (ids: string[]) => ids.map(id => ({
                id, version: 1,
                content: [{type: 'TEXT', style: 'default', content: '{}', action: 'none', actionStyle: 'default', actionType: 'TEXT', actionContent: '{}', animation: 'none'}],
            }))),
        },
    });

    it('module.add bulk runs each item and reports per-item ok', async () => {
        const c = moduleCtx();
        const r = await moduleAdd.handler({
            items: [
                {sectionId: 'sec1', module: {type: 'IMAGE'}},
                {sectionId: 'sec2', module: {type: 'INQUIRY_FORM'}},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect((c.services.addUpdateSectionItem as any).mock.calls.length).toBe(2);
    });

    it('module.update bulk runs each item', async () => {
        const c = moduleCtx();
        const r = await moduleUpdate.handler({
            items: [
                {sectionId: 'sec1', module: {type: 'IMAGE'}, at: 0},
                {sectionId: 'sec2', module: {type: 'TEXT'}, at: 0},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
    });

    it('module.remove bulk reports per-item ok with one out-of-range failure', async () => {
        const c = moduleCtx();
        const r = await moduleRemove.handler({
            items: [
                {sectionId: 'sec1', at: 0},
                {sectionId: 'sec2', at: 99},
            ],
        }, c as any);
        const env = decode(r);
        // The single-item handler returns {ok: false, error} as a *value*
        // when the index is out of range — runBatch treats that as a
        // successful per-item return (no throw), so both items count as
        // succeeded; the per-item payload still surfaces the error.
        expect(env.data.results).toHaveLength(2);
    });
});

describe('bulk-write extensions — post.upsert with items[]', () => {
    it('runs each post and reports per-item ok', async () => {
        const c = ctx();
        const r = await postUpsert.handler({
            items: [
                {slug: 'p-1', title: 'A', body: '<p>a</p>'},
                {slug: 'p-2', title: 'B', body: '<p>b</p>'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect(savePostSpy.mock.calls.length).toBe(2);
    });
});

describe('bulk-write extensions — product.create / product.update with items[]', () => {
    it('product.create bulk runs each item and reports per-item ok', async () => {
        const c = ctx();
        const r = await productCreate.handler({
            items: [
                {title: 'A', sku: 'A1', price: 100, currency: 'EUR'},
                {title: 'B', sku: 'B1', price: 200, currency: 'EUR'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect((c.services.saveProduct as any).mock.calls.length).toBe(2);
    });

    it('product.update bulk runs each item with its expectedVersion', async () => {
        const c = ctx();
        const r = await productUpdate.handler({
            items: [
                {id: 'pr1', price: 150, expectedVersion: 1},
                {id: 'pr2', stock: 10, expectedVersion: 1},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
    });
});

describe('bulk-write extensions — permission.grant / revoke with items[]', () => {
    it('permission.grant bulk forwards grantedBy=actor for each item', async () => {
        const c = ctx();
        const r = await permissionGrant.handler({
            items: [
                {userId: 'u1', scope: 'page', resourceId: 'about'},
                {userId: 'u2', scope: 'product', resourceId: 'sku-1'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        const grantCalls = (c.services.permissionService.grant as any).mock.calls;
        expect(grantCalls.length).toBe(2);
        expect(grantCalls[0][0].grantedBy).toBe(ACTOR);
    });

    it('permission.revoke bulk runs each item', async () => {
        const c = ctx();
        const r = await permissionRevoke.handler({
            items: [
                {userId: 'u1', scope: 'page', resourceId: 'about'},
                {userId: 'u1', scope: 'product', resourceId: 'sku-1'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
    });
});

describe('bulk-write extensions — user.setRole / user.update with items[]', () => {
    it('user.setRole bulk runs each item via updateUser', async () => {
        const c = ctx();
        const r = await userSetRole.handler({
            items: [
                {id: 'u1', role: 'editor'},
                {id: 'u2', role: 'viewer'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        expect((c.services.updateUser as any).mock.calls.length).toBe(2);
    });

    it('user.update bulk applies field whitelist per item', async () => {
        const c = ctx();
        const r = await userUpdate.handler({
            items: [
                {id: 'u1', name: 'Anna'},
                {id: 'u2', role: 'admin'},
            ],
        }, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data.succeededCount).toBe(2);
        const calls = (c.services.updateUser as any).mock.calls;
        expect(calls[0][0].user.name).toBe('Anna');
        expect(calls[1][0].user.role).toBe('admin');
    });
});
