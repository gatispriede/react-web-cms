import {message} from 'antd';
import McpTokenApi from '@services/api/client/McpTokenApi';
import {ALL_MCP_SCOPES, IMcpIssuedToken, IMcpTokenSummary, McpScope} from '@interfaces/IMcp';
import {observable} from '@client/lib/state/observable';

export type McpPreset = 'read-only' | 'translations-only' | 'full-access' | 'custom';

export const PRESET_SCOPES: Record<Exclude<McpPreset, 'custom'>, McpScope[]> = {
    'read-only': ['read:content', 'read:i18n', 'read:themes', 'read:products', 'read:inventory', 'read:site', 'read:audit'],
    'translations-only': ['read:i18n', 'write:i18n', 'read:content'],
    'full-access': [...ALL_MCP_SCOPES] as McpScope[],
};

/** VM3 — McpTokens admin pane state. */
export class McpTokensViewModel {
    tokens: IMcpTokenSummary[] = [];
    loading = false;
    issueOpen = false;
    issuedSecret: IMcpIssuedToken | null = null;
    name = '';
    preset: McpPreset = 'full-access';
    scopes: McpScope[] = PRESET_SCOPES['full-access'];
    ttlDays: number | null = 90;

    constructor(private readonly api: McpTokenApi = new McpTokenApi()) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try { this.tokens = await this.api.list(); }
        finally { this.loading = false; }
    }

    openIssueDialog(): void { this.issueOpen = true; }
    closeIssueDialog(): void { this.issueOpen = false; }
    closeIssuedSecret(): void { this.issuedSecret = null; }

    setName(name: string): void { this.name = name; }
    setTtlDays(v: number | null): void { this.ttlDays = v; }

    setPreset(next: McpPreset): void {
        this.preset = next;
        if (next !== 'custom') this.scopes = PRESET_SCOPES[next];
    }

    setScopes(scopes: McpScope[]): void {
        this.preset = 'custom';
        this.scopes = scopes;
    }

    async issue(): Promise<void> {
        if (!this.name.trim()) { void message.error('Token name is required'); return; }
        if (!this.scopes.length) { void message.error('Pick at least one scope'); return; }
        const res = await this.api.issue(this.name.trim(), this.scopes, this.ttlDays);
        if ('error' in res && res.error) { void message.error(res.error); return; }
        this.issuedSecret = res as IMcpIssuedToken;
        this.issueOpen = false;
        this.name = '';
        await this.refresh();
    }

    async revoke(id: string): Promise<void> {
        const res = await this.api.revoke(id);
        if ('error' in res && res.error) { void message.error(res.error); return; }
        void message.success('Revoked');
        await this.refresh();
    }

    async copySecret(): Promise<void> {
        if (!this.issuedSecret) return;
        try {
            await navigator.clipboard.writeText(this.issuedSecret.secret);
            void message.success('Secret copied');
        } catch {
            void message.error('Copy failed — select the text manually');
        }
    }
}
