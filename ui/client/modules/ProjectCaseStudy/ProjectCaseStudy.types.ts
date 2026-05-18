export interface CaseStudySection {
    key: string;
    heading: string;
    body: string;
    imageUrl?: string;
}

export interface CaseStudyMetric {
    key: string;
    value: string;
    label: string;
}

export interface ProjectCaseStudyProps {
    testId: string;
    heroImageUrl: string;
    title: string;
    client: string;
    /** Section sequence: typically Context, Process, Outcome. */
    sections: CaseStudySection[];
    metrics?: CaseStudyMetric[];
    /** Next case prompt link at the bottom. */
    nextCase?: {label: string; href: string};
    /** Test-only force reduced-motion render path. */
    forceReducedMotion?: boolean;
}
