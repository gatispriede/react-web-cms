/**
 * Inline-edit overlay contract — shared between the public render side
 * (which emits `data-edit-target` on content-bearing elements) and the
 * admin shell (which parses the value on click and routes to the right
 * editor).
 *
 * The Sanity Presentation pattern. See `docs/roadmap/admin/admin-inline-editing.md`.
 *
 * The on-the-wire string format is intentionally compact (kept on the DOM,
 * one per rendered field, so a 200-node page may carry 200 of them):
 *
 *   `<collection>/<id>/<field>`        e.g. `modules/<moduleName>/headline`
 *   `<collection>/<id>/<field>:<sub>`  e.g. `modules/<moduleName>/items:3.label`
 *
 * `id` is the most-stable identifier the module knows for the item it's
 * rendering — for module-typed `IItem`s this is `item.name` (a per-section
 * slot label that survives content rewrites), so the click handler can
 * dispatch back to the editor pane that owns the same name. Falls back
 * to `${type}@${sectionId}#${index}` if `item.name` is unset.
 *
 * `field` is the dotted JSON path inside the parsed `item.content` blob
 * (e.g. `headline`, `items.3.label`). The drawer renders a simple
 * text/textarea input pre-focused on that path and persists via the
 * existing `module.update` path.
 */

export type InlineEditCollection =
    | 'modules'
    | 'pages'
    | 'sections'
    | 'posts'
    | 'products';

export interface InlineEditTarget {
    /** Which top-level entity the edit belongs to. */
    collection: InlineEditCollection;
    /** Stable id within that collection. `modules` uses `IItem.name`. */
    id: string;
    /** Dotted JSON path inside the entity's content blob. */
    field: string;
}

const VALID_COLLECTIONS: ReadonlyArray<InlineEditCollection> = [
    'modules', 'pages', 'sections', 'posts', 'products',
];

/**
 * Format a target as the `data-edit-target` attribute value. Defensive
 * about empty inputs — returns `undefined` if any required piece is
 * missing so the JSX `data-edit-target={format(...)}` form drops the
 * attribute entirely (no `data-edit-target=""` litter on the DOM).
 */
export function formatInlineEditTarget(
    target: Partial<InlineEditTarget> | undefined,
): string | undefined {
    if (!target) return undefined;
    const {collection, id, field} = target;
    if (!collection || !id || !field) return undefined;
    // Slashes inside the id or field would break the round-trip. Sanitise
    // by replacing them. ids should not normally contain slashes (they're
    // either Mongo ObjectIds or per-section name labels), but defensive.
    const safeId = String(id).replace(/\//g, '_');
    const safeField = String(field).replace(/\//g, '_');
    return `${collection}/${safeId}/${safeField}`;
}

/**
 * Parse a `data-edit-target` attribute back into the structured form.
 * Returns `undefined` for anything malformed so the dispatcher can drop
 * the click silently rather than throwing inside an event listener.
 */
export function parseInlineEditTarget(raw: string | null | undefined): InlineEditTarget | undefined {
    if (!raw) return undefined;
    const parts = raw.split('/');
    if (parts.length < 3) return undefined;
    const [collection, id, ...rest] = parts;
    if (!VALID_COLLECTIONS.includes(collection as InlineEditCollection)) return undefined;
    if (!id) return undefined;
    const field = rest.join('/');
    if (!field) return undefined;
    return {collection: collection as InlineEditCollection, id, field};
}
