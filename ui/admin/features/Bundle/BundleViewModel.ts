import {notifyError, notifySuccess, notifyWarning} from '@admin/lib/notify';
import {triggerRevalidate} from '@client/lib/triggerRevalidate';
import {observable} from '@client/lib/state/observable';

/** VM3 — Bundle import/export admin pane state. */
export class BundleViewModel {
    exporting = false;
    importing = false;
    importProgress: number | null = null;
    pendingBundle: any = null;

    private progressTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly t: (k: string) => string = (k) => k) {
        return observable(this);
    }

    dispose(): void {
        if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }
    }

    async doExport(): Promise<void> {
        this.exporting = true;
        try {
            const res = await fetch('/api/export');
            if (!res.ok) throw new Error(`Export failed: ${res.status}`);
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = /filename="([^"]+)"/.exec(disposition);
            const filename = match?.[1] || `site-${new Date().toISOString().slice(0, 10)}.json`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notifySuccess(this.t('Export downloaded'));
        } catch (err) {
            notifyError(this.t('Export failed') + ': ' + String(err));
        } finally {
            this.exporting = false;
        }
    }

    async loadFile(file: File): Promise<void> {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed?.manifest || !parsed?.site) throw new Error('Missing manifest or site');
            this.pendingBundle = parsed;
        } catch (err) {
            notifyError(this.t('Invalid bundle file') + ': ' + String(err));
        }
    }

    async doImport(onComplete: () => void): Promise<void> {
        if (!this.pendingBundle) return;
        this.importing = true;
        this.importProgress = 5;

        let current = 5;
        this.progressTimer = setInterval(() => {
            current = Math.min(current + Math.random() * 6 + 2, 85);
            this.importProgress = Math.round(current);
        }, 600);

        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.pendingBundle),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Import failed: ${res.status}`);
            if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }
            this.importProgress = 100;
            notifySuccess(`${this.t('Import complete')} — ${JSON.stringify(data.restored)}, assets: ${data.assets}`);
            if (Array.isArray(data.skippedAssets) && data.skippedAssets.length) {
                notifyWarning(`${this.t('Skipped assets')}: ${data.skippedAssets.join(', ')}`);
            }
            triggerRevalidate({scope: 'all'});
            this.pendingBundle = null;
            onComplete();
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }
            this.importProgress = null;
            notifyError(this.t('Import failed') + ': ' + String(err));
        } finally {
            this.importing = false;
        }
    }
}
