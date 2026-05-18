import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import {
    defineFlag,
    getFlagDefinition,
    isBoolean,
    isFiniteNumber,
    isOneOf,
    isString,
    listFlagDefinitions,
    _resetFlagRegistryForTests,
} from '@services/features/Seo/siteFlagDefinitions';

describe('siteFlagDefinitions — registry primitives', () => {
    beforeEach(() => {
        _resetFlagRegistryForTests();
    });

    it('defineFlag + listFlagDefinitions round-trip preserves insertion order', () => {
        defineFlag({
            path: 'commerce.checkoutEnabled' as any,
            defaultValue: true,
            typeGuard: isBoolean,
            description: 'A',
        });
        defineFlag({
            path: 'auth.clientLoginEnabled' as any,
            defaultValue: false,
            typeGuard: isBoolean,
            description: 'B',
        });
        const all = listFlagDefinitions();
        expect(all).toHaveLength(2);
        expect(all[0].path).toBe('commerce.checkoutEnabled');
        expect(all[1].path).toBe('auth.clientLoginEnabled');
    });

    it('getFlagDefinition returns the registered def, or null for unknown', () => {
        defineFlag({
            path: 'commerce.checkoutEnabled' as any,
            defaultValue: true,
            typeGuard: isBoolean,
            description: '',
        });
        expect(getFlagDefinition('commerce.checkoutEnabled')?.defaultValue).toBe(true);
        expect(getFlagDefinition('commerce.nonExistent')).toBeNull();
    });

    it('re-registering the same path overrides the previous definition', () => {
        defineFlag({
            path: 'commerce.checkoutEnabled' as any,
            defaultValue: true,
            typeGuard: isBoolean,
            description: 'first',
        });
        defineFlag({
            path: 'commerce.checkoutEnabled' as any,
            defaultValue: false,
            typeGuard: isBoolean,
            description: 'second',
        });
        expect(listFlagDefinitions()).toHaveLength(1);
        expect(getFlagDefinition('commerce.checkoutEnabled')?.description).toBe('second');
    });
});

describe('siteFlagDefinitions — type-guards', () => {
    it('isBoolean', () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
        expect(isBoolean('true')).toBe(false);
        expect(isBoolean(0)).toBe(false);
        expect(isBoolean(null)).toBe(false);
    });

    it('isString', () => {
        expect(isString('hi')).toBe(true);
        expect(isString('')).toBe(true);
        expect(isString(0)).toBe(false);
        expect(isString(undefined)).toBe(false);
    });

    it('isFiniteNumber', () => {
        expect(isFiniteNumber(0)).toBe(true);
        expect(isFiniteNumber(-1.5)).toBe(true);
        expect(isFiniteNumber(NaN)).toBe(false);
        expect(isFiniteNumber(Infinity)).toBe(false);
        expect(isFiniteNumber('1')).toBe(false);
    });

    it('isOneOf narrows to the literal union', () => {
        const guard = isOneOf(['retail', 'wholesale', 'both'] as const);
        expect(guard('retail')).toBe(true);
        expect(guard('wholesale')).toBe(true);
        expect(guard('both')).toBe(true);
        expect(guard('other')).toBe(false);
        expect(guard(null)).toBe(false);
    });
});

// Integration: register two flags via `defineFlag()` and verify they
// flow through `SiteFlagsService.get / save` correctly without any edit
// to the service file.
describe('siteFlagDefinitions — SiteFlagsService integration', () => {
    let mongod: MongoMemoryServer;
    let client: MongoClient;
    let db: Db;
    let service: SiteFlagsService;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        client = await MongoClient.connect(mongod.getUri());
    });

    afterAll(async () => {
        await client?.close();
        await mongod?.stop();
    });

    beforeEach(() => {
        db = client.db(`flagdef_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
        service = new SiteFlagsService(db);
        _resetFlagRegistryForTests();
        defineFlag({
            path: 'commerce.checkoutEnabled' as any,
            defaultValue: true,
            typeGuard: isBoolean,
            audience: 'public-readable',
            description: 'Master toggle for storefront checkout.',
        });
        defineFlag({
            path: 'auth.clientLoginEnabled' as any,
            defaultValue: false,
            typeGuard: isBoolean,
            audience: 'public-readable',
            description: 'Whether the public site exposes a client login.',
        });
    });

    afterEach(() => {
        _resetFlagRegistryForTests();
    });

    it('get() returns the registered defaults when nothing is stored', async () => {
        const flags = await service.get();
        expect(flags.commerce?.checkoutEnabled).toBe(true);
        expect(flags.auth?.clientLoginEnabled).toBe(false);
    });

    it('save() persists a sub-record patch and get() reads it back', async () => {
        await service.save({commerce: {checkoutEnabled: false}, auth: {clientLoginEnabled: true}});
        const flags = await service.get();
        expect(flags.commerce?.checkoutEnabled).toBe(false);
        expect(flags.auth?.clientLoginEnabled).toBe(true);
    });

    it('save() rejects malformed sub-record values via typeGuard', async () => {
        await service.save({commerce: {checkoutEnabled: 'yes' as any}});
        const flags = await service.get();
        // Fell back to the default (true).
        expect(flags.commerce?.checkoutEnabled).toBe(true);
    });

    it('save() drops unregistered keys (schema-drift defence)', async () => {
        await service.save({commerce: {unknownKey: 'value'} as any});
        const flags = await service.get();
        expect((flags.commerce as any).unknownKey).toBeUndefined();
    });

    it('legacy top-level flags continue to read/write across the refactor', async () => {
        await service.save({blogEnabled: false, layoutMode: 'scroll', allowGuestCheckout: false});
        const flags = await service.get();
        expect(flags.blogEnabled).toBe(false);
        expect(flags.layoutMode).toBe('scroll');
        expect(flags.allowGuestCheckout).toBe(false);
    });
});
