import {notifyError, notifySuccess} from '@admin/lib/notify';
import {observable} from '@client/lib/state/observable';
import type {IInvoice, InvoiceStatus} from '@interfaces/IInvoice';

/**
 * VM3 — Invoices admin pane state. See
 * `docs/roadmap/storefront/invoicing-and-bookkeeping.md`. Fetches via the
 * `/api/admin/invoices` REST surface (mirror of the MCP `invoice.*` tools).
 */
export class InvoicesViewModel {
    rows: IInvoice[] = [];
    total = 0;
    loading = false;
    statusFilter: InvoiceStatus | 'all' = 'all';
    fromDate: string | null = null;
    toDate: string | null = null;
    detail: IInvoice | null = null;
    /** Operator-toggleable — defaults off so wholesale numbers stay off screenshots. */
    showCogsColumn = false;
    /** Export dialog state. */
    exportOpen = false;
    exportFrom = '';
    exportTo = '';

    constructor() {
        return observable(this);
    }

    setStatusFilter = (s: InvoiceStatus | 'all'): void => {
        this.statusFilter = s;
        void this.refresh();
    };

    setDateRange = (from: string | null, to: string | null): void => {
        this.fromDate = from;
        this.toDate = to;
        void this.refresh();
    };

    selectDetail = (r: IInvoice | null): void => { this.detail = r; };
    toggleCogs = (): void => { this.showCogsColumn = !this.showCogsColumn; };
    openExport = (): void => {
        const today = new Date().toISOString().slice(0, 10);
        const firstOfMonth = today.slice(0, 8) + '01';
        this.exportFrom = firstOfMonth;
        this.exportTo = today;
        this.exportOpen = true;
    };
    closeExport = (): void => { this.exportOpen = false; };
    setExportFrom = (v: string): void => { this.exportFrom = v; };
    setExportTo = (v: string): void => { this.exportTo = v; };

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const params = new URLSearchParams({view: 'list', limit: '100'});
            if (this.statusFilter !== 'all') params.set('status', this.statusFilter);
            if (this.fromDate) params.set('from', this.fromDate);
            if (this.toDate) params.set('to', this.toDate);
            const r = await fetch(`/api/admin/invoices?${params.toString()}`, {credentials: 'same-origin'});
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            this.rows = Array.isArray(data.rows) ? data.rows : [];
            this.total = typeof data.total === 'number' ? data.total : 0;
        } catch (err) {
            notifyError(`Failed to load invoices: ${String((err as Error).message)}`);
            this.rows = [];
            this.total = 0;
        } finally {
            this.loading = false;
        }
    }

    downloadPdf(id: string): void {
        // Opens in a new tab; the API endpoint streams application/pdf.
        window.open(`/api/admin/invoices?view=pdf&id=${encodeURIComponent(id)}`, '_blank', 'noopener');
    }

    async voidInvoice(id: string, reason: 'refund' | 'cancellation' | 'correction', detail?: string): Promise<void> {
        try {
            const r = await fetch('/api/admin/invoices', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'void', invoiceId: id, reason, reasonDetail: detail}),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                throw new Error(e?.error ?? `HTTP ${r.status}`);
            }
            notifySuccess('Credit note issued; invoice voided.');
            await this.refresh();
            this.detail = null;
        } catch (err) {
            notifyError(`Void failed: ${String((err as Error).message)}`);
        }
    }

    async runExport(): Promise<void> {
        if (!this.exportFrom || !this.exportTo) {
            notifyError('Both from and to dates are required.');
            return;
        }
        const url = `/api/admin/invoices?view=export-csv&from=${encodeURIComponent(this.exportFrom)}&to=${encodeURIComponent(this.exportTo)}`;
        window.open(url, '_blank', 'noopener');
        this.exportOpen = false;
    }
}
