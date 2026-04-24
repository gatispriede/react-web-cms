export interface ITimelineEntry {
    start: string;
    end: string;
    company: string;
    role: string;
    location?: string;
    /** Website domain shown after the company, e.g. "scichart.com". */
    domain?: string;
    /** Contract / permanent hint, e.g. "Contract", "Permanent". */
    contractType?: string;
    /** "Experience in" bullets — responsibilities/day-to-day. */
    experience?: string[];
    /** "Key achievements" bullets. */
    achievements?: string[];
    /** Optional pull-quote at the bottom of the detail panel. */
    quote?: string;
    /** Heading for the experience list. Falls back to a translated default. */
    experienceTitle?: string;
    /** Heading for the achievements list. Falls back to a translated default. */
    achievementsTitle?: string;
}

export interface ITimeline {
    entries: ITimelineEntry[];
}

export enum ETimelineStyle {
    Default = "default",
    Alternating = "alternating",
    Editorial = "editorial",
    /** Collapses the left period column — just renders the body lines inline.
     *  Used for Dossier "Education" where years live inside each body. */
    Minimal = "minimal",
}
