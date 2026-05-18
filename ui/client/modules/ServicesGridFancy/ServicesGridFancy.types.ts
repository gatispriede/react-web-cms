import type React from 'react';

export interface FancyService {
    key: string;
    icon?: React.ReactNode;
    title: string;
    blurb: string;
    href?: string;
}

export interface ServicesGridFancyProps {
    testId: string;
    services: FancyService[];
    /** Desktop columns. Default 3. */
    columns?: 2 | 3;
}
