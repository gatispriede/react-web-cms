import {useEffect, useRef, useState, useCallback} from 'react';
import {parseInlineEditTarget, InlineEditTarget} from '@interfaces/InlineEdit';

/**
 * Click + hover tracking for the inline-edit overlay. Attaches two listeners
 * to the document: a capture-phase `click` that intercepts any element with
 * a `data-edit-target` (preventing the default content interaction so the
 * editor can open instead) and a `mouseover` / `mouseout` pair that drives
 * the visual highlight.
 *
 * The hook is scoped to a single host container ref — when the container
 * isn't mounted (or admin is viewer-only) the listeners no-op.
 *
 * Returns the current hovered target (for the highlight), the active click
 * target (for the drawer), and a `clearActive` action the drawer calls on
 * close.
 *
 * No-mutating bag of state — kept small so the parent overlay component
 * stays display-only.
 */

export interface UseInlineEditOptions {
    enabled: boolean;
}

export interface InlineEditHoverState {
    target: InlineEditTarget;
    element: HTMLElement;
    /** SectionId walked up from a `data-edit-section` ancestor. Used by the
     *  drawer to dispatch the persistence call against the right section. */
    sectionId?: string;
}

export function useInlineEdit({enabled}: UseInlineEditOptions) {
    const [hovered, setHovered] = useState<InlineEditHoverState | undefined>(undefined);
    const [active, setActive] = useState<InlineEditHoverState | undefined>(undefined);
    // Cached element ref for the active click — the drawer uses it to scroll
    // back into view if the operator dismisses + re-clicks.
    const activeElementRef = useRef<HTMLElement | undefined>(undefined);

    const clearActive = useCallback(() => {
        setActive(undefined);
        activeElementRef.current = undefined;
    }, []);

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const findTarget = (raw: EventTarget | null): InlineEditHoverState | undefined => {
            if (!(raw instanceof HTMLElement)) return undefined;
            const el = raw.closest<HTMLElement>('[data-edit-target]');
            if (!el) return undefined;
            const target = parseInlineEditTarget(el.getAttribute('data-edit-target'));
            if (!target) return undefined;
            // Walk up looking for the owning section. Modules emit a
            // `data-edit-section="<sectionId>"` on their root `<section>`
            // (see `SectionContent.tsx`). When absent (e.g. a non-section
            // entity like a Footer field), `sectionId` stays undefined
            // and the dispatcher takes the page-level path.
            const sectionEl = el.closest<HTMLElement>('[data-edit-section]');
            const sectionId = sectionEl?.getAttribute('data-edit-section') ?? undefined;
            return {element: el, target, sectionId};
        };

        const onMouseOver = (evt: MouseEvent) => {
            const hit = findTarget(evt.target);
            if (!hit) return;
            setHovered(prev => (prev?.element === hit.element ? prev : hit));
        };

        const onMouseOut = (evt: MouseEvent) => {
            const related = evt.relatedTarget;
            if (related instanceof HTMLElement && related.closest('[data-edit-target]')) return;
            setHovered(undefined);
        };

        const onClick = (evt: MouseEvent) => {
            const hit = findTarget(evt.target);
            if (!hit) return;
            // Only intercept the click — don't navigate. Allow modifier-keys
            // (cmd/ctrl) to pass through so power-users can still middle/cmd
            // click a link inside the editable region.
            if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
            evt.preventDefault();
            evt.stopPropagation();
            activeElementRef.current = hit.element;
            setActive(hit);
        };

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('mouseout', onMouseOut, true);
        document.addEventListener('click', onClick, true);
        return () => {
            document.removeEventListener('mouseover', onMouseOver, true);
            document.removeEventListener('mouseout', onMouseOut, true);
            document.removeEventListener('click', onClick, true);
        };
    }, [enabled]);

    return {hovered, active, clearActive, activeElementRef};
}
