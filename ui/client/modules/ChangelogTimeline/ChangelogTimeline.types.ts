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
