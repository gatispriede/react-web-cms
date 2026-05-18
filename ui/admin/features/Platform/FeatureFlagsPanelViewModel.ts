import {notifyError, notifySuccess} from '@admin/lib/notify';
import {observable} from '@client/lib/state/observable';

export interface FlagRow {
    id: string;
    displayName: string;
    enabled: boolean;
    coreInfrastructure: boolean;
    requires: readonly string[];
    envKey: string;
    envSet: boolean;
    mongoOverride: boolean;
}

async function fetchFlags(): Promise<FlagRow[]> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: `{ mongo { getFeatureFlags } }`}),
    });
    const json = await r.json();
    try { return JSON.parse(json?.data?.mongo?.getFeatureFlags ?? '[]'); } catch { return []; }
}

async function setFlag(id: string, enabled: boolean): Promise<{ok: boolean; error?: string}> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: `mutation Set($id: String!, $enabled: Boolean!) { mongo { setFeatureFlag(id: $id, enabled: $enabled) } }`,
            variables: {id, enabled},
        }),
    });
    const json = await r.json();
    if (json.errors?.length) return {ok: false, error: json.errors[0].message};
    try {
        const parsed = JSON.parse(json?.data?.mongo?.setFeatureFlag ?? '{}');
        if (parsed?.error) return {ok: false, error: parsed.error};
        return {ok: true};
    } catch { return {ok: false, error: 'invalid response'}; }
}

async function clearFlag(id: string): Promise<{ok: boolean; error?: string}> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: `mutation Clear($id: String!) { mongo { clearFeatureFlag(id: $id) } }`,
            variables: {id},
        }),
    });
    const json = await r.json();
    if (json.errors?.length) return {ok: false, error: json.errors[0].message};
    return {ok: true};
}

/** VM3 — Feature-flags admin pane. */
export class FeatureFlagsPanelViewModel {
    rows:     FlagRow[] = [];
    loading   = false;
    savingId: string | null = null;

    constructor(private readonly t: (key: string, opts?: Record<string, unknown>) => string = (k) => k) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try { this.rows = await fetchFlags(); } finally { this.loading = false; }
    }

    async toggle(row: FlagRow, next: boolean): Promise<void> {
        this.savingId = row.id;
        try {
            const res = await setFlag(row.id, next);
            if (!res.ok) { notifyError(res.error ?? this.t('Save failed')); return; }
            notifySuccess(next
                ? this.t('{{name}} enabled', {name: row.displayName})
                : this.t('{{name}} disabled', {name: row.displayName}));
            await this.refresh();
        } finally { this.savingId = null; }
    }

    async reset(row: FlagRow): Promise<void> {
        this.savingId = row.id;
        try {
            const res = await clearFlag(row.id);
            if (!res.ok) { notifyError(res.error ?? this.t('Reset failed')); return; }
            notifySuccess(this.t('Reset to default'));
            await this.refresh();
        } finally { this.savingId = null; }
    }
}
