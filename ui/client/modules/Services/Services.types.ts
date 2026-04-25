export interface IServiceRow {
    number: string;
    title: string;
    description: string;
    ctaLabel?: string;
    ctaHref?: string;
    /** Short text/emoji glyph rendered inside a bordered icon square (Industrial grid style). */
    iconGlyph?: string;
    /** Tag chips shown on the card (Industrial grid style). */
    tags?: string[];
}

export interface IServices {
    /** Small mono label above the title (e.g. "§ 03"). Optional. */
    sectionNumber?: string;
    /** Display heading. Words wrapped in `*asterisks*` render as italic-accent. */
    sectionTitle?: string;
    /** Right-aligned short description shown next to the title. Optional. */
    sectionSubtitle?: string;
    rows: IServiceRow[];
}

export enum EServicesStyle {
    Default = "default",
    /** Numbered rows (design-v2 "What I do" layout). */
    Numbered = "numbered",
    /** 3-col card grid with icon + tags (design-v4 Industrial). */
    Grid = "grid",
    /** 3-col card grid with serif title + hover-invert (design-v6 Brandappart). */
    Cards = "cards",
    /** Architecture-tier columns — wider cards, accent rule top, small mono
     *  "FLOW →" caption between cells. Used by the CV CMS-page architecture
     *  section. */
    Tiers = "tiers",
}
