import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise, notifySuccess} from '@admin/lib/notify';
import BackupApi, {type BackupOpResult, type BackupSnapshotRow, type BackupStatus} from '@services/api/client/BackupApi';

/**
 * W8e — view-model for the backup admin pane. VM3 (no React state).
 * The view binds directly to observable properties.
 */
export class BackupPanelViewModel {
    status: BackupStatus = {last: null, lastDrill: null, history: []};
    snapshots: BackupSnapshotRow[] = [];
    loading = false;
    listing = false;
    running: 'backup' | 'verify' | null = null;
    restoringId: string | null = null;
    lastOp: BackupOpResult | null = null;

    constructor(
        private readonly api: BackupApi = new BackupApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    get disabled(): boolean {
        const reason = (this.status.last as {reason?: string} | null)?.reason;
        return reason === 'backup-disabled';
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.status = await this.api.status();
        } finally {
            this.loading = false;
        }
        await this.refreshSnapshots();
    }

    async refreshSnapshots(): Promise<void> {
        this.listing = true;
        try {
            const r = await this.api.listSnapshots();
            this.snapshots = r.snapshots;
        } finally {
            this.listing = false;
        }
    }

    async backupNow(): Promise<void> {
        this.running = 'backup';
        try {
            const result = await notifyPromise(this.api.backupNow('manual'), {
                loading: this.t('backup.notify.runningBackup'),
                success: (r) => r.ok
                    ? this.t('backup.notify.backupSuccess')
                    : this.t('backup.notify.backupFailed'),
                error: this.t('backup.notify.backupFailed'),
            });
            this.lastOp = result;
            if (!result.ok) notifyError(result.reason ?? 'backup failed');
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.running = null;
        }
    }

    async verify(): Promise<void> {
        this.running = 'verify';
        try {
            const result = await notifyPromise(this.api.verify(), {
                loading: this.t('backup.notify.verifying'),
                success: (r) => r.ok
                    ? this.t('backup.notify.verifySuccess')
                    : this.t('backup.notify.verifyFailed'),
                error: this.t('backup.notify.verifyFailed'),
            });
            this.lastOp = result;
            if (!result.ok) notifyError(result.reason ?? 'verify failed');
        } catch (err) {
            notifyError(err);
        } finally {
            this.running = null;
        }
    }

    async restoreToStaging(snapshotId: string): Promise<void> {
        this.restoringId = snapshotId;
        try {
            const result = await notifyPromise(this.api.restoreToStaging(snapshotId), {
                loading: this.t('backup.notify.restoring'),
                success: (r) => r.ok
                    ? this.t('backup.notify.restoreSuccess')
                    : this.t('backup.notify.restoreFailed'),
                error: this.t('backup.notify.restoreFailed'),
            });
            this.lastOp = result;
            if (result.ok && result.target) {
                notifySuccess(this.t('backup.notify.restoreTarget') + ' ' + result.target);
            } else if (!result.ok) {
                notifyError(result.reason ?? 'restore failed');
            }
        } catch (err) {
            notifyError(err);
        } finally {
            this.restoringId = null;
        }
    }
}
