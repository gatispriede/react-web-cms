import {message} from 'antd';
import {observable} from '@client/lib/state/observable';

export interface InquirySummary {
    id: string;
    createdAt: string;
    name: string;
    email: string;
    topic?: string;
    preview: string;
    recipient: string;
    ip: string;
    mail?: {ok?: boolean; error?: string; messageId?: string} | null;
}

export interface InquiryFull extends InquirySummary {
    message: string;
    userAgent?: string;
}

const fetchList = async (): Promise<InquirySummary[]> => {
    const res = await fetch('/api/inquiries', {credentials: 'same-origin'});
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.rows) ? data.rows : [];
};

const fetchOne = async (id: string): Promise<InquiryFull> => {
    const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, {credentials: 'same-origin'});
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
};

const deleteOne = async (id: string): Promise<void> => {
    const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, {method: 'DELETE', credentials: 'same-origin'});
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
};

const deleteAll = async (): Promise<number> => {
    const res = await fetch(`/api/inquiries?all=true`, {method: 'DELETE', credentials: 'same-origin'});
    if (!res.ok) throw new Error(`Delete all failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return Number(data?.deleted ?? 0);
};

/** VM3 — Inquiries admin pane state. */
export class InquiriesViewModel {
    rows: InquirySummary[] = [];
    loading = false;
    openId: string | null = null;
    openDoc: InquiryFull | null = null;
    openLoading = false;

    constructor(private readonly t: (k: string, opts?: Record<string, unknown>) => string = (k) => k) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.rows = await fetchList();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            this.loading = false;
        }
    }

    async openDetail(id: string): Promise<void> {
        this.openId = id;
        this.openLoading = true;
        try {
            this.openDoc = await fetchOne(id);
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
            this.openId = null;
        } finally {
            this.openLoading = false;
        }
    }

    closeDetail(): void {
        this.openId = null;
        this.openDoc = null;
    }

    async remove(id: string): Promise<void> {
        try {
            await deleteOne(id);
            message.success(this.t('Inquiry deleted'));
            await this.refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        }
    }

    async removeAll(): Promise<void> {
        try {
            const deleted = await deleteAll();
            message.success(this.t('Deleted {{n}} inquiries', {n: deleted}));
            await this.refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        }
    }

    get failedCount(): number {
        return this.rows.filter(r => r.mail && r.mail.ok === false).length;
    }
}
