/**
 * MCP server types — see docs/features/mcp-server.md.
 *
 * Tokens grant a subset of the admin surface to an MCP client (Claude Code,
 * Cursor, etc.). Scopes are deliberately separate from the admin role rank:
 * an MCP token is "admin-grade" by virtue of writing to admin collections,
 * but the token's *capability* is its scope set, not its role. The synthetic
 * `GraphqlSession` the server builds always claims `role: 'admin'` so the
 * underlying `guardMethods` proxy is happy; the MCP server applies its own
 * scope check before dispatch.
 */

export type McpScope =
    | 'read:content'
    | 'write:content'
    | 'read:i18n'
    | 'write:i18n'
    | 'read:themes'
    | 'write:themes'
    | 'read:products'
    | 'write:products'
    | 'read:inventory'
    | 'write:inventory'
    | 'read:site'
    | 'write:site'
    | 'read:audit';

export const ALL_MCP_SCOPES: readonly McpScope[] = [
    'read:content', 'write:content',
    'read:i18n', 'write:i18n',
    'read:themes', 'write:themes',
    'read:products', 'write:products',
    'read:inventory', 'write:inventory',
    'read:site', 'write:site',
    'read:audit',
] as const;

export interface IMcpToken {
    id: string;                 // guid
    name: string;               // human-readable, e.g. "Claude Code laptop"
    /**
     * First 8 chars of the issued raw secret — used to short-circuit verify
     * lookups so we don't bcrypt-compare every token in the table on every
     * call. Not a secret on its own (it's a deterministic prefix of the
     * already-hashed full secret), but treat it as opaque.
     */
    tokenIdPrefix: string;
    hashedSecret: string;       // bcrypt of the issued secret remainder
    scopes: McpScope[];
    createdBy: string;          // admin email
    createdAt: string;          // ISO date
    lastUsedAt?: string;
    expiresAt?: string;         // optional, default 90 days from createdAt
    revokedAt?: string;
}

/** Public view — no `hashedSecret` / `tokenIdPrefix` exposed. */
export interface IMcpTokenSummary {
    id: string;
    name: string;
    scopes: McpScope[];
    createdBy: string;
    createdAt: string;
    lastUsedAt?: string;
    expiresAt?: string;
    revokedAt?: string;
    status: 'active' | 'revoked' | 'expired';
}

export interface IMcpIssuedToken {
    id: string;
    name: string;
    /**
     * Raw secret — shown ONCE on creation. Format: `mcpsk_<8-hex prefix><56-hex remainder>`.
     * The server bcrypts the remainder; the prefix is stored in plain text for fast lookup.
     */
    secret: string;
    scopes: McpScope[];
    expiresAt?: string;
}
