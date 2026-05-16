import type {McpScope} from '@interfaces/IMcp';
import type {AuditService} from '@services/features/Audit/AuditService';

/**
 * Tool input schema — a hand-rolled subset of JSON Schema 2020-12. We only
 * support the shape we actually need: an object with named properties, a
 * `required` list, primitive types, arrays of primitives or objects, and a
 * boolean default. No `$ref`, no `oneOf`, no `pattern` regexes — when a tool
 * needs more, it should validate inside its handler.
 *
 * DECISION: rolling our own validator avoids pulling `ajv` (~ 200 KB) for
 * what is, in practice, "check the shape and reject anything weird".
 */
export type JSONSchemaType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';

export interface JSONSchemaProp {
    type: JSONSchemaType;
    description?: string;
    enum?: readonly (string | number)[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    items?: JSONSchemaProp;
    properties?: Record<string, JSONSchemaProp>;
    required?: string[];
    default?: unknown;
}

export interface JSONSchemaObject {
    type: 'object';
    required?: string[];
    properties: Record<string, JSONSchemaProp>;
}

export interface McpToolContext {
    /** The MongoDBConnection facade — gives tools access to every domain service. */
    services: any;
    /** "mcp:<token-name>" — passed into `_session.email` for audit stamping. */
    actor: string;
    /** Audit service handle so the dispatcher can log every call 1:1. */
    audit: AuditService | undefined;
    /**
     * Raw bearer secret for the calling MCP token. Set ONLY for tools
     * that need to call back into the CMS over HTTP (e.g.
     * `auth.resetLockouts` posts to `/api/auth/reset-lockout` with this
     * as `Authorization: Bearer …`). The transport layer threads it
     * through; in-process tools never touch it.
     */
    tokenSecret?: string;
    /**
     * Send a `notifications/progress` MCP notification for the current
     * request. No-op when the client didn't pass a `progressToken` in
     * `_meta` (the transport leaves `notify` undefined). Tools that run
     * long enough to benefit (`bundle.export`, `image.rescan`) call this
     * periodically; the client renders progress to the user.
     *
     * `progress` is a count or fraction; if `total` is given the client
     * renders a percent. `message` is a free-text status line — keep it
     * short, no PII / secrets. Errors are swallowed: a notification
     * failure must never abort the underlying tool work.
     */
    notify?: (params: {progress: number; total?: number; message?: string}) => Promise<void>;
}

/**
 * MCP content block. Mirrors the spec's `Content` union — text is the
 * default; image blocks carry base64-encoded bytes + their MIME type so
 * downstream clients can display them inline (Claude included). New
 * block kinds (audio, resource, …) extend this union as the project
 * adopts them.
 */
export type McpContentBlock =
    | {type: 'text'; text: string}
    | {type: 'image'; data: string; mimeType: string};

export interface McpToolResult {
    content: McpContentBlock[];
}

export interface McpToolRateLimit {
    /** Sliding-window cap; defaults are 100/min for read tools, 30/min for writes. */
    maxPerMinute: number;
}

export interface McpTool {
    name: string;
    description: string;
    scopes: McpScope[];
    inputSchema: JSONSchemaObject;
    handler: (args: any, ctx: McpToolContext) => Promise<McpToolResult>;
    /**
     * F8 hardening — when true, calls accepting `idempotencyKey` route
     * through `getIdempotencyService().checkOrRun`. Mandatory for any
     * destructive tool; enforced at registration time in
     * `buildToolRegistry`.
     */
    idempotent?: boolean;
    /**
     * Audit scope label written onto the audit row (`mcp:<scope>`). When
     * omitted the wrapper derives one from the tool name's first segment
     * (`page.delete` → `page`).
     */
    auditScope?: string;
    /** Per-token sliding-window rate limit applied by `withRateLimit`. */
    rateLimit?: McpToolRateLimit;
    /**
     * F8 phase-2 — explicit GraphQL mutation hint for the drift CI.
     * When set, `tools/scripts/mcp-schema-drift.mjs` matches this tool
     * against the named mutation (instead of name-prefix heuristics).
     * Leave unset for tools that don't route through a single GraphQL
     * mutation (read-only direct queries, audit log reads, etc.).
     */
    gqlMutation?: string;
}

export class McpError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'McpError';
    }
}
