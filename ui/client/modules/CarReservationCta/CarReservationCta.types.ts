export type ReservationState = 'available' | 'reserved-by-other' | 'reserved-by-you' | 'unavailable';

export interface CarReservationCtaProps {
    testId: string;
    state: ReservationState;
    priceFormatted: string;
    /** e.g. 'EUR 500 deposit'. */
    depositFormatted?: string;
    /** Triggers order_createReservation MCP call from the caller. */
    onReserve: () => void | Promise<void>;
    /** Optional cancel-my-reservation handler. */
    onCancel?: () => void | Promise<void>;
    /** Optional contact-seller handler. */
    onContact?: () => void;
    /** Operator-overridable labels. */
    reserveLabel?: string;          // default 'Reserve now'
    contactLabel?: string;          // default 'Contact seller'
    cancelLabel?: string;           // default 'Cancel reservation'
    reservedByOtherLabel?: string;  // default 'Reserved by another buyer'
    reservedByYouLabel?: string;    // default 'You reserved this car'
    unavailableLabel?: string;      // default 'No longer available'
    /** Test-only forced layout variant. */
    forceVariant?: 'mobile' | 'desktop';
}
