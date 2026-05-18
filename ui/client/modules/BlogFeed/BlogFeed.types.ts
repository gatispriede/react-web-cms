export interface IBlogFeed {
    limit: number;
    tag: string;
    heading: string;
}

export enum EBlogFeedStyle {
    Default = "default",
    Compact = "compact",
    Magazine = "magazine",
    Cards = "cards",
    Cinema = "cinema",
}
