import {observable} from '@client/lib/state/observable';
import type {NotificationCategory} from '@interfaces/INotificationPreferences';

export interface PerCategoryRow {
    category: NotificationCategory;
    both: number;
    email: number;
    inbox: number;
    off: number;
}

export interface NotificationStats {
    customers: number;
    perCategory: PerCategoryRow[];
    recentInboxCount: number;
}

async function fetchStats(): Promise<NotificationStats | null> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: 'query { mongo { notificationStats } }'}),
    });
    const json = await r.json();
    try {
        const parsed = JSON.parse(json?.data?.mongo?.notificationStats ?? '{}');
        if (parsed?.error) return null;
        return parsed as NotificationStats;
    } catch { return null; }
}

/** VM3 — Notifications observability pane state. */
export class NotificationsObservabilityViewModel {
    stats: NotificationStats | null = null;
    loading = false;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.stats = await fetchStats();
        } finally {
            this.loading = false;
        }
    }
}
