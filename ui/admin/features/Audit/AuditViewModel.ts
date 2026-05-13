import {notifyError} from '@admin/lib/notify';
import AuditApi, {AuditFilter, AuditPage} from '@services/api/client/AuditApi';
import type {AuditEntry, AuditOp} from '@services/features/Audit/AuditService';
import {observable} from '@client/lib/state/observable';

const PAGE_SIZE = 50;

/** VM3 — Audit log admin pane state. */
export class AuditViewModel {
    page: AuditPage = {rows: [], total: 0};
    loading = false;
    offset = 0;

    actor: string | undefined = undefined;
    collection: string | undefined = undefined;
    op: AuditOp | undefined = undefined;
    docIdFilter = '';
    dateRange: [Date | null, Date | null] | null = null;

    collections: string[] = [];
    actors: string[] = [];

    selected: AuditEntry | null = null;

    constructor(private readonly api: AuditApi = new AuditApi()) {
        return observable(this);
    }

    private filter(): AuditFilter {
        return {
            actorEmail: this.actor,
            collection: this.collection,
            op: this.op,
            docId: this.docIdFilter.trim() || undefined,
            since: this.dateRange?.[0]?.toISOString(),
            until: this.dateRange?.[1]?.toISOString(),
            limit: PAGE_SIZE,
            offset: this.offset,
        };
    }

    async loadFilterOptions(): Promise<void> {
        try {
            const [cols, acts] = await Promise.all([this.api.listCollections(), this.api.listActors()]);
            this.collections = cols;
            this.actors = acts;
        } catch { /* swallow — filter dropdowns just stay empty */ }
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.page = await this.api.list(this.filter());
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    setActor(v: string | undefined): void { this.actor = v; this.offset = 0; void this.refresh(); }
    setCollection(v: string | undefined): void { this.collection = v; this.offset = 0; void this.refresh(); }
    setOp(v: AuditOp | undefined): void { this.op = v; this.offset = 0; void this.refresh(); }
    setDocIdFilter(v: string): void { this.docIdFilter = v; this.offset = 0; }
    setDateRange(v: [Date | null, Date | null] | null): void { this.dateRange = v; this.offset = 0; void this.refresh(); }
    setOffset(o: number): void { this.offset = o; void this.refresh(); }
    select(row: AuditEntry | null): void { this.selected = row; }

    resetFilters(): void {
        this.actor = undefined;
        this.collection = undefined;
        this.op = undefined;
        this.docIdFilter = '';
        this.dateRange = null;
        this.offset = 0;
        void this.refresh();
    }

    static get pageSize(): number { return PAGE_SIZE; }
}
