export type PaymentMethodKind = 'card' | 'bank' | 'paypal';

export interface PaymentMethodRow {
    id: string;
    kind: PaymentMethodKind;
    /** e.g. 'Visa ending 4242' or 'IBAN ending …8901'. */
    label: string;
    /** Optional expiry (cards only) — 'MM/YYYY'. */
    expiresAt?: string;
    isDefault?: boolean;
}

export interface PaymentMethodListEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface PaymentMethodListProps {
    testId: string;
    methods: PaymentMethodRow[];
    onAdd: () => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
    onSetDefault?: (id: string) => void | Promise<void>;
    emptyState?: PaymentMethodListEmptyState;
}
