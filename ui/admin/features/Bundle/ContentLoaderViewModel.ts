import {message} from 'antd';
import TranslationMetaApi from '@services/api/client/TranslationMetaApi';
import {observable} from '@client/lib/state/observable';

/**
 * VM3 — ContentLoader (translations editor) state.
 *
 * The component itself stays Suspense-driven (`use(dataPromise)`) — that
 * concern can't move into a class. Everything else (filter, missing-only,
 * staged translation values, accepted-source set + version) lives here.
 *
 * The component owns one prop callback (`setTranslation`) that mirrors
 * staged values up to the parent. We thread it in via `setSink()` rather
 * than a constructor arg so the same VM instance survives parent re-renders.
 */
export class ContentLoaderViewModel {
    filter        = '';
    missingOnly   = false;
    /** Staged per-key translation values. */
    newTranslations: Record<string, string> = {};
    acceptedKeys: Set<string> = new Set();
    metaVersion   = 0;

    private sink: (next: Record<string, string>) => void = () => {};

    constructor(private readonly metaApi: TranslationMetaApi = new TranslationMetaApi()) {
        return observable(this);
    }

    setSink(sink: (next: Record<string, string>) => void): void {
        this.sink = sink;
    }

    setFilter(v: string): void { this.filter = v; }
    setMissingOnly(v: boolean): void { this.missingOnly = v; }

    seed(seeded: Record<string, string>): void {
        this.newTranslations = seeded;
        this.sink(seeded);
    }

    translationChange(key: string, value: string): void {
        const next = {...this.newTranslations, [key]: value};
        this.newTranslations = next;
        this.sink(next);
    }

    /** Backfill source value for keys flagged "same as source" but blank. */
    backfillAccepted(translations: Record<string, string>): void {
        if (this.acceptedKeys.size === 0) return;
        let changed = false;
        const next = {...this.newTranslations};
        for (const k of this.acceptedKeys) {
            if (!translations[k]) continue;
            if (!next[k]) { next[k] = translations[k]; changed = true; }
        }
        if (!changed) return;
        this.newTranslations = next;
        this.sink(next);
    }

    async loadMeta(currentLanguageKey: string): Promise<void> {
        const {value, version} = await this.metaApi.get();
        const next = new Set<string>();
        for (const [k, entry] of Object.entries(value ?? {})) {
            if (Array.isArray(entry?.acceptedSources) && entry.acceptedSources.includes(currentLanguageKey)) {
                next.add(k);
            }
        }
        this.acceptedKeys = next;
        this.metaVersion  = version ?? 0;
    }

    async toggleAcceptSource(key: string, checked: boolean, currentLanguageKey: string,
                              translations: Record<string, string>): Promise<void> {
        const nextSet = new Set(this.acceptedKeys);
        if (checked) nextSet.add(key); else nextSet.delete(key);
        this.acceptedKeys = nextSet;
        if (checked) this.translationChange(key, translations[key]);
        try {
            const {value: current} = await this.metaApi.get();
            const existing = current[key] ?? {};
            const prev = Array.isArray(existing.acceptedSources) ? existing.acceptedSources : [];
            const next = checked
                ? Array.from(new Set([...prev, currentLanguageKey]))
                : prev.filter(s => s !== currentLanguageKey);
            const result = await this.metaApi.save({[key]: {...existing, acceptedSources: next}}, this.metaVersion);
            const v = (result as {version?: number})?.version;
            if (v != null) this.metaVersion = v;
        } catch (err) {
            console.error('translationMeta toggle failed:', err);
            void message.error('Could not save "Same as source" — reloading.');
            await this.loadMeta(currentLanguageKey);
        }
    }

    async bulkAcceptVisible(visibleKeys: string[], checked: boolean, currentLanguageKey: string,
                             translations: Record<string, string>): Promise<void> {
        if (visibleKeys.length === 0) return;
        const nextSet = new Set(this.acceptedKeys);
        for (const k of visibleKeys) {
            if (checked) {
                nextSet.add(k);
                this.translationChange(k, translations[k]);
            } else {
                nextSet.delete(k);
            }
        }
        this.acceptedKeys = nextSet;
        try {
            const {value: current} = await this.metaApi.get();
            const patch: Record<string, unknown> = {};
            for (const k of visibleKeys) {
                const existing = (current[k] ?? {}) as {acceptedSources?: string[]};
                const prev = Array.isArray(existing.acceptedSources) ? existing.acceptedSources : [];
                const next = checked
                    ? Array.from(new Set([...prev, currentLanguageKey]))
                    : prev.filter((s: string) => s !== currentLanguageKey);
                patch[k] = {...existing, acceptedSources: next};
            }
            const result = await this.metaApi.save(patch as Record<string, {acceptedSources: string[]}>, this.metaVersion);
            const v = (result as {version?: number})?.version;
            if (v != null) this.metaVersion = v;
            void message.success(`${checked ? 'Marked' : 'Cleared'} ${visibleKeys.length} row${visibleKeys.length === 1 ? '' : 's'}`);
        } catch (err) {
            console.error('bulk acceptSource failed:', err);
            void message.error('Bulk save failed — reloading.');
            await this.loadMeta(currentLanguageKey);
        }
    }
}
