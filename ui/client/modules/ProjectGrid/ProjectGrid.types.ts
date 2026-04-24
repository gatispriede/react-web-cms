export interface IProjectGridItem {
    /** Project name shown under the cover. */
    title: string;
    /** Short stack / domain string under the title. */
    stack?: string;
    /** 2-line sublabel on the right (e.g. "Contract<br/>UK / USA"). */
    kind?: string;
    /** Year or range shown on the cover pill (e.g. "2024 — PRESENT"). */
    year?: string;
    /** Short letters rendered inside the cover (e.g. "SC"). Defaults to first 2 chars of title. */
    coverArt?: string;
    /** CSS `background` value for the cover (gradient, image URL, etc.). */
    coverColor?: string;
    /** "View engagement ↗" label at the bottom. */
    moreLabel?: string;
    /** Project detail URL. */
    href?: string;
}

export interface IProjectGrid {
    /** Section head — title / sub / number (matches Studio s-head treatment). */
    sectionNumber?: string;
    sectionTitle?: string;
    sectionSubtitle?: string;
    items: IProjectGridItem[];
}

export enum EProjectGridStyle {
    Default = "default",
    /** Studio — 2-col cards with colored gradient covers + art letters. */
    Studio = "studio",
}
