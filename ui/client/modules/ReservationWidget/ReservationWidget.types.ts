export interface ReservationSubmission {
    date: string;     // 'YYYY-MM-DD'
    time: string;     // 'HH:MM'
    partySize: number;
    name: string;
    email: string;
    phone?: string;
    notes?: string;
}

export interface ReservationWidgetProps {
    testId: string;
    onSubmit: (sub: ReservationSubmission) => Promise<{ok: true} | {ok: false; error: string}>;
    /** Operator-supplied min party size + max. Default 1 / 12. */
    minPartySize?: number;
    maxPartySize?: number;
    /** Lead-time blocking: smallest ISO date string accepted; defaults to today. */
    minDate?: string;
    /** Operator-overridable labels. */
    headline?: string;
    submitLabel?: string;
    successLabel?: string;
}
