import {notifyError, notifySuccess} from '@admin/lib/notify';
import McpTokenApi from '@services/api/client/McpTokenApi';
import {ALL_MCP_SCOPES, IMcpIssuedToken, IMcpTokenSummary, McpScope} from '@interfaces/IMcp';
import {observable} from '@client/lib/state/observable';
import {GuardedAction} from '@admin/lib/useGuardedAction';

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

    /** F2 — top-level mirror so the Proxy notifies on `pending` changes. */
    revokePending = false;
    revokeAction!: GuardedAction<[string]>;

    constructor(private readonly api: McpTokenApi = new McpTokenApi()) {
        const proxy = observable(this);
        proxy.revokeAction = new GuardedAction<[string]>(
            async (_g, id) => {
                const res = await proxy.api.revoke(id);
                if ('error' in res && res.error) { notifyError(res.error); return; }
                // TODO: wire Undo — MCP token revoke is irreversible (no trash collection).
                notifySuccess('Revoked');
                await proxy.refresh();
            },
            {onPendingChange: (v) => { proxy.revokePending = v; }},
        );
        return proxy;
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
        if (!this.name.trim()) { notifyError('Token name is required'); return; }
        if (!this.scopes.length) { notifyError('Pick at least one scope'); return; }
        const res = await this.api.issue(this.name.trim(), this.scopes, this.ttlDays);
        if ('error' in res && res.error) { notifyError(res.error); return; }
        this.issuedSecret = res as IMcpIssuedToken;
        this.issueOpen = false;
        this.name = '';
        await this.refresh();
    }

    async revoke(id: string): Promise<void> {
        await this.revokeAction.trigger(id);
    }

    async copySecret(): Promise<void> {
        if (!this.issuedSecret) return;
        try {
            await navigator.clipboard.writeText(this.issuedSecret.secret);
            notifySuccess('Secret copied');
        } catch {
            notifyError('Copy failed — select the text manually');
        }
    }
}
