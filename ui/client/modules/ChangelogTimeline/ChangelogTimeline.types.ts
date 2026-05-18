export type ChangelogTag = 'feature' | 'fix' | 'breaking' | 'security';

export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    body?: string;
    tags?: ChangelogTag[];
}

export interface ChangelogTimelineProps {
    testId: string;
    /** Caller supplies entries in the desired order; the component does NOT re-sort. */
    entries: ChangelogEntry[];
    maxEntries?: number;
}

export enum EChangelogTimelineStyle {
    Default = "default",
    /** Each entry as an elevated card. */
    Cards = "cards",
    /** `$ git log --oneline` monospace output. */
    Terminal = "terminal",
    /** Red/green diff-style changed-line aesthetic. */
    Diff = "diff",
}
