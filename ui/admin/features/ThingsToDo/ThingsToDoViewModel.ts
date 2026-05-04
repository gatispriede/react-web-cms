import {PostApi} from '@services/api/client/PostApi';
import {PublishApi} from '@services/api/client/PublishApi';
import {InventoryApi} from '@services/api/client/InventoryApi';
import {OrderApi} from '@services/api/client/OrderApi';
import {observable} from '@client/lib/state/observable';
import {log} from '@services/infra/logger';

/**
 * Things-to-do view-model — surfaces actionable items for the
 * simplified admin dashboard. Per `admin-ui-modes.md` decision: the
 * simplified surface should *show what needs doing*, not present a
 * full feature pane. This VM is the data layer for that panel.
 *
 * Resilience contract: every individual data source is wrapped in
 * its own try/catch. A failing source produces no item; the panel
 * still renders whatever resolved cleanly. This matters because
 * features can be toggled off (cart, products, blog, etc.) and the
 * corresponding API endpoints will then 404 / return errors —
 * graceful degradation is required, not optional.
 *
 * Each item has a stable `kind`, a `count` (the number to surface),
 * a `href` (where the simplified shell sends the user when they
 * click "Open"), and a `title` (UI label). Items with `count === 0`
 * are filtered out by `visibleItems`; the panel collapses entirely
 * when nothing's pending.
 */

export type TodoKind =
    | 'unpublishedChanges'
    | 'draftPosts'
    | 'inventoryDeadLetters'
    | 'pendingOrders'
    | 'missingTranslations';

export interface TodoItem {
    readonly kind: TodoKind;
    readonly title: string;
    readonly count: number;
    readonly href: string;
}

type Translator = (key: string, opts?: Record<string, unknown>) => string;

export class ThingsToDoViewModel {
    items: TodoItem[] = [];
    loading = false;

    constructor(
        private readonly postApi: PostApi = new PostApi(),
        private readonly publishApi: PublishApi = new PublishApi(),
        private readonly inventoryApi: InventoryApi = new InventoryApi(),
        private readonly orderApi: OrderApi = new OrderApi(),
        private readonly t: Translator = (k) => k,
    ) {
        return observable(this);
    }

    /** Items that are worth displaying. count===0 → hidden. */
    get visibleItems(): TodoItem[] {
        return this.items.filter(it => it.count > 0);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            // Run every source in parallel; each settles independently.
            // `Promise.allSettled` so one source's failure never sinks the
            // others. We then drop the rejected ones — graceful degrade.
            const settled = await Promise.allSettled([
                this.collectDraftPosts(),
                this.collectUnpublishedChanges(),
                this.collectInventoryDeadLetters(),
                this.collectPendingOrders(),
            ]);
            const next: TodoItem[] = [];
            for (const r of settled) {
                if (r.status === 'fulfilled' && r.value) next.push(r.value);
            }
            this.items = next;
        } finally {
            this.loading = false;
        }
    }

    // ---- per-source collectors ------------------------------------------------

    private async collectDraftPosts(): Promise<TodoItem | null> {
        try {
            const all = await this.postApi.list({includeDrafts: true, limit: 200});
            const drafts = (all || []).filter(p => p.draft).length;
            return {
                kind: 'draftPosts',
                title: this.t('Draft posts to publish'),
                count: drafts,
                href: '/admin/content/posts',
            };
        } catch (err) {
            log.warn?.({scope: 'todo.draftPosts', err}, 'draftPosts collector failed');
            return null;
        }
    }

    private async collectUnpublishedChanges(): Promise<TodoItem | null> {
        try {
            const snapshot = await this.publishApi.getSnapshot();
            // If we have a snapshot timestamp + an `editedAt` newer than it
            // anywhere, there's something to publish. The cheapest signal is
            // the snapshot's own metadata vs the live posts list, but to keep
            // the surface dependency-light we just count "is there any draft
            // history newer than the last publish at all" — a 1/0 indicator.
            const history = await this.publishApi.getHistory(1);
            const lastPublishedAt = history?.[0]?.publishedAt;
            const live = await this.postApi.list({includeDrafts: true, limit: 200});
            const hasNewer = (live || []).some(p => {
                const t = p.editedAt ?? p.updatedAt;
                return t && (!lastPublishedAt || t > lastPublishedAt);
            });
            return {
                kind: 'unpublishedChanges',
                title: this.t('Unpublished changes'),
                count: hasNewer ? 1 : 0,
                href: '/admin/release/publishing',
            };
        } catch (err) {
            log.warn?.({scope: 'todo.unpublishedChanges', err}, 'unpublishedChanges collector failed');
            return null;
        }
    }

    private async collectInventoryDeadLetters(): Promise<TodoItem | null> {
        try {
            const rows = await this.inventoryApi.readDeadLetters(50);
            return {
                kind: 'inventoryDeadLetters',
                title: this.t('Inventory sync issues'),
                count: Array.isArray(rows) ? rows.length : 0,
                href: '/admin/content/inventory',
            };
        } catch (err) {
            log.warn?.({scope: 'todo.inventoryDeadLetters', err}, 'inventory collector failed');
            return null;
        }
    }

    private async collectPendingOrders(): Promise<TodoItem | null> {
        try {
            const orders = await this.orderApi.myOrders(100);
            // "pending" = anything not yet shipped/cancelled. The OrderStatus
            // enum is owned by the Orders feature; we filter conservatively
            // using common state strings so this works across the feature
            // being on/off and across status-name variants.
            const pending = (orders || []).filter(o => {
                const s = String((o as {status?: string}).status || '').toLowerCase();
                return s && !['shipped', 'delivered', 'cancelled', 'canceled', 'refunded'].includes(s);
            }).length;
            return {
                kind: 'pendingOrders',
                title: this.t('Pending orders'),
                count: pending,
                href: '/admin/content/orders',
            };
        } catch (err) {
            log.warn?.({scope: 'todo.pendingOrders', err}, 'orders collector failed');
            return null;
        }
    }
}
