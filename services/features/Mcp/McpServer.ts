import {IMcpToken, McpScope} from '@interfaces/IMcp';
import type {AuditService} from '@services/features/Audit/AuditService';
import {McpError, McpTool, McpToolResult} from './types';
import {buildToolRegistry} from './tools';
import {validateArgs} from './validate';

/**
 * MCP server core — owns the tool registry and dispatch logic. Transport
 * adapters (stdio / HTTP) wrap this with the protocol-specific pieces.
 *
 * Per call:
 *   1. Look up the tool by name.
 *   2. Check scopes against the verified token.
 *   3. Validate args via the inline JSON-Schema validator.
 *   4. Build a synthetic admin session (`role: 'admin', email: 'mcp:<name>'`)
 *      — the underlying services already accept `_session` and stamp it.
 *   5. Run the handler.
 *   6. Audit-log the call 1:1 with `actor.email = 'mcp:<name>'`.
 */
export interface McpDispatchInput {
    tool: string;
    args: unknown;
    token: IMcpToken;
}

export interface McpServerDeps {
    services: any;            // MongoDBConnection facade
    audit?: AuditService;     // for the 1:1 audit trail
}

export interface McpDispatchOutcome {
    ok: boolean;
    result?: McpToolResult;
    error?: {code: string; message: string};
    durationMs: number;
}

const SECRET_KEYS = new Set(['password', 'secret', 'credential', 'token', 'apiKey', 'authorization']);

/**
 * Best-effort redaction of obvious secrets in argument JSON before audit
 * logging. Not a security boundary — agents shouldn't be passing creds
 * to MCP tools — but a guardrail in case one slips through.
 */
function redact(value: unknown, depth = 0): unknown {
    if (depth > 4) return '[depth]';
    if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SECRET_KEYS.has(k)) out[k] = '***';
            else out[k] = redact(v, depth + 1);
        }
        return out;
    }
    return value;
}

export class McpServer {
    private registry: Map<string, McpTool>;

    constructor(private deps: McpServerDeps) {
        this.registry = buildToolRegistry();
    }

    listTools(): Array<{name: string; description: string; scopes: McpScope[]; inputSchema: unknown}> {
        return Array.from(this.registry.values()).map(t => ({
            name: t.name,
            description: t.description,
            scopes: t.scopes,
            inputSchema: t.inputSchema,
        }));
    }

    hasTool(name: string): boolean {
        return this.registry.has(name);
    }

    /**
     * Run a tool. Errors become structured outcomes — the transport layer
     * decides how to surface them (MCP protocol "isError" vs HTTP 4xx etc.).
     */
    async dispatch(input: McpDispatchInput): Promise<McpDispatchOutcome> {
        const started = Date.now();
        const actor = `mcp:${input.token.name}`;

        const tool = this.registry.get(input.tool);
        if (!tool) {
            return this.finish(actor, input.tool, input.args, started, {
                ok: false, error: {code: 'unknown_tool', message: `Unknown tool: ${input.tool}`},
            });
        }

        // Scope gate.
        for (const required of tool.scopes) {
            if (!input.token.scopes.includes(required)) {
                return this.finish(actor, input.tool, input.args, started, {
                    ok: false,
                    error: {code: 'forbidden', message: `Token missing scope: ${required}`},
                });
            }
        }

        let parsed: Record<string, unknown>;
        try {
            parsed = validateArgs(tool.inputSchema, input.args);
        } catch (err) {
            const code = err instanceof McpError ? err.code : 'invalid_args';
            const message = (err as Error).message ?? 'invalid arguments';
            return this.finish(actor, input.tool, input.args, started, {
                ok: false, error: {code, message},
            });
        }

        try {
            const result = await tool.handler(parsed, {
                services: this.deps.services,
                actor,
                audit: this.deps.audit,
            });
            return this.finish(actor, input.tool, parsed, started, {ok: true, result});
        } catch (err) {
            const code = err instanceof McpError ? err.code : 'handler_error';
            const message = (err as Error).message ?? String(err);
            return this.finish(actor, input.tool, parsed, started, {
                ok: false, error: {code, message},
            });
        }
    }

    private async finish(
        actor: string,
        toolName: string,
        args: unknown,
        startedMs: number,
        outcome: Omit<McpDispatchOutcome, 'durationMs'>,
    ): Promise<McpDispatchOutcome> {
        const durationMs = Date.now() - startedMs;
        const audit = this.deps.audit;
        if (audit) {
            try {
                await audit.record({
                    collection: 'McpToolCall',
                    op: 'create',
                    actor: {email: actor, role: 'admin'},
                    diff: {
                        before: null,
                        after: {
                            tool: toolName,
                            args: redact(args),
                            ok: outcome.ok,
                            error: outcome.error,
                            durationMs,
                        },
                    },
                    tag: outcome.ok ? `mcp:${toolName}:ok` : `mcp:${toolName}:err`,
                });
            } catch (err) {
                console.error('[mcp] audit record failed:', err);
            }
        }
        return {...outcome, durationMs};
    }
}
