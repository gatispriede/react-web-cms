import {message} from 'antd';
import PublishApi from '@services/api/client/PublishApi';
import type {SnapshotMeta} from '@services/features/Publishing/PublishService';
import {observable} from '@client/lib/state/observable';

/** VM3 — Publishing admin pane state. */
export class PublishingViewModel {
    history: SnapshotMeta[] = [];
    loading = false;
    rollingBack: string | null = null;

    constructor(
        private readonly api: PublishApi = new PublishApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try { this.history = await this.api.getHistory(100); }
        finally { this.loading = false; }
    }

    async rollback(id: string): Promise<void> {
        this.rollingBack = id;
        try {
            const result = await this.api.rollback(id);
            if (result.error) { message.error(result.error); return; }
            message.success(this.t('Rolled back — new snapshot created.'));
            await this.refresh();
        } finally {
            this.rollingBack = null;
        }
    }
}
