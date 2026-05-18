export type ProcessPhaseStatus = 'done' | 'active' | 'pending';

export interface ProcessPhase {
    key: string;
    title: string;
    /** ISO; locale-formatted. */
    date?: string;
    description: string;
    status?: ProcessPhaseStatus;
}

export interface ProcessTimelineProps {
    testId: string;
    phases: ProcessPhase[];
    /** Optional aria-label. Default 'Project process timeline'. */
    ariaLabel?: string;
}
