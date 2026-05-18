import {observable} from '@client/lib/state/observable';
import {notifyPromise} from '@admin/lib/notify';
import {SeoOverviewApi, type SeoOverviewSummary} from './SeoOverviewApi';

/**
 * W8h SEO polish — view-model for the site-wide SEO dashboard.
 *
 * One async surface: `refresh()` pulls the aggregated summary via the
 * dedicated `/api/admin/seo-overview` endpoint. We `notifyPromise` so
 * the operator sees a Sonner loading toast → success / error, matching
 * the rest of the admin shell.
 *
 * VM3 (no React state) — the view binds directly to observable fields.
 */
export class SeoOverviewViewModel {
    summary: SeoOverviewSummary | null = null;
    loading = false;

    constructor(private readonly api: SeoOverviewApi = new SeoOverviewApi()) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.summary = await notifyPromise(
                this.api.fetch(),
                {
                    loading: 'Loading SEO overview…',
                    success: 'SEO overview refreshed',
                    error: (err) => `Refresh failed: ${String((err as Error)?.message ?? err)}`,
                },
            );
        } catch {
            // notifyPromise already surfaced the error toast.
        } finally {
            this.loading = false;
        }
    }
}
