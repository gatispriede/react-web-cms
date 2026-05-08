import {describe, expect, it} from 'vitest';
import {computeGroupRanges, flatToGroupedIndex, groupCount, reorderGroupedSections} from './reorderGroupedSections';

/**
 * Section drag-reorder root-cause regression tests.
 *
 * The bug: pre-fix `getChangedPos` spliced the flat `sections` array with
 * indices coming from `<DraggableWrapper>`, which counts GROUPED children
 * (host + overlays count as ONE child). Once any section was overlay-
 * flagged, the indices diverged and drag-reorder either silently
 * misordered sections OR orphaned overlays from their hosts.
 *
 * These tests pin both the index-translation helper and the reorder
 * itself so any future regression surfaces here first.
 */

describe('computeGroupRanges', () => {
    it('returns one range per section when none are overlays', () => {
        const sections = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
        expect(computeGroupRanges(sections)).toEqual([[0, 1], [1, 2], [2, 3]]);
    });

    it('groups trailing overlays into their host', () => {
        const sections = [
            {id: 'a'},
            {id: 'a-overlay-1', overlay: true},
            {id: 'a-overlay-2', overlay: true},
            {id: 'b'},
        ];
        expect(computeGroupRanges(sections)).toEqual([[0, 3], [3, 4]]);
    });

    it('handles standalone hosts between overlay groups', () => {
        const sections = [
            {id: 'a'},
            {id: 'a-overlay', overlay: true},
            {id: 'b'},          // standalone — no overlays
            {id: 'c'},
            {id: 'c-overlay', overlay: true},
        ];
        expect(computeGroupRanges(sections)).toEqual([[0, 2], [2, 3], [3, 5]]);
    });

    it('promotes leading overlay (no host yet) to its own group', () => {
        const sections = [
            {id: 'orphan-overlay', overlay: true},
            {id: 'host'},
        ];
        expect(computeGroupRanges(sections)).toEqual([[0, 1], [1, 2]]);
    });

    it('returns empty for empty input', () => {
        expect(computeGroupRanges([])).toEqual([]);
    });
});

describe('reorderGroupedSections', () => {
    it('moves a single host (no overlays) — back-compat with the original splice', () => {
        const sections = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
        // Move group 0 to group 2: A → end.
        expect(reorderGroupedSections(sections, 0, 2).map(s => s.id)).toEqual(['b', 'c', 'a']);
        // Move group 2 to group 0: C → start.
        expect(reorderGroupedSections(sections, 2, 0).map(s => s.id)).toEqual(['c', 'a', 'b']);
    });

    it('moves a host AND its overlays as a single unit', () => {
        const sections = [
            {id: 'a'},
            {id: 'a-ov', overlay: true},
            {id: 'b'},
            {id: 'c'},
        ];
        // Grouped children: [HostA(+a-ov), HostB, HostC] — drag HostA to position 2 (end).
        const out = reorderGroupedSections(sections, 0, 2);
        // Expected: B, C, then A + a-ov together at the end.
        expect(out.map(s => s.id)).toEqual(['b', 'c', 'a', 'a-ov']);
    });

    it('moves a multi-overlay host as one unit', () => {
        const sections = [
            {id: 'a'},
            {id: 'a-ov-1', overlay: true},
            {id: 'a-ov-2', overlay: true},
            {id: 'b'},
        ];
        // Drag HostA (with two overlays) past HostB.
        const out = reorderGroupedSections(sections, 0, 1);
        expect(out.map(s => s.id)).toEqual(['b', 'a', 'a-ov-1', 'a-ov-2']);
    });

    it('moves a standalone host between two overlay groups', () => {
        const sections = [
            {id: 'a'},
            {id: 'a-ov', overlay: true},
            {id: 'b'},          // standalone
            {id: 'c'},
            {id: 'c-ov', overlay: true},
        ];
        // Grouped: [HostA(+a-ov), HostB, HostC(+c-ov)]. Drag HostB → position 0.
        const out = reorderGroupedSections(sections, 1, 0);
        expect(out.map(s => s.id)).toEqual(['b', 'a', 'a-ov', 'c', 'c-ov']);
    });

    it('does not orphan overlays — overlays follow their host through the move', () => {
        const sections = [
            {id: 'a'},
            {id: 'b'},
            {id: 'b-ov', overlay: true},
        ];
        // Grouped: [HostA, HostB(+b-ov)]. Drag HostB → position 0.
        const out = reorderGroupedSections(sections, 1, 0);
        // CRITICAL: b-ov stays attached to b, immediately after it.
        expect(out.map(s => s.id)).toEqual(['b', 'b-ov', 'a']);
        // And b-ov's overlay flag is preserved (not the bug's symptom of silent loss).
        expect(out[1].overlay).toBe(true);
    });

    it('returns an unchanged copy when from === to', () => {
        const sections = [{id: 'a'}, {id: 'b'}];
        const out = reorderGroupedSections(sections, 0, 0);
        expect(out).toEqual(sections);
        expect(out).not.toBe(sections);  // new array, not aliased
    });

    it('returns unchanged copy when indices are out of range', () => {
        const sections = [{id: 'a'}, {id: 'b'}];
        expect(reorderGroupedSections(sections, 5, 0).map(s => s.id)).toEqual(['a', 'b']);
        expect(reorderGroupedSections(sections, 0, 5).map(s => s.id)).toEqual(['a', 'b']);
    });

    /** REGRESSION — the exact pre-fix bug. With overlays present, splicing
     *  the FLAT array with GROUPED indices used to misorder. */
    // (regression test continues below)
});

describe('flatToGroupedIndex', () => {
    const sections = [
        {id: 'a'},
        {id: 'a-ov', overlay: true},
        {id: 'b'},
        {id: 'c'},
        {id: 'c-ov', overlay: true},
    ];
    it('host returns its own group', () => {
        expect(flatToGroupedIndex(sections, 0)).toBe(0);
        expect(flatToGroupedIndex(sections, 2)).toBe(1);
        expect(flatToGroupedIndex(sections, 3)).toBe(2);
    });
    it('overlay returns its host group', () => {
        expect(flatToGroupedIndex(sections, 1)).toBe(0); // a-ov belongs to A's group
        expect(flatToGroupedIndex(sections, 4)).toBe(2); // c-ov belongs to C's group
    });
    it('out-of-range returns -1', () => {
        expect(flatToGroupedIndex(sections, -1)).toBe(-1);
        expect(flatToGroupedIndex(sections, 99)).toBe(-1);
    });
});

describe('groupCount', () => {
    it('counts hosts only, not overlays', () => {
        expect(groupCount([{id: 'a'}, {id: 'a-ov', overlay: true}, {id: 'b'}])).toBe(2);
    });
    it('handles empty', () => {
        expect(groupCount([])).toBe(0);
    });
    it('counts a leading overlay as its own host (no preceding host to attach to)', () => {
        expect(groupCount([{id: 'orphan-ov', overlay: true}, {id: 'host'}])).toBe(2);
    });
});

describe('reorderGroupedSections — back-compat-style describe block', () => {
    it('regression: flat-vs-grouped index mismatch (pre-fix bug)', () => {
        const sections = [
            {id: 'A'},
            {id: 'A-overlay', overlay: true},
            {id: 'B'},
            {id: 'C'},
            {id: 'C-overlay', overlay: true},
        ];
        // Operator drags HostC (grouped index 2) to position 0.
        const out = reorderGroupedSections(sections, 2, 0);
        // Correct: C + C-overlay land at start; A + A-overlay stay together; B in between.
        expect(out.map(s => s.id)).toEqual(['C', 'C-overlay', 'A', 'A-overlay', 'B']);
        // Pre-fix would have spliced flat[2]='B' to position 0 and orphaned C-overlay
        // behind A — the silent corruption that motivated the up/down-arrows workaround.
    });
});
