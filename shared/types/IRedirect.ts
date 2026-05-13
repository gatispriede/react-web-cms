/**
 * Redirect row — W8h roadmap (seo-program § redirect map).
 *
 * Operator-editable redirect table consulted by the Next.js edge
 * middleware before route resolution. Stored in `Redirects` collection;
 * exact-path matching only (no regex / wildcards in v1).
 */
export interface IRedirect {
    /** Mongo `_id` as string. */
    id?: string;
    /** Source path, exact match. Always begins with `/`. */
    from: string;
    /** Target — either absolute URL or root-relative path. */
    to: string;
    /** HTTP status code; 301 (permanent) or 302 (temporary). */
    code: 301 | 302;
    /** Optional human note for the operator. */
    note?: string;
    /** Optional expiry timestamp (ISO). If present and past, redirect is skipped. */
    expiresAt?: string | null;
    /** Audit trail. */
    createdAt?: string;
    editedBy?: string;
    editedAt?: string;
    /** Optimistic-concurrency token. */
    version?: number;
}

export const REDIRECT_CODES: ReadonlyArray<301 | 302> = [301, 302];
