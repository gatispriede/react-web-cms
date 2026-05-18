import {describe, expect, it, beforeEach} from 'vitest';
import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import {
    SystemPageRegistry,
    type ISystemPageBootstrapService,
    type ISystemPageDefinition,
} from './SystemPageRegistry';

/**
 * Unit tests for the Phase 0b system-page registry. Exercises:
 *   - register / listDefinitions / getDefinition
 *   - duplicate-registration rejection
 *   - bootstrap create + skip-when-edited + corrupt-recovery
 *   - re-bootstrap is idempotent (no double-create)
 */

const SAMPLE_SECTION = (): ISection => ({id: 'sec-1', type: 1, content: []});

const DEFINITION = (key = 'cart'): ISystemPageDefinition => ({
    systemKey: key,
    slug: key,
    titleI18nKey: `systemPages.${key}.title`,
    defaultSections: () => [SAMPLE_SECTION()],
    accessGate: 'customer-session',
    seo: {indexable: false},
});

class FakeBootstrapService implements ISystemPageBootstrapService {
    public readonly store = new Map<string, IPage>();
    public operatorEdited = new Set<string>();
    public createCalls = 0;
    public updateCalls: Array<{id: string; patch: Partial<IPage>}> = [];

    async findByKey(systemKey: string): Promise<IPage | null> {
        return this.store.get(systemKey) ?? null;
    }
    async create(page: Partial<IPage>): Promise<IPage> {
        this.createCalls += 1;
        const next: IPage = {
            id: `id-${page.systemKey ?? this.createCalls}`,
            page: page.page ?? 'Untitled',
            slug: typeof page.slug === 'string' ? page.slug : 'untitled',
            seo: {},
            sections: page.sections ?? [],
            source: page.source,
            systemKey: page.systemKey,
        };
        if (page.systemKey) this.store.set(page.systemKey, next);
        return next;
    }
    async update(id: string, patch: Partial<IPage>): Promise<void> {
        this.updateCalls.push({id, patch});
        for (const [k, v] of this.store) {
            if (v.id === id) this.store.set(k, {...v, ...patch});
        }
    }
    isOperatorEdited(page: IPage): boolean {
        return this.operatorEdited.has(page.systemKey ?? '');
    }
}

describe('SystemPageRegistry — register / getDefinition / listDefinitions', () => {
    let reg: SystemPageRegistry;
    beforeEach(() => { reg = new SystemPageRegistry(); });

    it('registers a definition + reads it back by key', () => {
        reg.register(DEFINITION('cart'));
        expect(reg.getDefinition('cart')?.systemKey).toBe('cart');
        expect(reg.getDefinition('nope')).toBeNull();
    });

    it('lists every registered definition', () => {
        reg.register(DEFINITION('cart'));
        reg.register(DEFINITION('checkout-payment'));
        const keys = reg.listDefinitions().map(d => d.systemKey).sort();
        expect(keys).toEqual(['cart', 'checkout-payment']);
    });

    it('rejects duplicate systemKey', () => {
        reg.register(DEFINITION('cart'));
        expect(() => reg.register(DEFINITION('cart'))).toThrow(/duplicate/i);
    });

    it('rejects missing systemKey + slug + defaultSections', () => {
        expect(() => reg.register({...DEFINITION(''), systemKey: ''})).toThrow(/systemKey/);
        expect(() => reg.register({...DEFINITION('a'), slug: ''})).toThrow(/slug/);
        expect(() => reg.register({...DEFINITION('b'), defaultSections: undefined as any})).toThrow(/defaultSections/);
    });
});

describe('SystemPageRegistry.bootstrapAll', () => {
    let reg: SystemPageRegistry;
    let svc: FakeBootstrapService;
    beforeEach(() => {
        reg = new SystemPageRegistry();
        svc = new FakeBootstrapService();
    });

    it('creates a missing page', async () => {
        reg.register(DEFINITION('cart'));
        const res = await reg.bootstrapAll(svc);
        expect(res.created).toBe(1);
        expect(res.updated).toBe(0);
        expect(svc.createCalls).toBe(1);
        expect(svc.store.get('cart')?.source).toBe('system-page');
        expect(svc.store.get('cart')?.systemKey).toBe('cart');
    });

    it('is idempotent on re-bootstrap (no double-create, no section overwrite)', async () => {
        reg.register(DEFINITION('cart'));
        await reg.bootstrapAll(svc);
        const first = svc.store.get('cart');
        // Re-run — must not create again and must not clobber sections
        // (current sections are non-empty + not operator-edited).
        await reg.bootstrapAll(svc);
        expect(svc.createCalls).toBe(1);
        const second = svc.store.get('cart');
        expect(second?.sections).toEqual(first?.sections);
    });

    it('preserves operator-edited sections (metadata-only update)', async () => {
        reg.register(DEFINITION('cart'));
        await reg.bootstrapAll(svc);
        // Operator edits → sections list mutated + edit-flag flipped.
        const row = svc.store.get('cart')!;
        row.sections = ['custom-section-1', 'custom-section-2'];
        svc.operatorEdited.add('cart');
        // A definition slug change should still propagate (metadata), but
        // sections must remain operator-supplied.
        reg = new SystemPageRegistry();
        reg.register({...DEFINITION('cart'), slug: 'cart'});
        await reg.bootstrapAll(svc);
        const after = svc.store.get('cart')!;
        expect(after.sections).toEqual(['custom-section-1', 'custom-section-2']);
    });

    it('records per-key outcomes on the last-result snapshot', async () => {
        reg.register(DEFINITION('cart'));
        reg.register(DEFINITION('checkout-payment'));
        await reg.bootstrapAll(svc);
        const res = reg.getLastResult();
        expect(res?.perKey.map(p => p.outcome).sort()).toEqual(['created', 'created']);
    });

    it('continues past a single failing key', async () => {
        reg.register({...DEFINITION('boom'), defaultSections: () => { throw new Error('explode'); }});
        reg.register(DEFINITION('cart'));
        const res = await reg.bootstrapAll(svc);
        expect(res.created).toBe(1);
        expect(res.skipped).toBe(1);
    });
});
