import {Collection, Db} from 'mongodb';
import {auditStamp} from './audit';
import {nextVersion, requireVersion} from './conflict';

/**
 * djb2 hash of a source string — short enough to embed in a Mongo doc.
 * Used to detect when the source string has changed after a translator
 * accepted it, so stale acceptances can be surfaced as "needs review".
 */
export function hashSource(source: string): string {
    let h = 5381;
    for (let i = 0; i < source.length; i++) {
        h = ((h << 5) + h) ^ source.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
}

/**
 * Per-key translator hints stored alongside translation values. The `key`
 * space is the sanitised-key space the translation Compare view already
 * uses — flat, source-language-neutral. Context is NOT per language; we
 * want translators of every locale to read the same explanation.
 */
export interface ITranslationMetaEntry {
    /** Short blurb shown inline next to the key. */
    description?: string;
    /** Longer explanation surfaced in a tooltip / expanded row. */
    context?: string;
    /**
     * Language symbols (e.g. `['lv', 'ru']`) where the translator has
     * explicitly accepted the source string verbatim — "no translation
     * needed" for numbers, proper nouns, single-word technical terms. Keeps
     * the coverage audit from flagging these as missing. Not set when the
     * translator *types* the source in; only set when they tick the
     * "Same as source" checkbox.
     */
    acceptedSources?: string[];
    /**
     * djb2 hash of the source string at the time of acceptance. If the
     * source string later changes, this hash will no longer match and all
     * `acceptedSources` entries for the key are treated as stale ("needs
     * review") until the translator re-accepts.
     */
    acceptedSourceHash?: string;
}

export type ITranslationMetaMap = Record<string, ITranslationMetaEntry>;

const KEY = 'translationMeta';

export class TranslationMetaService {
    private settings: Collection;

    constructor(db: Db) {
        this.settings = db.collection('SiteSettings');
    }

    async get(): Promise<ITranslationMetaMap> {
        const doc = await this.settings.findOne({key: KEY});
        const value = (doc as any)?.value as ITranslationMetaMap | undefined;
        return value && typeof value === 'object' ? value : {};
    }

    async getVersion(): Promise<number> {
        const doc = await this.settings.findOne({key: KEY});
        return (doc as any)?.version ?? 0;
    }

    /**
     * Replace the stored map with the merged result of current + incoming.
     * Callers pass a partial patch (single key) or a full map.
     * Entries with both `description` and `context` empty are removed so
     * the doc doesn't accumulate dead rows after translators clear notes.
     */
    async save(patch: ITranslationMetaMap, editedBy?: string, expectedVersion?: number | null): Promise<{value: ITranslationMetaMap; version: number}> {
        const doc = await this.settings.findOne({key: KEY});
        const existingVersion = (doc as any)?.version as number | undefined;
        const current = (doc as any)?.value as ITranslationMetaMap | undefined ?? {};
        requireVersion(current, existingVersion, expectedVersion, 'Translation meta');
        const merged: ITranslationMetaMap = {...current};
        for (const [k, entry] of Object.entries(patch ?? {})) {
            if (!entry) { delete merged[k]; continue; }
            const description = entry.description?.trim();
            const context = entry.context?.trim();
            const accepted = Array.isArray(entry.acceptedSources)
                ? Array.from(new Set(entry.acceptedSources.filter(s => typeof s === 'string' && s.length > 0)))
                : undefined;
            const hash = typeof entry.acceptedSourceHash === 'string' ? entry.acceptedSourceHash : undefined;
            if (!description && !context && (!accepted || accepted.length === 0)) {
                delete merged[k];
            } else {
                merged[k] = {
                    ...(description ? {description} : {}),
                    ...(context ? {context} : {}),
                    ...(accepted && accepted.length > 0 ? {acceptedSources: accepted} : {}),
                    ...(accepted && accepted.length > 0 && hash ? {acceptedSourceHash: hash} : {}),
                };
            }
        }
        const version = nextVersion(existingVersion);
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: merged, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return {value: merged, version};
    }
}
