export enum EEventScheduleAgendaStyle {
    Default = 'default',
    Timeline = 'timeline',
    Cards = 'cards',
    Compact = 'compact',
}

export interface ScheduleSession {
    key: string;
    track: string;
    day: string;
    startTime: string;
    endTime: string;
    title: string;
    speaker?: string;
}

export interface ScheduleTrack {
    key: string;
    label: string;
    color?: string;
}

export interface EventScheduleAgendaProps {
    testId: string;
    tracks: ReadonlyArray<ScheduleTrack>;
    sessions: ScheduleSession[];
    /** Initial selected track keys for the filter; empty array means all. */
    initialFilter?: string[];
    /** Test-only forced layout variant. */
    forceVariant?: 'mobile' | 'desktop';
}
