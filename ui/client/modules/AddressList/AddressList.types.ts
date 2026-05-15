export interface AddressListAddress {
    id: string;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
    phone?: string;
    /** When true, this address is the default shipping. */
    isDefault?: boolean;
    /** Optional label — 'Home', 'Work'. */
    label?: string;
}

export interface AddressListEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface AddressListProps {
    testId: string;
    addresses: AddressListAddress[];
    onAdd: () => void | Promise<void>;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void | Promise<void>;
    /** Optional set-default callback. When omitted, the 'Make default' button hides. */
    onSetDefault?: (id: string) => void | Promise<void>;
    emptyState?: AddressListEmptyState;
}
