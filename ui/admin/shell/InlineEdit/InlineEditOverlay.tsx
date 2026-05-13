import React, {useCallback} from 'react';
import {TFunction} from 'i18next';
import {notifyError} from '@admin/lib/notify';
import SectionApi from '@services/api/client/SectionApi';
import {refreshBus} from '@client/lib/refreshBus';
import {InlineEditHighlight} from './InlineEditHighlight';
import {InlineEditDrawer} from './InlineEditDrawer';
import {useInlineEdit, type InlineEditHoverState} from './useInlineEdit';

/**
 * Top-level shell component for the click-to-edit overlay.
 *
 * Two pieces:
 *   - hover highlight (`<InlineEditHighlight/>`) — outline + pill that
 *     tracks the hovered `[data-edit-target]` element via a position:fixed
 *     div re-measured on scroll/resize.
 *   - click drawer (`<InlineEditDrawer/>`) — slide-out from the right,
 *     pre-populated with the clicked field's current text, persists via
 *     `SectionApi.addRemoveSectionItem` (the same mutation path the
 *     section editor uses).
 *
 * Mounted once in `AdminApp` next to the `<Toaster>` so the listeners are
 * always live for an admin operator. The hook short-circuits when
 * `enabled` is false, so the production build's render of the public
 * pages stays untouched.
 *
 * The persistence path is best-effort for v1: clicked element walks up to
 * its owning section via the `data-edit-section` attribute, the section is
 * looked up in the cached sections, the field's JSON path inside
 * `item.content` is updated, and the section is re-saved. List-of-objects
 * fields (`items.3.label`) are addressable through the same dotted path —
 * see `applyFieldPath`.
 *
 * The hook returns `clearActive` which the drawer calls on close — the
 * overlay re-mounts cleanly on the next click.
 */

interface InlineEditOverlayProps {
    enabled: boolean;
    t: TFunction<'translation', undefined>;
    /** Cached map of `sectionId → ISection` so the overlay can update the
     *  right section without re-fetching. Populated by AdminApp from
     *  `loadNavigationPages`. */
    sectionsById: Map<string, any>;
}

/**
 * Mutate a dotted JSON path inside a parsed content blob. Returns the
 * shallow-cloned root so React-style equality checks notice the change.
 * Supports numeric segments for array indexing (`items.3.label`).
 */
function applyFieldPath(root: any, path: string, value: string): any {
    if (!path) return root;
    const segments = path.split('.');
    const head = segments[0];
    const isArrayIndex = /^\d+$/.test(head);
    if (segments.length === 1) {
        if (Array.isArray(root)) {
            const next = root.slice();
            next[Number(head)] = value;
            return next;
        }
        return {...root, [head]: value};
    }
    const rest = segments.slice(1).join('.');
    if (Array.isArray(root) && isArrayIndex) {
        const idx = Number(head);
        const next = root.slice();
        next[idx] = applyFieldPath(root[idx] ?? {}, rest, value);
        return next;
    }
    const childInput = (root && typeof root === 'object') ? root[head] : undefined;
    const isNextSegmentArray = /^\d+$/.test(segments[1]);
    const child = childInput ?? (isNextSegmentArray ? [] : {});
    return {...root, [head]: applyFieldPath(child, rest, value)};
}

export const InlineEditOverlay: React.FC<InlineEditOverlayProps> = ({enabled, t, sectionsById}) => {
    const {hovered, active, clearActive} = useInlineEdit({enabled});

    const handleSave = useCallback(async (hit: InlineEditHoverState, value: string): Promise<void> => {
        const {target, sectionId} = hit;
        if (target.collection !== 'modules' || !sectionId) {
            // Page / post / product / footer fields land here; full wiring
            // is per-feature follow-up (each editor pane gets to consume
            // the click in its own way). Surface a clear error so the
            // operator knows to open the editor pane directly for now.
            throw new Error(t('Saving {{collection}} fields from the overlay is not wired yet.', {collection: target.collection}));
        }
        const section = sectionsById.get(sectionId);
        if (!section) {
            throw new Error(t('Section {{id}} not found in the loaded set.', {id: sectionId}));
        }
        // Locate the item by `name`. Modules emit `IItem.name` as the id.
        const items: any[] = Array.isArray(section.content) ? section.content : [];
        const idx = items.findIndex(it => (it?.name ?? '') === target.id);
        if (idx < 0) {
            throw new Error(t('Module {{id}} not found in section {{section}}.', {id: target.id, section: sectionId}));
        }
        const current = items[idx];
        let parsed: any;
        try {
            parsed = current.content ? JSON.parse(current.content) : {};
        } catch {
            parsed = {};
        }
        const next = applyFieldPath(parsed ?? {}, target.field, value);
        const sectionApi = new SectionApi();
        // Mutate locally (matches the pattern in `addRemoveSectionItem`),
        // hand the section back to the API to round-trip via the same
        // `addUpdateSectionItem` mutation the section editor uses.
        section.content[idx] = {...current, content: JSON.stringify(next)};
        try {
            await sectionApi.addRemoveSectionItem(sectionId, {
                index: idx,
                type: current.type,
                style: current.style ?? 'default',
                content: JSON.stringify(next),
                action: current.action,
                actionStyle: current.actionStyle,
                actionType: current.actionType,
                actionContent: current.actionContent,
                animation: current.animation,
            }, [section]);
            refreshBus.emit('content');
        } catch (err) {
            notifyError(err);
            throw err;
        }
    }, [sectionsById, t]);

    if (!enabled) return null;

    return (
        <div className="inline-edit-overlay" data-testid="inline-edit-overlay">
            <InlineEditHighlight hovered={hovered}/>
            <InlineEditDrawer active={active} onClose={clearActive} onSave={handleSave} t={t}/>
        </div>
    );
};

export default InlineEditOverlay;
