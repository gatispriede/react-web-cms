export interface IStatsCardStat {
    value: string;
    label: string;
}

export interface IStatsCardFeature {
    text: string;
}

export interface IStatsCard {
    /** Small pill label above the title (e.g. "KOPSAVILKUMS", "SUMMARY"). */
    tag?: string;
    /** Card heading. */
    title?: string;
    /** 2×N stat grid — each stat: big accent number + small mono label. */
    stats: IStatsCardStat[];
    /** Optional checklist below the stat grid — accent checkmark + feature line. */
    features?: IStatsCardFeature[];
}

export enum EStatsCardStyle {
    Default = "default",
    /** Industrial panel — dark panel, yellow accent rule on the left. */
    Panel = "panel",
}
