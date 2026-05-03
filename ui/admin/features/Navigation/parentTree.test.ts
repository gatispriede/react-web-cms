import {describe, it, expect} from 'vitest';
import {INavigation} from '@interfaces/INavigation';
import {
    isDescendantOrSelf,
    ancestorIds,
    depthOf,
    buildTree,
    MAX_DEPTH,
} from './parentTree';

// 3-level fixture covering the depth cap:
//   root         (id=r,    parent=undef)
//     services   (id=s,    parent=r)
//       cleaning (id=c,    parent=s)
//   about        (id=a,    parent=undef)
const fixture = (): INavigation[] => [
    {id: 'r', type: 'navigation', page: 'Root', sections: [], seo: undefined},
    {id: 's', parent: 'r', type: 'navigation', page: 'Services', sections: [], seo: undefined},
    {id: 'c', parent: 's', type: 'navigation', page: 'Cleaning', sections: [], seo: undefined},
    {id: 'a', type: 'navigation', page: 'About', sections: [], seo: undefined},
];

describe('parentTree.isDescendantOrSelf', () => {
    it('returns true for self', () => {
        expect(isDescendantOrSelf(fixture(), 'r', 'r')).toBe(true);
    });
    it('returns true for direct descendant', () => {
        // Is `s` a descendant of `r`? — yes, s.parent === r.
        expect(isDescendantOrSelf(fixture(), 'r', 's')).toBe(true);
    });
    it('returns true for transitive descendant', () => {
        expect(isDescendantOrSelf(fixture(), 'r', 'c')).toBe(true);
    });
    it('returns false for unrelated node', () => {
        expect(isDescendantOrSelf(fixture(), 'r', 'a')).toBe(false);
    });
    it('returns false for ancestor (cannot be descendant of own child)', () => {
        expect(isDescendantOrSelf(fixture(), 'c', 'r')).toBe(false);
    });
});

describe('parentTree.ancestorIds', () => {
    it('returns empty for root', () => {
        expect(ancestorIds(fixture(), 'r')).toEqual([]);
    });
    it('walks up to root', () => {
        // Cleaning → Services → Root
        expect(ancestorIds(fixture(), 'c')).toEqual(['s', 'r']);
    });
    it('handles unknown id', () => {
        expect(ancestorIds(fixture(), 'nope')).toEqual([]);
    });
});

describe('parentTree.depthOf', () => {
    it('root = 0', () => expect(depthOf(fixture(), 'r')).toBe(0));
    it('child = 1', () => expect(depthOf(fixture(), 's')).toBe(1));
    it('grandchild = 2 (= MAX_DEPTH)', () => {
        expect(depthOf(fixture(), 'c')).toBe(2);
        expect(depthOf(fixture(), 'c')).toBe(MAX_DEPTH);
    });
});

describe('parentTree.buildTree', () => {
    it('groups children under their parent', () => {
        const roots = buildTree(fixture());
        expect(roots).toHaveLength(2); // r + a
        const r = roots.find(n => n.id === 'r')!;
        expect(r.children).toHaveLength(1);
        expect(r.children[0].id).toBe('s');
        expect(r.children[0].children[0].id).toBe('c');
    });
    it('promotes orphan children to roots when parent is missing', () => {
        const orphan: INavigation[] = [
            {id: 'x', parent: 'gone', type: 'navigation', page: 'X', sections: [], seo: undefined},
        ];
        const roots = buildTree(orphan);
        expect(roots).toHaveLength(1);
        expect(roots[0].id).toBe('x');
    });
});
