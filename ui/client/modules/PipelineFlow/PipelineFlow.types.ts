/**
 * PipelineFlow — linear CI/CD or build-pipeline visualisation.
 * Each step renders as a card (label, status pill, notes); arrows between
 * steps are drawn purely with CSS borders.
 */
export interface IPipelineStep {
    label: string;
    /** "ok" | "warn" | "fail" | free string — drives pill colour. */
    status?: string;
    notes?: string;
    /** Mono caps duration / commit hash (e.g. "0:42"). */
    meta?: string;
}

export interface IPipelineFlow {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    steps?: IPipelineStep[];
    /** Mono caps label above the side-notes column. */
    sideNotesLabel?: string;
    sideNotes?: string[];
}

export enum EPipelineFlowStyle {
    Default = "default",
    Editorial = "editorial",
}
