export type IntegrationStatus = 'live' | 'beta' | 'soon';

export interface Integration {
    key: string;
    name: string;
    logoUrl?: string;
    status: IntegrationStatus;
    href?: string;
    category?: string;
}

export interface IntegrationGridProps {
    testId: string;
    items: Integration[];
    /** Optional active category filter chips. */
    categories?: string[];
}
