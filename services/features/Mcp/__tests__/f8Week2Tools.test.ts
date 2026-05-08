/**
 * F8 Week-2 — coverage for the new MCP tools (page lifecycle, site
 * content, permissions, users, languages, trash). Mirrors the in-memory
 * pattern from `modulesAndInquiries.test.ts` — every service method the
 * tools touch is stubbed so we can exercise the handler without spinning
 * up Mongo.
 *
 * Each tool is asserted on at least one of:
 *   - schema rejects invalid input
 *   - handler routes through the right service method
 *   - destructive tool is in ADVANCED_ONLY_TOOLS
 *   - idempotent replay returns the same envelope
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({userService: {getUser: async () => undefined}}),
}));

import {pageUpdate, pageDelete, pageSetParent, pageReorder} from '../tools/pages';
import {footerGet, footerUpdate, seoGet, seoUpdate, logoGet, logoUpdate} from '../tools/siteContent';
import {permissionList, permissionGrant, permissionRevoke} from '../tools/permissions';
import {userList, userGet, userSetRole} from '../tools/users';
import {languageAdd, languageRemove, languageSetDefault} from '../tools/translations';
import {trashList, trashRestore} from '../tools/trash';
import {ADVANCED_ONLY_TOOLS} from '../ADVANCED_TOOLS';
import {_resetIdempotencyForTests} from '@services/infra/idempotency';

const ACTOR = 'mcp:test-token';

beforeEach(() => {
    _resetIdempotencyForTests();
});

const decode = (r: any): any => JSON.parse(r.content[0].text);
const ok = (r: any) => decode(r).ok === true;

const baseServices = (overrides: any = {}) => ({
    navigationService: {
        getNavigationCollection: vi.fn(async () => [
            {id: 'p1', page: 'about', slug: 'about', sections: [], version: 1},
        ]),
        replaceUpdateNavigation: vi.fn(async () => JSON.stringify({navigation: 'ok'})),
        setParent: vi.fn(async () => JSON.stringify({setParent: {id: 'p1', parent: null, version: 2}})),
        reorderPages: vi.fn(async () => JSON.stringify({reorderPages: {parentId: null, updated: 2}})),
    },
    deleteNavigationItem: vi.fn(async () => JSON.stringify({deleted: 1, trashGroup: 'tg-1'})),
    footerService: {get: vi.fn(async () => ({columns: [], version: 0}))},
    saveFooter: vi.fn(async () => JSON.stringify({ok: true, version: 1})),
    siteSeoService: {get: vi.fn(async () => ({siteName: 's', version: 0}))},
    siteFlagsService: {get: vi.fn(async () => ({blogEnabled: true, version: 0}))},
    saveSiteSeo: vi.fn(async () => JSON.stringify({ok: true})),
    saveSiteFlags: vi.fn(async () => JSON.stringify({ok: true})),
    getLogo: vi.fn(async () => JSON.stringify({url: '/logo.svg', version: 1})),
    saveLogo: vi.fn(async () => JSON.stringify({ok: true, version: 2})),
    permissionService: {
        listForUser: vi.fn(async () => [{userId: 'u1', scope: 'page', resourceId: 'about'}]),
        grant: vi.fn(async (o: any) => ({...o, id: 'g1', grantedAt: 'now'})),
        revoke: vi.fn(async () => ({deleted: 1})),
        col: {find: () => ({toArray: async () => []})},
    },
    userService: {
        getUsers: vi.fn(async () => [
            {id: 'u1', email: 'a@b.c', role: 'admin', password: 'HASH'},
            {id: 'u2', email: 'e@f.g', role: 'editor', password: 'HASH2'},
        ]),
        getUser: vi.fn(async ({email}: any) => ({id: 'u1', email, role: 'admin', password: 'HASH'})),
    },
    updateUser: vi.fn(async () => JSON.stringify({updateUser: {id: 'u1'}})),
    languageService: {
        addUpdateLanguage: vi.fn(async () => ({symbol: 'fr', version: 1})),
        deleteLanguage: vi.fn(async () => JSON.stringify({deletedCount: 1})),
        setDefault: vi.fn(async () => JSON.stringify({setDefault: {symbol: 'lv'}})),
        getLanguages: vi.fn(async () => []),
    },
    getTrashGroups: vi.fn(async () => JSON.stringify([
        {trashGroup: 'tg-1', deletedAt: '2026-05-04', summary: {Navigation: 1}},
    ])),
    restoreFromTrash: vi.fn(async () => JSON.stringify({restoreFromTrash: {trashGroup: 'tg-1', counts: {Navigation: 1}}})),
    ...overrides,
});

const ctx = (servicesOverride: any = {}) => ({
    actor: ACTOR,
    audit: undefined,
    services: baseServices(servicesOverride),
});

describe('F8 W2 — page lifecycle tools', () => {
    it('page.update routes rename through replaceUpdateNavigation', async () => {
        const c = ctx();
        const r = await pageUpdate.handler({id: 'p1', page: 'home'}, c as any);
        expect(ok(r)).toBe(true);
        expect((c.services.navigationService.replaceUpdateNavigation as any)).toHaveBeenCalled();
    });

    it('page.update calls setParent when parent provided', async () => {
        const c = ctx();
        const r = await pageUpdate.handler({id: 'p1', parent: null}, c as any);
        expect(ok(r)).toBe(true);
        expect((c.services.navigationService.setParent as any)).toHaveBeenCalledWith('p1', null, ACTOR);
    });

    it('page.delete routes through deleteNavigationItem (cascade)', async () => {
        const c = ctx();
        const r = await pageDelete.handler({id: 'p1'}, c as any);
        expect(ok(r)).toBe(true);
        expect((c.services.deleteNavigationItem as any)).toHaveBeenCalled();
    });

    it('page.setParent forwards to NavigationService.setParent', async () => {
        const c = ctx();
        await pageSetParent.handler({pageId: 'p1', parentId: 'p2'}, c as any);
        expect((c.services.navigationService.setParent as any)).toHaveBeenCalledWith('p1', 'p2', ACTOR);
    });

    it('page.reorder forwards to NavigationService.reorderPages', async () => {
        const c = ctx();
        await pageReorder.handler({parentId: null, orderedIds: ['p1', 'p2']}, c as any);
        expect((c.services.navigationService.reorderPages as any)).toHaveBeenCalledWith(null, ['p1', 'p2'], ACTOR);
    });

    it('all P0 page mutations are advanced-only', () => {
        for (const t of ['page.update', 'page.delete', 'page.setParent', 'page.reorder']) {
            expect(ADVANCED_ONLY_TOOLS.has(t)).toBe(true);
        }
    });

    it('all P0 page mutations are idempotent (replay short-circuits)', async () => {
        const c = ctx();
        const r1 = await pageDelete.handler({id: 'p1', idempotencyKey: 'k-1'}, c as any);
        const r2 = await pageDelete.handler({id: 'p1', idempotencyKey: 'k-1'}, c as any);
        expect(r1).toEqual(r2);
        // Service called exactly once across the two attempts.
        expect((c.services.deleteNavigationItem as any).mock.calls.length).toBe(1);
    });
});

describe('F8 W2 — site content tools', () => {
    it('footer.get returns the service value', async () => {
        const c = ctx();
        const r = await footerGet.handler({}, c as any);
        expect(decode(r)).toEqual({ok: true, data: {columns: [], version: 0}});
    });

    it('footer.update routes through saveFooter', async () => {
        const c = ctx();
        await footerUpdate.handler({config: {columns: []}}, c as any);
        expect((c.services.saveFooter as any)).toHaveBeenCalled();
    });

    it('seo.get returns both siteSeo and siteFlags', async () => {
        const c = ctx();
        const r = await seoGet.handler({}, c as any);
        const env = decode(r);
        expect(env.ok).toBe(true);
        expect(env.data).toHaveProperty('siteSeo');
        expect(env.data).toHaveProperty('siteFlags');
    });

    it('seo.update conditionally writes only blocks present in args', async () => {
        const c = ctx();
        await seoUpdate.handler({siteSeo: {siteName: 'x'}}, c as any);
        expect((c.services.saveSiteSeo as any)).toHaveBeenCalled();
        expect((c.services.saveSiteFlags as any)).not.toHaveBeenCalled();
    });

    it('logo.get / logo.update route through asset service', async () => {
        const c = ctx();
        await logoGet.handler({}, c as any);
        expect((c.services.getLogo as any)).toHaveBeenCalled();
        await logoUpdate.handler({content: '<svg/>'}, c as any);
        expect((c.services.saveLogo as any)).toHaveBeenCalled();
    });

    it('writes are advanced-only', () => {
        for (const t of ['footer.update', 'seo.update', 'logo.update']) {
            expect(ADVANCED_ONLY_TOOLS.has(t)).toBe(true);
        }
    });
});

describe('F8 W2 — permission tools', () => {
    it('permission.list filters by userId + scope', async () => {
        const c = ctx();
        await permissionList.handler({userId: 'u1', scope: 'page'}, c as any);
        expect((c.services.permissionService.listForUser as any)).toHaveBeenCalledWith('u1');
    });

    it('permission.grant forwards grantedBy = actor', async () => {
        const c = ctx();
        await permissionGrant.handler({userId: 'u1', scope: 'page', resourceId: 'about'}, c as any);
        expect((c.services.permissionService.grant as any)).toHaveBeenCalledWith({
            userId: 'u1', scope: 'page', resourceId: 'about', grantedBy: ACTOR,
        });
    });

    it('permission.revoke routes to PermissionService.revoke', async () => {
        const c = ctx();
        await permissionRevoke.handler({userId: 'u1', scope: 'page', resourceId: 'about'}, c as any);
        expect((c.services.permissionService.revoke as any)).toHaveBeenCalled();
    });

    it('permission.grant / revoke are advanced-only', () => {
        expect(ADVANCED_ONLY_TOOLS.has('permission.grant')).toBe(true);
        expect(ADVANCED_ONLY_TOOLS.has('permission.revoke')).toBe(true);
    });

    it('permission.grant schema exposes the natural key plus the bulk variant', () => {
        // After the bulk-write extension, single-item args are no longer
        // schema-required (handler enforces "single OR items[]"); the
        // schema still surfaces them as named properties so agents can
        // discover the single-item shape.
        const props = permissionGrant.inputSchema.properties as any;
        expect(props.userId).toBeDefined();
        expect(props.scope).toBeDefined();
        expect(props.resourceId).toBeDefined();
        expect(props.items).toBeDefined();
        expect(props.items.type).toBe('array');
    });
});

describe('F8 W2 — user tools', () => {
    it('user.list redacts password hashes', async () => {
        const c = ctx();
        const r = await userList.handler({}, c as any);
        const data = decode(r).data;
        for (const u of data) expect(u).not.toHaveProperty('password');
    });

    it('user.list filters by role', async () => {
        const c = ctx();
        const r = await userList.handler({role: 'editor'}, c as any);
        const data = decode(r).data;
        expect(data.length).toBe(1);
        expect(data[0].role).toBe('editor');
    });

    it('user.get by email redacts password', async () => {
        const c = ctx();
        const r = await user_get_safe(c);
        expect(r).not.toBe(null);
        expect(r).not.toHaveProperty('password');
    });

    async function user_get_safe(c: any) {
        const r = await userGet.handler({email: 'a@b.c'}, c as any);
        return decode(r).data;
    }

    it('user.setRole routes through updateUser', async () => {
        const c = ctx();
        await userSetRole.handler({id: 'u1', role: 'editor'}, c as any);
        expect((c.services.updateUser as any)).toHaveBeenCalled();
    });
});

describe('F8 W2 — language tools', () => {
    it('language.add forwards an addUpdateLanguage call', async () => {
        const c = ctx();
        await languageAdd.handler({symbol: 'fr', label: 'French'}, c as any);
        expect((c.services.languageService.addUpdateLanguage as any)).toHaveBeenCalled();
    });

    it('language.remove routes through deleteLanguage', async () => {
        const c = ctx();
        await languageRemove.handler({symbol: 'fr'}, c as any);
        expect((c.services.languageService.deleteLanguage as any)).toHaveBeenCalled();
    });

    it('language.setDefault forwards to LanguageService.setDefault', async () => {
        const c = ctx();
        await languageSetDefault.handler({symbol: 'lv'}, c as any);
        expect((c.services.languageService.setDefault as any)).toHaveBeenCalledWith({
            symbol: 'lv', editedBy: ACTOR,
        });
    });

    it('all language writes are advanced-only', () => {
        for (const t of ['language.add', 'language.remove', 'language.setDefault']) {
            expect(ADVANCED_ONLY_TOOLS.has(t)).toBe(true);
        }
    });
});

describe('F8 W2 — trash tools', () => {
    it('trash.list returns the parsed group enumeration', async () => {
        const c = ctx();
        const r = await trashList.handler({}, c as any);
        const data = decode(r).data;
        expect(Array.isArray(data)).toBe(true);
        expect(data[0].trashGroup).toBe('tg-1');
    });

    it('trash.list paginates via offset/limit', async () => {
        const c = ctx({
            getTrashGroups: vi.fn(async () => JSON.stringify([
                {trashGroup: 't1', deletedAt: '1', summary: {}},
                {trashGroup: 't2', deletedAt: '2', summary: {}},
                {trashGroup: 't3', deletedAt: '3', summary: {}},
            ])),
        });
        const r = await trashList.handler({offset: 1, limit: 1}, c as any);
        const data = decode(r).data;
        expect(data.length).toBe(1);
        expect(data[0].trashGroup).toBe('t2');
    });

    it('trash.restore routes through restoreFromTrash', async () => {
        const c = ctx();
        await trashRestore.handler({trashGroup: 'tg-1'}, c as any);
        expect((c.services.restoreFromTrash as any)).toHaveBeenCalled();
    });

    it('trash.restore is advanced-only and idempotent', async () => {
        expect(ADVANCED_ONLY_TOOLS.has('trash.restore')).toBe(true);
        const c = ctx();
        const r1 = await trashRestore.handler({trashGroup: 'tg-1', idempotencyKey: 'r-1'}, c as any);
        const r2 = await trashRestore.handler({trashGroup: 'tg-1', idempotencyKey: 'r-1'}, c as any);
        expect(r1).toEqual(r2);
        expect((c.services.restoreFromTrash as any).mock.calls.length).toBe(1);
    });
});

describe('F8 W2 — registry sanity', () => {
    it('every new destructive tool sets idempotent: true', () => {
        const tools = [
            pageUpdate, pageDelete, pageSetParent, pageReorder,
            footerUpdate, seoUpdate, logoUpdate,
            permissionGrant, permissionRevoke, userSetRole,
            languageAdd, languageRemove, languageSetDefault,
            trashRestore,
        ];
        for (const t of tools) expect(t.idempotent).toBe(true);
    });
});
