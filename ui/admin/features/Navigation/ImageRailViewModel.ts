import {message} from 'antd';
import AssetApi from '@services/api/client/AssetApi';
import IImage from '@interfaces/IImage';
import {refreshBus} from '@client/lib/refreshBus';
import {observable, useObservable} from '@client/lib/state/observable';

const STORAGE_KEY = 'admin.imageRail.open';

/**
 * Visibility VM — shared singleton so the dock toggle and the rail itself
 * read/write the same state without prop drilling. `useImageRailState` keeps
 * the hook signature the previous `useState`-backed version exposed.
 */
class ImageRailVisibility {
    open = false;

    constructor() {
        if (typeof window !== 'undefined') {
            try { this.open = window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* noop */ }
        }
        return observable(this);
    }

    set(next: boolean): void {
        this.open = next;
        try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
    }
}

const visibility = new ImageRailVisibility();

export function useImageRailState(): [boolean, (next: boolean) => void] {
    const v = useObservable(visibility);
    return [v.open, v.set];
}

/** Per-mount VM3 — image-library rail. Holds list, filter, hover, selection. */
export class ImageRailViewModel {
    images:   IImage[] | null = null;
    filter    = '';
    selected: Set<string> = new Set();
    hoverId:  string | null = null;
    busy      = false;

    constructor(private readonly assetApi: AssetApi = new AssetApi()) {
        return observable(this);
    }

    setFilter(v: string): void { this.filter = v; }
    setHoverId(v: string | null): void { this.hoverId = v; }

    get selectMode(): boolean { return this.selected.size > 0; }

    toggleSelect(id: string): void {
        const next = new Set(this.selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        this.selected = next;
    }

    clearSelection(): void {
        this.selected = new Set();
    }

    /** Drop selection IDs that disappeared from the latest fetch. */
    pruneSelection(): void {
        if (!this.images) return;
        const live = new Set(this.images.map(i => i.id));
        let changed = false;
        const next = new Set<string>();
        for (const id of this.selected) {
            if (live.has(id)) next.add(id); else changed = true;
        }
        if (changed) this.selected = next;
    }

    async refresh(): Promise<void> {
        this.images = null;
        try {
            const list = await this.assetApi.getImages('All');
            this.images = Array.isArray(list) ? list : [];
        } catch {
            this.images = [];
        }
    }

    subscribeRefresh(): () => void {
        return refreshBus.subscribe(() => { void this.refresh(); }, 'assets');
    }

    async deleteIds(ids: string[]): Promise<void> {
        if (!ids.length) return;
        this.busy = true;
        let ok = 0, fail = 0;
        // Sequential to avoid hammering the GraphQL endpoint and to keep the
        // failure surface readable — bulk image deletes are rare enough that
        // the latency cost is acceptable.
        for (const id of ids) {
            try { await this.assetApi.deleteImage(id); ok++; }
            catch (err) { console.error('[image-rail] delete failed', id, err); fail++; }
        }
        this.busy = false;
        this.clearSelection();
        if (fail === 0) void message.success(`Deleted ${ok} image${ok === 1 ? '' : 's'}`);
        else void message.warning(`Deleted ${ok}, ${fail} failed`);
        await this.refresh();
    }

    get filtered(): IImage[] {
        if (!this.images) return [];
        const q = this.filter.trim().toLowerCase();
        if (!q) return this.images;
        return this.images.filter(i =>
            (i.name ?? '').toLowerCase().includes(q) ||
            (Array.isArray(i.tags) ? i.tags.some(t => (t ?? '').toLowerCase().includes(q)) : false)
        );
    }
}
