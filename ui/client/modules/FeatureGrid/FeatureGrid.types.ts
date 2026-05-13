import type {ReactNode} from 'react';

export interface FeatureCard {
    key: string;
    title: string;
    description: string;
    icon?: ReactNode;
}

export interface FeatureGridProps {
    testId: string;
    features: FeatureCard[];
    /** Desktop columns. Default 3; allowed 2 or 3. */
    columns?: 2 | 3;
}
