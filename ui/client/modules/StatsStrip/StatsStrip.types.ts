/**
 * StatsStrip — a horizontal row of stat cells, e.g.
 *   17 types · 10 cols · 8 themes · ~13 $/mo · 60 s
 * Used as the band that sits between a hero and the first content section
 * on the v2 paper dossiers (Portfolio.html / Portfolio - CMS.html / LSS).
 */
export interface IStatsStripCell {
    /** Big numeric value, e.g. "17". */
    value: string;
    /** Small inline unit suffix, e.g. "types" / "$/mo". */
    unit?: string;
    /** Caption rendered under the value. */
    label?: string;
    /** When true, the cell highlights with the accent fill. */
    highlight?: boolean;
}

export interface IStatsStrip {
    cells: IStatsStripCell[];
}

export enum EStatsStripStyle {
    Default = "default",
    Editorial = "editorial",
}
