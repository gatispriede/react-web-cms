import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Db, MongoClient} from 'mongodb';
import {ProductService} from '@services/features/Products/ProductService';
import {ThemeService} from '@services/features/Themes/ThemeService';
import {LanguageService} from '@services/features/Languages/LanguageService';
import {InventoryService} from '@services/features/Inventory/InventoryService';
import {MockAdapter} from '@services/features/Inventory/adapters/MockAdapter';
import {AuditService} from '@services/features/Audit/AuditService';
import {McpServer} from '@services/features/Mcp/McpServer';
import type {IMcpToken} from '@interfaces/IMcp';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

interface Harness {
    server: McpServer;
    services: any;
    audit: AuditService;
}

const tokenWith = (scopes: IMcpToken['scopes'], name = 'test'): IMcpToken => ({
    id: 'tok-' + name,
    name,
    tokenIdPrefix: '00000000',
    hashedSecret: 'na',
    scopes,
    createdBy: 'admin@x',
    createdAt: new Date().toISOString(),
});

beforeEach(async () => {
    db = client.db(`mcpsrv_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

const buildHarness = (): Harness => {
    const productService = new ProductService(db);
    const themeService = new ThemeService(db);
    const languagesDB = db.collection('Languages');
    const languageService = new LanguageService(languagesDB, async () => {});
    const inventoryService = new InventoryService(db, productService, () => new MockAdapter());
    const audit = new AuditService(db);
    const navStub = {
        getNavigationCollection: async () => [],
        getSections: async () => [],
        addUpdateNavigationItem: async () => JSON.stringify({ok: true}),
    };
    // Synthetic services facade — the McpServer just walks `.productService.foo()`
    // / `.saveProduct(...)` etc., so a plain object with the needed members is
    // sufficient. Mirrors the real MongoDBConnection delegation surface.
    const services: any = {
        productService,
        themeService,
        languageService,
        inventoryService,
        navigationService: navStub,
        // Delegate-style surface that McpServer tools call directly.
        saveProduct: async ({product, _session, expectedVersion}: any) => {
            const res = await productService.save(product, _session?.email, expectedVersion ?? null);
            return JSON.stringify({saveProduct: res});
        },
        setProductPublished: async ({id, publish, _session}: any) => {
            const res = await productService.setPublished(id, publish, _session?.email);
            return JSON.stringify({setProductPublished: res});
        },
        setActiveTheme: async ({id, _session}: any) => {
            const res = await themeService.setActive(id, _session?.email);
            return JSON.stringify({setActiveTheme: res});
        },
        saveTheme: async ({theme, _session, expectedVersion}: any) => {
            const res = await themeService.saveTheme(theme, _session?.email, expectedVersion ?? null);
            return JSON.stringify({saveTheme: res});
        },
        addUpdateSectionItem: async () => JSON.stringify({ok: true}),
        removeSectionItem: async () => JSON.stringify({ok: true}),
        inventoryStatus: async () => JSON.stringify(await inventoryService.getStatus()),
        inventorySyncDelta: async () => JSON.stringify({inventorySyncDelta: {runId: 'r1', status: 'succeeded'}}),
        inventoryReadDeadLetters: async ({limit}: any) => JSON.stringify(await inventoryService.readDeadLetters({limit})),
    };
    const server = new McpServer({services, audit});
    return {server, services, audit};
};

describe('McpServer dispatch', () => {
    it('product.create — happy path runs the handler and writes an audit row', async () => {
        const {server} = buildHarness();
        const out = await server.dispatch({
            tool: 'product.create',
            args: {title: 'Widget', sku: 'W-1', price: 1000, currency: 'EUR'},
            token: tokenWith(['write:products'], 'cli'),
        });
        expect(out.ok).toBe(true);
        const body = JSON.parse(out.result!.content[0].text);
        expect(body.saveProduct?.id).toBeTruthy();
        expect(body.saveProduct?.slug).toBe('widget');
        // Audit row present, tagged actor 'mcp:cli'.
        const audit = await db.collection('AuditLog').find({collection: 'McpToolCall'}).toArray();
        expect(audit).toHaveLength(1);
        expect((audit[0] as any).actor.email).toBe('mcp:cli');
        expect((audit[0] as any).tag).toBe('mcp:product.create:ok');
    });

    it('rejects calls missing the required scope', async () => {
        const {server} = buildHarness();
        const out = await server.dispatch({
            tool: 'product.create',
            args: {title: 'X', sku: 'X', price: 1, currency: 'EUR'},
            token: tokenWith(['read:products']),
        });
        expect(out.ok).toBe(false);
        expect(out.error?.code).toBe('forbidden');
    });

    it('rejects calls with invalid args (schema validation)', async () => {
        const {server} = buildHarness();
        const out = await server.dispatch({
            tool: 'product.create',
            // missing `title` + `currency`
            args: {sku: 'X', price: 1},
            token: tokenWith(['write:products']),
        });
        expect(out.ok).toBe(false);
        expect(out.error?.code).toBe('invalid_args');
    });

    it('theme.setActive — switches the active theme via the synthetic admin session', async () => {
        const {server, services} = buildHarness();
        await services.themeService.seedIfEmpty();
        const themes = await services.themeService.getThemes();
        const target = themes[1];
        const out = await server.dispatch({
            tool: 'theme.setActive',
            args: {id: target.id},
            token: tokenWith(['write:themes']),
        });
        expect(out.ok).toBe(true);
        const active = await services.themeService.getActive();
        expect(active?.id).toBe(target.id);
    });

    it('i18n.upsertKeys — bulk-upserts translation keys grouped by symbol', async () => {
        const {server, services} = buildHarness();
        const out = await server.dispatch({
            tool: 'i18n.upsertKeys',
            args: {
                entries: [
                    {symbol: 'en', key: 'hi', value: 'Hi'},
                    {symbol: 'en', key: 'bye', value: 'Bye'},
                    {symbol: 'lv', key: 'hi', value: 'Sveiki'},
                ],
            },
            token: tokenWith(['write:i18n']),
        });
        expect(out.ok).toBe(true);
        const langs = await services.languageService.getLanguages();
        expect(langs.find((l: any) => l.symbol === 'en')?.translations?.hi).toBe('Hi');
        expect(langs.find((l: any) => l.symbol === 'lv')?.translations?.hi).toBe('Sveiki');
    });

    it('inventory.status — happy-path read', async () => {
        const {server} = buildHarness();
        const out = await server.dispatch({
            tool: 'inventory.status',
            args: {},
            token: tokenWith(['read:inventory']),
        });
        expect(out.ok).toBe(true);
        const body = JSON.parse(out.result!.content[0].text);
        expect(body.adapterId).toBe('mock');
    });

    it('audit.list — returns rows from the audit log', async () => {
        const {server, audit} = buildHarness();
        await audit.record({collection: 'Probe', op: 'create', actor: {email: 'tester@x'}});
        const out = await server.dispatch({
            tool: 'audit.list',
            args: {collection: 'Probe'},
            token: tokenWith(['read:audit']),
        });
        expect(out.ok).toBe(true);
        const body = JSON.parse(out.result!.content[0].text);
        expect(body.total).toBeGreaterThanOrEqual(1);
        expect(body.rows[0].collection).toBe('Probe');
    });

    it('unknown tool returns a structured error', async () => {
        const {server} = buildHarness();
        const out = await server.dispatch({
            tool: 'no.such.tool',
            args: {},
            token: tokenWith(['read:content']),
        });
        expect(out.ok).toBe(false);
        expect(out.error?.code).toBe('unknown_tool');
    });
});
