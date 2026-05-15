import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';

/**
 * VM4 ViewModel — backs the admin pane for the
 * `/account/settings` operator surface. No `useState` (banned in
 * admin features per VM4 policy). MCP-routed reads + writes
 * (`site.get-flag` / `site.set-flag`) so the admin and the agent
 * speak the same surface.
 */

export type AccountTab =
    | 'profile'
    | 'security'
    | 'addresses'
    | 'payment'
    | 'notifications'
    | 'privacy'
    | 'language';

export const ALL_ADMIN_TABS: AccountTab[] = [
    'profile', 'security', 'addresses', 'payment', 'notifications', 'privacy', 'language',
];

export interface CustomerAccountSettingsSnapshot {
    enabled: boolean;
    defaultType: 'client' | 'company' | 'ask';
    hiddenTabs: AccountTab[];
}

async function mcp<T>(name: string, args: Record<string, unknown>): Promise<T> {
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

export class CustomerAccountSettingsViewModel {
    enabled = true;
    defaultType: 'client' | 'company' | 'ask' = 'client';
    hiddenTabs: AccountTab[] = [];
    loading = false;
    error: string | null = null;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const [a, b, c] = await Promise.all([
                mcp<{value?: boolean}>('site.get-flag', {path: 'commerce.accountSettingsEnabled'}),
                mcp<{value?: 'client' | 'company' | 'ask'}>('site.get-flag', {path: 'commerce.defaultCustomerType'}),
                mcp<{value?: AccountTab[]}>('site.get-flag', {path: 'commerce.accountSettingsHiddenTabs'}),
            ]);
            this.enabled = a.value !== false;
            this.defaultType = b.value ?? 'client';
            this.hiddenTabs = Array.isArray(c.value) ? c.value : [];
        } catch (err) {
            this.error = (err as Error).message;
            notifyError(`Failed to load: ${this.error}`);
        } finally {
            this.loading = false;
        }
    }

    async setEnabled(next: boolean): Promise<void> {
        await notifyPromise(
            mcp('site.set-flag', {path: 'commerce.accountSettingsEnabled', value: next}),
            {loading: 'Saving…', success: () => 'Saved', error: (e: unknown) => `Save failed: ${(e as Error).message}`},
        );
        this.enabled = next;
    }
    async setDefaultType(next: 'client' | 'company' | 'ask'): Promise<void> {
        await notifyPromise(
            mcp('site.set-flag', {path: 'commerce.defaultCustomerType', value: next}),
            {loading: 'Saving…', success: () => 'Saved', error: (e: unknown) => `Save failed: ${(e as Error).message}`},
        );
        this.defaultType = next;
    }
    async toggleTab(tab: AccountTab, hidden: boolean): Promise<void> {
        const next = hidden
            ? Array.from(new Set([...this.hiddenTabs, tab]))
            : this.hiddenTabs.filter(t => t !== tab);
        await notifyPromise(
            mcp('site.set-flag', {path: 'commerce.accountSettingsHiddenTabs', value: next}),
            {loading: 'Saving…', success: () => 'Saved', error: (e: unknown) => `Save failed: ${(e as Error).message}`},
        );
        this.hiddenTabs = next;
    }
}
