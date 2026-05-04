export type ErrorSource = 'client' | 'admin' | 'server' | 'mcp';
export type ErrorLevel = 'error' | 'warn';

export interface IErrorLog {
    /** Mongo `_id` — auto-assigned, not exposed to clients. */
    id: string;
    /** Where the failure originated. `client` = public site visitor browser,
     *  `admin` = admin-side browser, `server` = SSR/resolver/route-handler,
     *  `mcp` = an AI tool call via the MCP transport. */
    source: ErrorSource;
    level: ErrorLevel;
    /** Free-text summary — first line of the error or the throw message. */
    message: string;
    /** Stack trace if available. Rendered with sourcemaps in the admin UI. */
    stack?: string;
    /** Dot-namespaced verb-or-noun pinning what failed (e.g. `theme.save`,
     *  `auth.signin`, `module.add`, `revalidate.fetch`). Helps grep + groupings. */
    scope?: string;
    /** Page / pathname where the error fired. For `client`/`admin` sources
     *  this is `window.location.pathname`; for `server` it's the request
     *  URL. */
    route?: string;
    /** Authenticated identity at the moment of the failure, if any. */
    userId?: string;
    userKind?: 'admin' | 'editor' | 'viewer' | 'customer' | 'anonymous';
    /** Browser fingerprint — UA string + viewport. Server entries leave blank. */
    userAgent?: string;
    /** Build SHA at the time the failing code was deployed. Mismatch with
     *  current deploy = stale tab needs reload. */
    buildId?: string;
    /** Free-form context the caller wants to attach (request id, payload
     *  hash, GraphQL operation name, MCP token id, …). */
    extra?: Record<string, unknown>;
    /** ISO8601, server-stamped on insert. */
    ts: string;
}
