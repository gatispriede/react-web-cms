/**
 * Manifesto — a huge display-serif paragraph with inline chip references
 * embedded mid-sentence (Studio design-v2 pattern).
 *
 * Body markup uses three inline helpers, mixed freely with prose:
 *   - `*word*`        → italic-accent (as in Hero / Services)
 *   - `{{chip:KEY:LABEL}}` → a rounded pill with a small `thumb` (text inside
 *                           the chip's left circle) and a body label. The KEY
 *                           picks up any matching entry in `chips[]` for
 *                           colour / thumb text; falls back to using LABEL.
 *
 * An optional `addendum` renders a smaller sans-serif paragraph underneath.
 */
export interface IManifestoChip {
    key: string;
    /** Short text inside the chip's left circle (e.g. "REACT", "JS·TS"). */
    thumb: string;
    /** CSS background for the circle (defaults to bg-inset). */
    color?: string;
}

export interface IManifesto {
    body: string;
    addendum?: string;
    chips?: IManifestoChip[];
}

export enum EManifestoStyle {
    Default = "default",
    /** Full-width accent-coloured band — teal/primary bg, accent-ink text (design-v6 Brandappart). */
    Accent = "accent",
}
