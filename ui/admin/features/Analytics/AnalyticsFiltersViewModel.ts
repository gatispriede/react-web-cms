import {observable} from '@client/lib/state/observable';

/**
 * VM for the analytics filters editor — admin-managed IP allowlist that
 * tags inbound traffic as `audience: 'internal'`.
 *
 * State is the entire filter doc; the service does a wholesale replace
 * on save (no patch). That keeps the read/write API trivial and the
 * audit trail sensible — one row per save, full snapshot.
 */

interface FiltersDoc {
    internalIps: string[];
    labels: Record<string, string>;
    updatedAt?: number;
    updatedBy?: string;
}

async function gqlGet(): Promise<FiltersDoc | null> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `query { mongo { analyticsFiltersGet } }`}),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.analyticsFiltersGet;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            internalIps: Array.isArray(parsed?.internalIps) ? parsed.internalIps : [],
            labels: (parsed?.labels && typeof parsed.labels === 'object') ? parsed.labels : {},
            updatedAt: parsed?.updatedAt,
            updatedBy: parsed?.updatedBy,
        };
    } catch {
        return null;
    }
}

async function gqlSave(input: {internalIps: string[]; labels: Record<string, string>}): Promise<boolean> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `mutation Save($input: JSON!) { mongo { analyticsFiltersUpdate(input: $input) } }`,
                variables: {input},
            }),
        });
        const json = await r.json();
        return Boolean(json?.data?.mongo?.analyticsFiltersUpdate);
    } catch {
        return false;
    }
}

export interface IpRow {
    /** Stable key for AntD list reconciliation; not persisted. */
    key: string;
    ip: string;
    label: string;
}

let rowKeyCounter = 0;
function nextKey(): string { return `ip-${++rowKeyCounter}`; }

export class AnalyticsFiltersViewModel {
    rows:     IpRow[] = [];
    loading  = false;
    saving   = false;
    saved    = false;
    error    = '';
    updatedAt: number | null = null;
    updatedBy: string        = '';

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = '';
        try {
            const doc = await gqlGet();
            if (!doc) {
                this.error = 'Failed to load filters';
                this.rows = [];
                return;
            }
            this.rows = doc.internalIps.map(ip => ({
                key: nextKey(),
                ip,
                label: doc.labels[ip] ?? '',
            }));
            this.updatedAt = doc.updatedAt ?? null;
            this.updatedBy = doc.updatedBy ?? '';
        } finally {
            this.loading = false;
        }
    }

    addRow(): void {
        this.rows = [...this.rows, {key: nextKey(), ip: '', label: ''}];
    }

    updateRow(key: string, patch: Partial<Pick<IpRow, 'ip' | 'label'>>): void {
        this.rows = this.rows.map(r => r.key === key ? {...r, ...patch} : r);
    }

    removeRow(key: string): void {
        this.rows = this.rows.filter(r => r.key !== key);
    }

    async save(): Promise<void> {
        this.saving = true;
        this.saved = false;
        this.error = '';
        try {
            const internalIps = this.rows.map(r => r.ip.trim()).filter(Boolean);
            const labels: Record<string, string> = {};
            for (const r of this.rows) {
                const ip = r.ip.trim();
                if (ip && r.label.trim()) labels[ip] = r.label.trim();
            }
            const ok = await gqlSave({internalIps, labels});
            if (!ok) {
                this.error = 'Save failed';
                return;
            }
            this.saved = true;
            await this.refresh();
        } finally {
            this.saving = false;
        }
    }
}
