import {describe, it, expect, vi} from 'vitest';

// Mock the connection so inquiry-tool calls hit an in-memory collection
// instead of a real Mongo. This mirrors `modeEnforcement.test.ts`'s approach.
const mailerSpy = vi.fn(async (_p: unknown) => ({ok: true, messageId: 'mock-msg'}));
vi.mock('@client/pages/api/_inquiryMailer', () => ({
    sendInquiryEmail: (p: unknown) => mailerSpy(p),
}));

// Stateful in-memory `Inquiries` collection — enough surface for our
// list/delete/markRead handlers. Reset between tests via `__reset()`.
const store: any[] = [];
const fakeCollection = {
    find: () => ({
        sort: () => ({
            skip: () => ({
                limit: () => ({
                    toArray: async () => store.slice(),
                }),
            }),
        }),
    }),
    deleteOne: async ({id}: {id: string}) => {
        const before = store.length;
        const idx = store.findIndex(r => r.id === id);
        if (idx >= 0) store.splice(idx, 1);
        return {deletedCount: before - store.length};
    },
    updateOne: async ({id}: {id: string}, op: any) => {
        const row = store.find(r => r.id === id);
        if (!row) return {matchedCount: 0, modifiedCount: 0};
        Object.assign(row, op.$set ?? {});
        return {matchedCount: 1, modifiedCount: 1};
    },
};
const fakeUserService = {getUser: async () => undefined};
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        database: {collection: () => fakeCollection},
        userService: fakeUserService,
    }),
}));

import {moduleAdd, moduleUpdate, moduleRemove} from '../tools/modules';
import {inquiryList, inquiryDelete, inquiryMarkRead, emailSend} from '../tools/inquiries';

const ACTOR = 'mcp:test';

const makeCtx = (overrides: Partial<any> = {}) => ({
    actor: ACTOR,
    audit: undefined,
    services: {
        navigationService: {
            getSections: async (ids: string[]) =>
                ids.map(id => ({id, content: [{type: 'TEXT', style: 'default', content: '{}', action: 'none', actionStyle: 'default', actionType: 'TEXT', actionContent: '{}', animation: 'fade-in'}], version: 1})),
        },
        addUpdateSectionItem: vi.fn(async ({section}: any) => JSON.stringify({ok: true, id: section.id, count: (section.content ?? []).length})),
        ...overrides.services,
    },
    ...overrides,
});

const parse = (out: any) => {
    const env = JSON.parse(out.content[0].text);
    // F8 phase-2: compose() wraps successful results in {ok: true, data: ...}
    return env && typeof env === 'object' && 'ok' in env && env.ok === true ? env.data : env;
};

describe('module.add', () => {
    it('appends a module to a section.content array and persists via addUpdateSectionItem', async () => {
        const ctx = makeCtx();
        const out = await moduleAdd.handler(
            {sectionId: 'sec1', module: {type: 'INQUIRY_FORM', content: '{"title":"Hi"}'}},
            ctx as any,
        );
        expect(parse(out).count).toBe(2);
        const call = (ctx.services.addUpdateSectionItem as any).mock.calls[0][0];
        expect(call.section.content).toHaveLength(2);
        expect(call.section.content[1].type).toBe('INQUIRY_FORM');
        expect(call.section.content[1].style).toBe('default');
        expect(call.expectedVersion).toBe(1);
    });

    it('inserts at the requested index when `at` is provided', async () => {
        const ctx = makeCtx();
        const out = await moduleAdd.handler(
            {sectionId: 'sec1', module: {type: 'IMAGE'}, at: 0},
            ctx as any,
        );
        expect(parse(out).count).toBe(2);
        const call = (ctx.services.addUpdateSectionItem as any).mock.calls[0][0];
        expect(call.section.content[0].type).toBe('IMAGE');
    });

    it('rejects when section is not found', async () => {
        const ctx = makeCtx({services: {navigationService: {getSections: async () => []}}});
        const out = await moduleAdd.handler({sectionId: 'nope', module: {type: 'TEXT'}}, ctx as any);
        expect(parse(out)).toEqual({ok: false, error: 'section not found'});
    });

    it('schema marks `sectionId` and `module` as required', () => {
        expect(moduleAdd.inputSchema.required).toEqual(['sectionId', 'module']);
    });
});

describe('module.update', () => {
    it('replaces the module at the given index', async () => {
        const ctx = makeCtx();
        await moduleUpdate.handler({sectionId: 'sec1', module: {type: 'IMAGE'}, at: 0}, ctx as any);
        const call = (ctx.services.addUpdateSectionItem as any).mock.calls[0][0];
        expect(call.section.content).toHaveLength(1);
        expect(call.section.content[0].type).toBe('IMAGE');
    });

    it('rejects out-of-range index', async () => {
        const ctx = makeCtx();
        const out = await moduleUpdate.handler({sectionId: 'sec1', module: {type: 'IMAGE'}, at: 5}, ctx as any);
        expect(parse(out).ok).toBe(false);
    });
});

describe('module.remove', () => {
    it('drops the module at the given index', async () => {
        const ctx = makeCtx();
        await moduleRemove.handler({sectionId: 'sec1', at: 0}, ctx as any);
        const call = (ctx.services.addUpdateSectionItem as any).mock.calls[0][0];
        expect(call.section.content).toHaveLength(0);
    });
});

describe('inquiry.list', () => {
    it('returns rows mapped to the summary shape', async () => {
        store.length = 0;
        store.push({id: 'i1', name: 'Anna', email: 'a@x', topic: 't', message: 'hi there', createdAt: '2026-05-04', read: true, recipient: 'r@x', mail: {ok: true}});
        const out = await inquiryList.handler({limit: 10}, {actor: ACTOR} as any);
        const body = parse(out);
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].id).toBe('i1');
        expect(body.rows[0].read).toBe(true);
        expect(body.rows[0].preview).toBe('hi there');
    });
});

describe('inquiry.delete', () => {
    it('removes a row by id', async () => {
        store.length = 0;
        store.push({id: 'i2', name: 'B', email: 'b@x', message: 'm'});
        const out = await inquiryDelete.handler({id: 'i2'}, {actor: ACTOR} as any);
        expect(parse(out).deleted).toBe(1);
        expect(store).toHaveLength(0);
    });
});

describe('inquiry.markRead', () => {
    it('flips the read flag', async () => {
        store.length = 0;
        store.push({id: 'i3', read: false, message: 'm'});
        const out = await inquiryMarkRead.handler({id: 'i3'}, {actor: ACTOR} as any);
        const body = parse(out);
        expect(body.modified).toBe(1);
        expect(body.read).toBe(true);
        expect(store[0].read).toBe(true);
    });

    it('honors read=false', async () => {
        store.length = 0;
        store.push({id: 'i4', read: true, message: 'm'});
        await inquiryMarkRead.handler({id: 'i4', read: false}, {actor: ACTOR} as any);
        expect(store[0].read).toBe(false);
    });
});

describe('email.send', () => {
    it('routes through the inquiry mailer', async () => {
        mailerSpy.mockClear();
        const out = await emailSend.handler(
            {to: 'x@y.com', subject: 'Hi', body: 'Hello there'},
            {actor: ACTOR} as any,
        );
        expect(parse(out).ok).toBe(true);
        expect(mailerSpy).toHaveBeenCalledTimes(1);
        const arg = (mailerSpy.mock.calls[0] as any)[0];
        expect(arg.to).toBe('x@y.com');
        expect(arg.subject).toBe('Hi');
        expect(arg.text).toBe('Hello there');
        expect(arg.html).toContain('Hello there');
    });

    it('escapes HTML when bodyHtml is not provided', async () => {
        mailerSpy.mockClear();
        await emailSend.handler(
            {to: 'x@y.com', subject: 'S', body: '<script>alert(1)</script>'},
            {actor: ACTOR} as any,
        );
        const arg = (mailerSpy.mock.calls[0] as any)[0];
        expect(arg.html).not.toContain('<script>');
        expect(arg.html).toContain('&lt;script&gt;');
    });

    it('schema requires to/subject/body', () => {
        expect(emailSend.inputSchema.required).toEqual(['to', 'subject', 'body']);
    });
});

describe('tool registration / advanced gating', () => {
    it('destructive new tools are on the advanced-only allowlist', async () => {
        const {ADVANCED_ONLY_TOOLS} = await import('../ADVANCED_TOOLS');
        expect(ADVANCED_ONLY_TOOLS.has('module.add')).toBe(true);
        expect(ADVANCED_ONLY_TOOLS.has('module.update')).toBe(true);
        expect(ADVANCED_ONLY_TOOLS.has('module.remove')).toBe(true);
        expect(ADVANCED_ONLY_TOOLS.has('inquiry.delete')).toBe(true);
        expect(ADVANCED_ONLY_TOOLS.has('email.send')).toBe(true);
    });

    it('ALL_MCP_TOOLS includes the new entries', async () => {
        const {ALL_MCP_TOOLS} = await import('../tools/index');
        const names = ALL_MCP_TOOLS.map(t => t.name);
        for (const n of ['module.add', 'module.update', 'module.remove', 'inquiry.list', 'inquiry.delete', 'inquiry.markRead', 'email.send']) {
            expect(names).toContain(n);
        }
    });
});
