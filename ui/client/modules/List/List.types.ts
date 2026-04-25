/**
 * Generic key/value list module. Rendered shape is driven by per-item style:
 *  - `default` (bulleted list): each item = label · value line.
 *  - `facts` (editorial key/value): mono-caps label left, value (link-optional)
 *    right, dashed rules — Dossier Contact / Signals.
 *  - `inline`: flex-row of label+value chips.
 *  - `cases` (project/case cards): 2-col card grid — each item's `prefix`
 *    renders as a big accent year, `label` as the big title, `meta` as a
 *    mono-caps sub-label, `value` as the description paragraph, `tags[]`
 *    as chip row. Drives the Industrial "projektu kartītes" layout.
 */
export interface IListItem {
    label: string;
    value?: string;
    href?: string;
    /** Accent-coloured prefix shown above the title (e.g. "2024"). */
    prefix?: string;
    /** Small secondary prefix underneath (e.g. "— TAGAD" / "— 2023"). */
    prefixSub?: string;
    /** Small mono/caps sub-label shown under the title. */
    meta?: string;
    /** Chip row rendered under the description. */
    tags?: string[];
}

export interface IList {
    title?: string;
    items: IListItem[];
}

export enum EListStyle {
    Default = "default",
    Facts = "facts",
    Inline = "inline",
    /** 2-col project / case-card grid (Industrial). */
    Cases = "cases",
    /** 4-col grid of editorial paper cards — mono-caps prefix top-left, label, value paragraph (Dossier "Key technologies" B.01-B.12). */
    PaperGrid = "paper-grid",
}
