export interface MetricsCalloutItem {
    key: string;
    value: string;
    description: string;
}

export interface MetricsCalloutProps {
    testId: string;
    items: MetricsCalloutItem[];
    /** Alignment. Default 'center'. */
    align?: 'left' | 'center';
}
