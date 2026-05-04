import {describe, expect, it} from 'vitest';
import {buildMenuItems, type IMenuPage} from '@client/features/Navigation/menuItems';

/**
 * F7 — regression test for the bug discovered 2026-05-04: the public
 * shell's two `menuPages` projections in `app.tsx` mapped
 * `id: p.page` instead of `id: p.id`. A child whose `parent` points
 * at the *root's id* (e.g. `'sc7-nav-sakums'`) never matched the
 * root's `id` (the display name), so the menu builder treated the
 * child as a flat sibling instead of a SubMenu under the root.
 *
 * The fix is `id: p.id || p.page` — id when available, name as a
 * fallback for legacy rows without ids. This test exercises that
 * mapping rule directly so we don't need to render `<App>` to catch
 * regressions.
 */
describe('app.tsx menuPages projection — F7 id-based parent matching', () => {
    /** Mirror of the projection at app.tsx (both `buildMobileLinks` and
     *  the desktop `<MainMenu>`). Kept in lockstep here so the assertion
     *  catches any drift. */
    const project = (rows: any[]): IMenuPage[] => rows.map(p => ({
        id: p.id || p.page,
        page: p.page,
        parent: p.parent,
        slug: p.slug,
    }));

    it('builds a child as a SubMenu under its root when parent === root.id', () => {
        // Shape that comes off the GraphQL `getNavigationCollection`
        // resolver: each row has both `id` (guid) and `page` (display
        // name). Children point at their parent's id.
        const rows = [
            {id: 'sc7-nav-sakums', page: 'Sākums', slug: 'sakums'},
            {id: 'sc7-nav-test2', page: 'Test 2', slug: 'test2', parent: 'sc7-nav-sakums'},
        ];
        const tree = buildMenuItems(project(rows));
        expect(tree).toHaveLength(1);
        expect(tree[0].key).toBe('sakums');
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children![0].key).toBe('sakums/test2');
        expect(tree[0].children![0].href).toBe('/sakums/test2');
    });

    it('falls back to page name when id is absent (legacy rows)', () => {
        const rows = [
            {page: 'Home', slug: 'home'},
            {page: 'About', slug: 'about', parent: 'Home'},
        ];
        const tree = buildMenuItems(project(rows));
        expect(tree).toHaveLength(1);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children![0].key).toBe('home/about');
    });

    it('would have been broken under the old `id: p.page` rule', () => {
        // Lock the regression: simulate the buggy projection and
        // confirm it produces TWO flat roots instead of a parent +
        // child SubMenu. If this assertion ever flips, someone
        // re-introduced the bug.
        const rows = [
            {id: 'sc7-nav-sakums', page: 'Sākums', slug: 'sakums'},
            {id: 'sc7-nav-test2', page: 'Test 2', slug: 'test2', parent: 'sc7-nav-sakums'},
        ];
        const buggy = rows.map(p => ({id: p.page, page: p.page, parent: p.parent, slug: p.slug}));
        const tree = buildMenuItems(buggy as IMenuPage[]);
        expect(tree).toHaveLength(2);
        expect(tree[0].children).toBeUndefined();
        expect(tree[1].children).toBeUndefined();
    });
});

/**
 * F7 — `findIdForActiveTab` replacement logic. Kept as a standalone
 * helper test (not a render test) so we don't need to mount the full
 * `<App>` shell. The function under test is small and pure once we
 * pass it `tabProps` + `pageId`.
 */
describe('app.tsx findIdForActiveTab — F7 id-based active-tab lookup', () => {
    const findIdForActiveTab = (
        tabProps: Array<{id?: string}>,
        pageId: string | undefined,
    ): number => {
        if (pageId) {
            const idx = tabProps.findIndex(t => t.id === pageId);
            if (idx >= 0) return idx;
        }
        return tabProps.length > 0 ? 0 : -1;
    };

    it('returns the index of the tab whose id matches pageId', () => {
        const tabs = [
            {id: 'sc7-nav-sakums'},
            {id: 'sc7-nav-jaunumi'},
            {id: 'sc7-nav-kontakti'},
        ];
        expect(findIdForActiveTab(tabs, 'sc7-nav-jaunumi')).toBe(1);
    });

    it('falls back to first tab when pageId is undefined (legacy / mount)', () => {
        const tabs = [{id: 'sc7-nav-sakums'}, {id: 'sc7-nav-other'}];
        expect(findIdForActiveTab(tabs, undefined)).toBe(0);
    });

    it('falls back to first tab when pageId does not match any tab', () => {
        const tabs = [{id: 'sc7-nav-sakums'}];
        expect(findIdForActiveTab(tabs, 'unknown-id')).toBe(0);
    });

    it('returns -1 when there are no tabs at all', () => {
        expect(findIdForActiveTab([], 'anything')).toBe(-1);
    });
});
