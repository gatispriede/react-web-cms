export interface ITestimonial {
    quote: string;
    name: string;
    role?: string;
    /** Single-letter avatar glyph (defaults to first character of `name`). */
    avatarInitial?: string;
}

export interface ITestimonials {
    /** Display heading. Supports `*italic accent*` runs. */
    sectionTitle?: string;
    /** Short paragraph next to the heading (right column on wide viewports). */
    sectionSubtitle?: string;
    items: ITestimonial[];
}

export enum ETestimonialsStyle {
    Default = "default",
    /** 3-col card grid (design-v2). */
    Cards = "cards",
}
