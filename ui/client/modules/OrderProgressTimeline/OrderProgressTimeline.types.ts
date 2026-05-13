export type OrderProgressVariant = 'sale' | 'reservation-deposit';

export type OrderProgressStatus = 'done' | 'active' | 'pending';

export interface OrderProgressStep {
    key: string;
    label: string;
    /** Optional dated milestone, e.g. 'Today, 14:32' or 'Within 24 hours'. */
    date?: string;
    status: OrderProgressStatus;
}

export interface OrderProgressTimelineProps {
    testId: string;
    /** Informational; the variant tag is exposed via data attribute for theming
     *  hooks. Default 'sale'. The caller supplies the resolved step list — the
     *  component does not auto-emit defaults from the variant. */
    variant?: OrderProgressVariant;
    /** Exactly 4 expected; caller-supplied. */
    steps: OrderProgressStep[];
    /** Overrides the default 'Order progress' accessible label. */
    ariaLabel?: string;
}
