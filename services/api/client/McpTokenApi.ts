import {resolve} from "@services/api/generated";
import type {IMcpIssuedToken, IMcpTokenSummary, McpScope} from "@interfaces/IMcp";

const parse = <T,>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { return fallback; }
};

export class McpTokenApi {
    async list(): Promise<IMcpTokenSummary[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.mcpListTokens);
            const parsed = parse<IMcpTokenSummary[] | {error?: string}>(raw, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.error('McpTokenApi.list:', err);
            return [];
        }
    }

    async issue(name: string, scopes: McpScope[], ttlDays?: number | null): Promise<IMcpIssuedToken | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.mcpIssueToken({name, scopes, ttlDays: ttlDays ?? null}));
            const parsed = parse<{mcpIssueToken?: IMcpIssuedToken; error?: string}>(raw, {error: 'no response'});
            return parsed.mcpIssueToken ?? (parsed as {error: string});
        } catch (err) {
            return {error: String(err)};
        }
    }

    async revoke(id: string): Promise<{revoked?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.mcpRevokeToken({id}));
            const parsed = parse<{mcpRevokeToken?: {revoked: boolean}; error?: string}>(raw, {error: 'no response'});
            return parsed.mcpRevokeToken ?? (parsed as {error: string});
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default McpTokenApi;
