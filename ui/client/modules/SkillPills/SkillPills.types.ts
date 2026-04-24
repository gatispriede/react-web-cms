/**
 * SkillPills has three render modes driven by the item's `style`:
 *   - `default` / `compact` — classic tag pills.
 *   - `matrix`     — editorial capability matrix: label + animated bar + 0-10 score.
 *   - `stack-grid` — 6-column tech stack grid (Industrial): per-item category
 *                   label + big name; `featured` items get accent-bg.
 *
 * Items can be plain strings (all rendered the same) or objects with extra
 * fields. The fields each render mode needs are optional — so matrix-only
 * content (scored items) drops cleanly into the stack-grid fallback, and
 * vice versa.
 */
export interface ISkillPillItem {
    label: string;
    /** 0–10 score, drives bar width + displayed number in matrix mode. */
    score?: number;
    /** Per-item category label, e.g. "CORE" / "DATA" (stack-grid mode).
     *  Also visually promotes the row when set. */
    category?: string;
    /** Marks the item as "featured" — accent-coloured bar in matrix mode,
     *  accent-bg cell in stack-grid mode. */
    featured?: boolean;
}

export interface ISkillPills {
    category: string;
    /** Optional subtitle for the group (e.g. "08 entries"). */
    categoryMeta?: string;
    items: Array<string | ISkillPillItem>;
}

export enum ESkillPillsStyle {
    Default = "default",
    Compact = "compact",
    Matrix = "matrix",
    /** 6-column tech stack grid with per-item category labels. */
    StackGrid = "stack-grid",
}
