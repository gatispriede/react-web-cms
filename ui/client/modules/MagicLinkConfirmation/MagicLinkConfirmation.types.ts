export interface MagicLinkConfirmationProps {
    testId: string;
    /** The token parsed from the URL — caller-supplied. */
    token: string;
    /** Async verifier — calls /api/account/verify or equivalent. Resolves
     *  on success (server sets session cookie + page wrapper redirects). */
    onConfirm: (token: string) => Promise<{ok: true} | {ok: false; error: string}>;
    /** Optional overrides. */
    headline?: string;
    body?: string;
    confirmLabel?: string;
    successLabel?: string;
}
