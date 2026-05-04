import type {IErrorLog, ErrorSource, ErrorLevel} from '@interfaces/IErrorLog';
import {observable} from '@client/lib/state/observable';

export interface ErrorLogQuery {
    source?: ErrorSource;
    level?: ErrorLevel;
    scope?: string;
    sinceISO?: string;
    limit?: number;
}

async function fetchErrors(args: ErrorLogQuery): Promise<IErrorLog[]> {
    const variables = {
        source: args.source ?? null,
        level: args.level ?? null,
        scope: args.scope ?? null,
        sinceISO: args.sinceISO ?? null,
        limit: args.limit ?? 100,
    };
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            query: `query GetErrorLog($source: String, $level: String, $scope: String, $sinceISO: String, $limit: Int) {
                mongo {
                    getErrorLog(source: $source, level: $level, scope: $scope, sinceISO: $sinceISO, limit: $limit)
                }
            }`,
            variables,
        }),
    });
    const json = await r.json();
    try {
        const parsed = JSON.parse(json?.data?.mongo?.getErrorLog ?? '{}');
        return Array.isArray(parsed.rows) ? parsed.rows : [];
    } catch { return []; }
}

/** VM3 — ErrorLog admin pane state. */
export class ErrorLogViewModel {
    rows: IErrorLog[] = [];
    loading = false;
    filters: ErrorLogQuery = {limit: 100};

    constructor() { return observable(this); }

    setFilter<K extends keyof ErrorLogQuery>(key: K, value: ErrorLogQuery[K]): void {
        this.filters = {...this.filters, [key]: value};
        void this.refresh();
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.rows = await fetchErrors(this.filters);
        } finally {
            this.loading = false;
        }
    }
}
