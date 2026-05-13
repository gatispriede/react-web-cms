export interface CarFinanceEstimatorSubmission {
    name: string;
    email: string;
    phone?: string;
    /** Preferred monthly payment range. Both in minor units of the listing currency. */
    minMonthly: number;
    maxMonthly: number;
    notes?: string;
}

export interface CarFinanceEstimatorProps {
    testId: string;
    /** Car this estimate is bound to — routed to the inquiry pipeline. */
    productId: string;
    /** Caller wires to the inquiry MCP / endpoint. Resolves on success. */
    onSubmit: (submission: CarFinanceEstimatorSubmission) => Promise<{ok: true} | {ok: false; error: string}>;
    /** Operator-overridable labels. */
    headline?: string;       // default 'Check if financing fits'
    body?: string;           // default 'Tell us a preferred monthly payment range. ...'
    submitLabel?: string;    // default 'Request a quote'
    successLabel?: string;   // default 'Thanks — we'll be in touch within a business day.'
}
