import type {ReactNode} from 'react';

export interface CtaAction {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: ReactNode;
    testId?: string;
    disabled?: boolean;
}

export interface StickyCtaBarProps {
    ctas: CtaAction[];
    persistKey: string;
    ariaLabel?: string;
}
