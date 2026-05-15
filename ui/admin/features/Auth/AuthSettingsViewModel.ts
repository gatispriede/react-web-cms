import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';

/**
 * AuthSettings ViewModel — auth-split-client-admin Phase 1.A.
 *
 * Backs the admin Customer-login pane with observable state. No
 * `useState` (banned in admin features per VM4 policy). MCP-routed
 * reads and writes keep the same surface as the agent.
 */

export type AuthFlagKey =
    | 'clientLoginEnabled'
    | 'providerMagicLink'
    | 'providerCredentials'
    | 'providerGoogle'
    | 'providerFacebook'
    | 'providerApple';

export interface AuthFlagsView {
    clientLoginEnabled: boolean;
    providerMagicLink: boolean;
    providerCredentials: boolean;
    providerGoogle: boolean;
    providerFacebook: boolean;
    providerApple: boolean;
}

export interface AuthConfigSnapshot {
    flags: AuthFlagsView;
    envReadiness: Record<string, boolean>;
}

async function mcpCall<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name, arguments: args}),
    });
    if (!res.ok) throw new Error(`MCP ${name} failed: ${res.status}`);
    const env = await res.json();
    const text = env?.content?.[0]?.text ?? JSON.stringify(env);
    const parsed = JSON.parse(text);
    if (parsed?.ok === false) throw new Error(parsed?.error?.message || 'MCP error');
    return (parsed?.data ?? parsed) as T;
}

const DEFAULT_FLAGS: AuthFlagsView = {
    clientLoginEnabled: false,
    providerMagicLink: true,
    providerCredentials: false,
    providerGoogle: false,
    providerFacebook: false,
    providerApple: false,
};

export class AuthSettingsViewModel {
    flags: AuthFlagsView = {...DEFAULT_FLAGS};
    envReadiness: Record<string, boolean> = {};
    loading = false;
    busyKey: AuthFlagKey | null = null;
    error: string | null = null;

    constructor() {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const data = await mcpCall<AuthConfigSnapshot>('auth.config.get', {});
            this.flags = {...DEFAULT_FLAGS, ...data.flags};
            this.envReadiness = data.envReadiness ?? {};
        } catch (err) {
            this.error = (err as Error).message;
            notifyError(`Failed to load auth settings: ${this.error}`);
        } finally {
            this.loading = false;
        }
    }

    async toggle(key: AuthFlagKey, next: boolean): Promise<void> {
        this.busyKey = key;
        try {
            await notifyPromise(
                mcpCall<{flags: AuthFlagsView}>('auth.config.set', {path: `auth.${key}`, value: next}),
                {
                    loading: 'Saving…',
                    success: () => 'Saved',
                    error: (e: unknown) => `Save failed: ${(e as Error).message}`,
                },
            );
            this.flags = {...this.flags, [key]: next};
        } finally {
            this.busyKey = null;
        }
    }
}
