import {describe, expect, it} from 'vitest';
import {
    activeKeysForPath,
    ancestorsFor,
    buildMenuItems,
    slugChainFor,
    type IMenuPage,
} from './menuItems';

/**
 * F1 sub-pages — pure menu-items builder tests. Render-tests for the
 * AntD `<Menu>` itself are an integration concern (out of scope per
 * docs/roadmap/sub-pages.md, decision 6 — "in scope from day one"
 * refers to theme styling, not full DOM render-tests).
 */
describe('buildMenuItems', () => {
    const fixture: IMenuPage[] = [
        {id: 'home', page: 'Home'},
        {id: 'services', page: 'Services'},
        {id: 'cleaning', page: 'Cleaning', parent: 'services'},
        {id: 'office-cleaning', page: 'Office', parent: 'cleaning'},
        {id: 'about', page: 'About'},
    ];

    it('emits flat top-level items for sites without sub-pages', () => {
        const flat: IMenuPage[] = [
            {id: 'a', page: 'A'},
            {id: 'b', page: 'B'},
        ];
        const items = buildMenuItems(flat);
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({key: 'a', href: '/a', label: 'A'});
        expect(items[0].children).toBeUndefined();
    });

    it('groups children under their parent as nested nodes', () => {
        const items = buildMenuItems(fixture);
        expect(items.map(i => i.key)).toEqual(['home', 'services', 'about']);
        const services = items.find(i => i.key === 'services')!;
        expect(services.children).toHaveLength(1);
        expect(services.children![0].key).toBe('services/cleaning');
        expect(services.children![0].href).toBe('/services/cleaning');
    });

    it('supports the 3-level depth cap (root + 2 child levels)', () => {
        const items = buildMenuItems(fixture);
        const services = items.find(i => i.key === 'services')!;
        const cleaning = services.children![0];
        expect(cleaning.children).toHaveLength(1);
        expect(cleaning.children![0].key).toBe('services/cleaning/office');
        expect(cleaning.children![0].href).toBe('/services/cleaning/office');
    });

    it('honours an explicit `slug` over the slugified `page` name', () => {
        const items = buildMenuItems([
            {id: 'svc', page: 'Our Services', slug: 'services'},
            {id: 'c', page: 'Cleaning Corp', slug: 'corp', parent: 'svc'},
        ]);
        const svc = items[0];
        expect(svc.href).toBe('/services');
        expect(svc.children![0].href).toBe('/services/corp');
    });

    it('embeds the locale prefix when provided', () => {
        const items = buildMenuItems(
            [{id: 'a', page: 'A'}, {id: 'b', page: 'B', parent: 'a'}],
            {locale: 'lv'},
        );
        expect(items[0].href).toBe('/lv/a');
        expect(items[0].children![0].href).toBe('/lv/a/b');
    });

    it('treats orphan children (parent id missing) as root nodes', () => {
        const items = buildMenuItems([
            {id: 'a', page: 'A'},
            {id: 'orphan', page: 'Orphan', parent: 'gone'},
        ]);
        expect(items.map(i => i.key)).toEqual(['a', 'orphan']);
    });

    it('passes the translate fn over the visible label', () => {
        const items = buildMenuItems(
            [{id: 'a', page: 'About'}],
            {translate: s => `[t]${s}`},
        );
        expect(items[0].label).toBe('[t]About');
    });
});

describe('slugChainFor / ancestorsFor', () => {
    const pages: IMenuPage[] = [
        {id: 'a', page: 'Services', slug: 'services'},
        {id: 'b', page: 'Cleaning', slug: 'cleaning', parent: 'a'},
        {id: 'c', page: 'Office', slug: 'office', parent: 'b'},
    ];
    it('walks chain root → self', () => {
        const c = pages.find(p => p.id === 'c')!;
        expect(slugChainFor(c, pages)).toEqual(['services', 'cleaning', 'office']);
        expect(ancestorsFor(c, pages).map(p => p.id)).toEqual(['a', 'b', 'c']);
    });
    it('returns single-element chain for a root', () => {
        const a = pages.find(p => p.id === 'a')!;
        expect(slugChainFor(a, pages)).toEqual(['services']);
    });
    it('breaks safely on a cycle', () => {
        const cyclic: IMenuPage[] = [
            {id: 'x', page: 'X', parent: 'y'},
            {id: 'y', page: 'Y', parent: 'x'},
        ];
        const chain = slugChainFor(cyclic[0], cyclic);
        expect(chain.length).toBeLessThanOrEqual(2);
    });
});

describe('activeKeysForPath', () => {
    const pages: IMenuPage[] = [
        {id: 'a', page: 'Services', slug: 'services'},
        {id: 'b', page: 'Cleaning', slug: 'cleaning', parent: 'a'},
        {id: 'c', page: 'About', slug: 'about'},
    ];
    it('returns expanding ancestor keys for a leaf', () => {
        expect(activeKeysForPath(pages, ['services', 'cleaning']))
            .toEqual(['services', 'services/cleaning']);
    });
    it('returns just the root for a top-level page', () => {
        expect(activeKeysForPath(pages, ['about'])).toEqual(['about']);
    });
    it('returns [] when the path matches no page', () => {
        expect(activeKeysForPath(pages, ['nope'])).toEqual([]);
    });
});
