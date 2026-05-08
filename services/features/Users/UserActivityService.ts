/**
 * UserActivityService — joins user records against the recent audit-log
 * tail to surface stale accounts and recent-edit fingerprints. Powers
 * `user.list { includeActivity }` and the admin "stale accounts" report.
 *
 * Why a service: AuditLog is an append-only stream and per-user rollups
 * are wanted in two places (MCP + admin). The math is simple but the
 * "page name" join over `audit.diff` is fragile, so we centralise it.
 *
 * The 30-day window is computed against `nowIso` (defaulting to "now") so
 * tests can pin time deterministically.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface UserActivityUserInput {
    email: string;
    lastLoginAt?: string | null;
}

export interface UserActivityAuditRow {
    /** Either `{email}` or a bare email string — both shapes appear in the wild. */
    actor: {email: string} | string;
    collection?: string;
    tag?: string;
    createdAt?: string;
    /** Free-form diff payload — we look for `after.page` / `before.page` only. */
    diff?: any;
}

export interface UserActivity {
    email: string;
    lastLoginAt: string | null;
    /** Count of audit rows authored by this user in the last 30 days. */
    editsLast30d: number;
    /** Distinct page names extracted from those rows, sorted. */
    pagesEdited: string[];
}

function actorEmail(row: UserActivityAuditRow): string | null {
    const a = row.actor;
    if (!a) return null;
    if (typeof a === 'string') return a;
    return typeof a.email === 'string' ? a.email : null;
}

function rowTime(row: UserActivityAuditRow): number | null {
    if (!row.createdAt) return null;
    const t = Date.parse(row.createdAt);
    return Number.isFinite(t) ? t : null;
}

/**
 * Pull a page name out of a diff payload. We try (in order):
 *   - `diff.after.page`
 *   - `diff.before.page`
 *   - `diff.after.pageName`
 *   - `diff.before.pageName`
 * — anything else falls through. This is best-effort: callers rendering
 * the result should treat `pagesEdited` as a hint, not a contract.
 */
function pageFromDiff(diff: any): string | null {
    if (!diff || typeof diff !== 'object') return null;
    const after = diff.after;
    const before = diff.before;
    const tryFields = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (typeof obj.page === 'string' && obj.page.length > 0) return obj.page;
        if (typeof obj.pageName === 'string' && obj.pageName.length > 0) return obj.pageName;
        return null;
    };
    return tryFields(after) ?? tryFields(before);
}

export function scanUserActivity(args: {
    users: readonly UserActivityUserInput[];
    auditRows: readonly UserActivityAuditRow[];
    nowIso?: string;
}): UserActivity[] {
    const now = args.nowIso ? Date.parse(args.nowIso) : Date.now();
    const cutoff = now - THIRTY_DAYS_MS;

    // Pre-aggregate audit by email → count + page set.
    const byEmail = new Map<string, {count: number; pages: Set<string>}>();
    for (const row of args.auditRows) {
        const email = actorEmail(row);
        if (!email) continue;
        const t = rowTime(row);
        if (t === null || t < cutoff) continue;
        let entry = byEmail.get(email);
        if (!entry) {
            entry = {count: 0, pages: new Set<string>()};
            byEmail.set(email, entry);
        }
        entry.count++;
        const page = pageFromDiff(row.diff);
        if (page) entry.pages.add(page);
    }

    return args.users.map(u => {
        const entry = byEmail.get(u.email);
        return {
            email: u.email,
            lastLoginAt: u.lastLoginAt ?? null,
            editsLast30d: entry?.count ?? 0,
            pagesEdited: entry ? [...entry.pages].sort() : [],
        };
    });
}

export interface UserActivityConnection {
    getUsers(): Promise<Array<{email: string; lastLoginAt?: string | null}>>;
    /** AuditService.list({since}) returns `{rows, total}`. */
    auditList(args: {since: Date; limit: number}): Promise<{rows: Array<UserActivityAuditRow & {at?: string | Date}>}>;
}

export interface UserActivitySources {
    users: UserActivityUserInput[];
    auditRows: UserActivityAuditRow[];
}

export async function loadUserActivitySources(conn: UserActivityConnection): Promise<UserActivitySources> {
    const since = new Date(Date.now() - THIRTY_DAYS_MS);
    const [users, audit] = await Promise.all([
        conn.getUsers(),
        conn.auditList({since, limit: 500}),
    ]);
    return {
        users: users.map(u => ({email: u.email, lastLoginAt: u.lastLoginAt ?? null})),
        auditRows: audit.rows.map(r => ({
            actor: r.actor,
            collection: r.collection,
            tag: r.tag,
            // AuditService stores timestamps as `at` (Date); the scanner
            // expects `createdAt` (ISO string). Normalise here.
            createdAt: r.at instanceof Date ? r.at.toISOString() : (typeof r.at === 'string' ? r.at : r.createdAt),
            diff: r.diff,
        })),
    };
}
