/**
 * KeyValueDossier — structured fact table.
 *
 * Replaces hand-typed `<dl><dt><dd>` snippets operators were stuffing into
 * `RichText` (e.g. `cv-sec-home-vitals`, `cv-sec-home-matrix-platforms` on
 * funisimo.pro). Slot-driven label/value pairs render through the same
 * semantic `<dl>` as before — screen-readers still see a description list.
 *
 * Style variants are theme-tuned, not module-tuned: the JSX is identical
 * across `editorial` / `tech-modern` / `card-grid`; theme SCSS picks the
 * look via `section[data-variant="…"]`. See
 * `services/themes/<slug>/module-styles.scss`.
 *
 * First module through the Claude-design Stitch-substitute pipeline —
 * see `docs/roadmap/_meta/stitch-design-pipeline.md`.
 */

export interface IKeyValueDossierItem {
    /** Mono-typeset label, rendered as `<dt>`. */
    label: string;
    /** Body-typeset value, rendered as `<dd>`. */
    value: string;
    /** When set, the value wraps in `<a href=…>` — accent-colored. */
    href?: string;
}

export interface IKeyValueDossier {
    /** Optional H4 above the list. Omitted when absent. */
    title?: string;
    /** Slot rows. Order preserved. */
    items: IKeyValueDossierItem[];
}

export enum EKeyValueDossierStyle {
    /** Warm cream paper, serif body, monospace labels, hairline rules.
     *  Matches the editorial theme. Default. */
    Editorial = "editorial",
    /** Dark surface, violet mono labels, no rules. saas-landing variant. */
    TechModern = "tech-modern",
    /** Light surface, 3-col mini-cards, label-above-value. Commerce-style. */
    CardGrid = "card-grid",
}
