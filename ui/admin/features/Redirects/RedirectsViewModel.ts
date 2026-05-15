import {observable} from '@client/lib/state/observable';
import {notifyPromise, notifyError} from '@admin/lib/notify';
import type {IRedirect} from '@interfaces/IRedirect';
import {RedirectsApi} from './RedirectsApi';

/**
 * RedirectsViewModel — VM3 for the admin Redirects pane.
 *
 * Drives the CRUD round-trip. Async writes go through `notifyPromise`
 * so the operator gets a loading toast → success / error toast. Per
 * the admin shell convention we never call `message.*` directly.
 */
export class RedirectsViewModel {
    rows: IRedirect[] = [];
    loading = false;
    saving = false;
    editing: IRedirect | null = null;

    constructor(private readonly api: RedirectsApi = new RedirectsApi()) {
        return observable(this);
    }

    setEditing(row: IRedirect | null): void {
        this.editing = row;
    }

    openCreate(): void {
        this.editing = {from: '', to: '', code: 301};
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.rows = await this.api.list();
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    async save(input: IRedirect): Promise<void> {
        this.saving = true;
        try {
            const isNew = !input.id;
            await notifyPromise(
                isNew ? this.api.create(input) : this.api.update(input),
                {
                    loading: isNew ? 'Creating redirect…' : 'Updating redirect…',
                    success: isNew ? 'Redirect created' : 'Redirect updated',
                    error: (err) => `Redirect save failed: ${String((err as Error)?.message ?? err)}`,
                },
            );
            this.editing = null;
            await this.refresh();
        } catch {
            // notifyPromise already surfaced the error toast.
        } finally {
            this.saving = false;
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await notifyPromise(
                this.api.delete(id),
                {
                    loading: 'Deleting redirect…',
                    success: 'Redirect deleted',
                    error: (err) => `Delete failed: ${String((err as Error)?.message ?? err)}`,
                },
            );
            await this.refresh();
        } catch {
            /* toast already shown */
        }
    }
}
