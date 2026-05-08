/**
 * Pure helpers for reordering a section list that's been grouped by
 * `renderGroupedSections` (host sections with overlays nested inside).
 *
 * **The bug being fixed (Wave 2 Section drag-reorder root cause):**
 *
 * `DynamicTabsContent.renderGroupedSections()` wraps every overlay
 * section inside its preceding non-overlay host's DOM, so
 * `<DraggableWrapper>` sees N grouped children for N hosts + M overlays
 * (= N + M flat sections). Once any overlay flag is set, the grouped
 * children count stops matching the flat sections count.
 *
 * Pre-fix `getChangedPos(currentPos, newPos)` did:
 *
 *     const sections = [...state.sections];   // flat, length N+M
 *     const [moved] = sections.splice(currentPos, 1);
 *     sections.splice(newPos, 0, moved);
 *
 * `currentPos` / `newPos` came from `<DraggableWrapper>` and indexed
 * the GROUPED children (length N). Splicing the flat array with those
 * indices reordered the wrong items — and overlays orphaned from
 * their hosts. Net effect: drag-reorder "did nothing" or "moved the
 * wrong section" depending on overlay placement.
 *
 * **The fix:** translate grouped indices → flat ranges. A host's flat
 * range is its index plus the indices of its trailing overlays. Move
 * the entire range as a unit. With zero overlays the math collapses
 * to the original splice — back-compat preserved.
 */

export interface MaybeOverlayed {
    /** When true, this section is grouped INSIDE the previous non-overlay host. */
    overlay?: boolean;
}

/**
 * Translate a flat sections index to the grouped-children index of the
 * host that contains it. Used by the up/down arrow buttons in
 * `EditWrapper` — they operate over the flat sections array but need
 * to call `getChangedPos` in grouped-index space so overlays travel
 * with their host. An overlay's flat index resolves to its host's
 * grouped index (NOT its own — overlays don't have their own group).
 */
export function flatToGroupedIndex(sections: MaybeOverlayed[], flatIndex: number): number {
    const ranges = computeGroupRanges(sections);
    for (let i = 0; i < ranges.length; i++) {
        const [start, end] = ranges[i];
        if (flatIndex >= start && flatIndex < end) return i;
    }
    return -1;
}

/**
 * Count of groups — i.e. how many drag targets `<DraggableWrapper>`
 * sees. Equals `computeGroupRanges(sections).length` but cheaper since
 * it short-circuits on overlay flag.
 */
export function groupCount(sections: MaybeOverlayed[]): number {
    let n = 0;
    for (let i = 0; i < sections.length; i++) {
        if (!sections[i].overlay || i === 0) n++;
    }
    return n;
}

/**
 * Walk the flat `sections` and return the contiguous range each grouped
 * host occupies. The output's length equals the grouped-children count;
 * each entry carries `[start, endExclusive)` indices into the flat array.
 *
 * Hosts at index 0 with no overlays return `[[0, 1]]`. A host with two
 * trailing overlays returns `[[0, 3]]`. A standalone (no overlays)
 * second host between two hosts with overlays returns
 * `[[0, 2], [2, 3], [3, 5]]`. An overlay at index 0 (no host yet) is
 * promoted to its own host group — matches `renderGroupedSections`'s
 * fallback for "overlay before any host."
 */
export function computeGroupRanges(sections: MaybeOverlayed[]): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let groupStart = -1;
    sections.forEach((s, idx) => {
        if (s.overlay && ranges.length > 0 && groupStart >= 0) {
            // Extend the current group to include this overlay.
            // No-op on indices; range end is recomputed below.
        } else {
            // Close the previous group (if any) at idx, start a new one.
            if (groupStart >= 0) ranges[ranges.length - 1] = [groupStart, idx];
            groupStart = idx;
            ranges.push([idx, idx + 1]); // tentative end; widened by trailing overlays
        }
    });
    // Close the last group at the array's end.
    if (groupStart >= 0) ranges[ranges.length - 1] = [groupStart, sections.length];
    return ranges;
}

/**
 * Reorder sections by moving a host group (host + its trailing overlays)
 * from `fromGroup` to `toGroup`. Indices reference the GROUPED children
 * (i.e. the indices `<DraggableWrapper>` emits), not flat sections.
 *
 * Returns a new sections array; original is not mutated.
 */
export function reorderGroupedSections<T extends MaybeOverlayed>(
    sections: T[],
    fromGroup: number,
    toGroup: number,
): T[] {
    if (fromGroup === toGroup) return [...sections];
    const ranges = computeGroupRanges(sections);
    if (fromGroup < 0 || fromGroup >= ranges.length) return [...sections];
    if (toGroup < 0 || toGroup >= ranges.length) return [...sections];

    // Extract the source range (host + overlays).
    const [fStart, fEnd] = ranges[fromGroup];
    const segment = sections.slice(fStart, fEnd);

    // Remove the source range; everything else collapses into a single array.
    const without = [...sections.slice(0, fStart), ...sections.slice(fEnd)];

    // Match dnd-kit's `arrayMove` semantic: when `toGroup > fromGroup`, the
    // moved segment lands at the END of the target group (after target's
    // last item, before the next group). When `toGroup < fromGroup`, it
    // lands at the START of the target group (before target's first item,
    // after the previous group). Otherwise drags would feel asymmetric to
    // the operator: dragging right would feel "too short," dragging left
    // would feel "right-by-accident."
    const insertAt = toGroup > fromGroup
        ? ranges[toGroup][1] - segment.length  // end of target group, less the removed segment
        : ranges[toGroup][0];                  // start of target group

    return [...without.slice(0, insertAt), ...segment, ...without.slice(insertAt)];
}
