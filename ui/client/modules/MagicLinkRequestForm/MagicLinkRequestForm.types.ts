export interface MagicLinkRequestFormProps {
    testId: string;
    /** Async submitter — caller wires to /api/account/magic-link or equivalent. */
    onSubmit: (email: string) => Promise<{sent: true} | {sent: false; error: string}>;
    /** Operator-overridable labels. */
    headline?: string;
    body?: string;
    placeholder?: string;
    submitLabel?: string;
    successHeadline?: string;
    successBody?: string;
}
