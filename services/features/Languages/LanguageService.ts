import {Collection} from 'mongodb';
import {INewLanguage} from "@interfaces/INewLanguage";
import {ILanguageService} from "@services/infra/mongoConfig";
import FileManager from "@services/infra/fileManager";
import {auditStamp} from "@services/features/Audit/audit";
import {nextVersion, requireVersion} from "@services/infra/conflict";
import {log} from "@services/infra/logger";

/**
 * Translations live in two places that must stay in sync:
 *  - Mongo — the authoritative store, read by `getLanguages` and the bundle
 *    export/import flow.
 *  - `src/frontend/public/locales/<symbol>/app.json` — what next-i18next's
 *    HTTP backend fetches at runtime. i18next does not know about Mongo, so
 *    every save/delete here must also rewrite the matching JSON file, or the
 *    admin's edits never reach the rendered site.
 */
export class LanguageService implements ILanguageService {
    private languagesDB: Collection;
    private setupClient: () => Promise<void>;
    private fileManager = new FileManager();

    constructor(languagesDB: Collection, setupClient: () => Promise<void>) {
        this.languagesDB = languagesDB;
        this.setupClient = setupClient;
    }

    async getLanguages(): Promise<INewLanguage[]> {
        try {
            const docs = await this.languagesDB.find({}).toArray();
            return docs.map(doc => doc as unknown as INewLanguage);
        } catch (err) {
            log.error({scope: 'languages.list', err}, 'getLanguages failed');
            await this.setupClient();
            return [];
        }
    }

    async addUpdateLanguage({language, translations, editedBy, expectedVersion}: { language: INewLanguage, translations: JSON, editedBy?: string, expectedVersion?: number | null }): Promise<{symbol: string; version: number}> {
        // MERGE, don't replace. The admin editor only ever sends the keys
        // it actually displays — extracting them from the Sections graph.
        // Anything else (admin chrome, legacy content) would be wiped
        // every save. Merge incoming on top of the existing base.
        //
        // Base order: disk JSON is what i18next actually serves at
        // runtime, so it wins over Mongo if the two have drifted (past
        // bugs let that happen). If both are empty, the payload itself
        // becomes the base.
        const diskBase = language.symbol ? this.fileManager.readTranslation(language.symbol) : {};
        const existing = await this.languagesDB.findOne({symbol: language.symbol}) as any;
        const existingVersion = typeof existing?.version === 'number' ? existing.version : 0;
        requireVersion(existing ?? {symbol: language.symbol}, existingVersion, expectedVersion, 'Language');
        const mongoBase = (existing?.translations as Record<string, string> | undefined) ?? {};
        const incoming = (translations as unknown as Record<string, string>) ?? {};
        const merged: Record<string, string> = {...mongoBase, ...diskBase, ...incoming};
        const version = nextVersion(existingVersion);
        // Default-language is a singleton flag — when the incoming payload
        // promotes this language to default, demote everyone else first so
        // the collection invariant ("at most one default") holds. Without
        // this, the admin UI would happily mark two locales default and the
        // public site / bundle export would have to pick one arbitrarily.
        if (language.default === true && language.symbol) {
            try {
                await this.languagesDB.updateMany(
                    {symbol: {$ne: language.symbol}, default: true},
                    {$set: {default: false}}
                );
            } catch (err) {
                log.error({scope: 'languages.demoteDefault', err, symbol: language.symbol}, 'demote previous default failed');
            }
        }
        await this.languagesDB.updateOne(
            {symbol: language.symbol},
            {$set: {...language, translations: merged, version, ...auditStamp(editedBy)}},
            {upsert: true}
        );
        if (language.symbol) {
            try {
                this.fileManager.saveTranslation(language.symbol, merged as unknown as JSON);
            } catch (err) {
                log.error({scope: 'languages.writeJson', err, symbol: language.symbol}, 'write translation JSON failed');
            }
        }
        return {symbol: language.symbol, version};
    }

    /**
     * F8 — flip the `default` flag onto one language; demote all others.
     * The collection invariant is "at most one default"; this is the
     * dedicated setter used by the MCP `language.setDefault` tool when
     * the caller wants to promote without re-sending the full payload
     * via `addUpdateLanguage`.
     */
    async setDefault({symbol, editedBy}: { symbol: string; editedBy?: string }): Promise<string> {
        try {
            if (!symbol) throw new Error('symbol-required');
            const target = await this.languagesDB.findOne({symbol});
            if (!target) throw new Error('language-not-found');
            await this.languagesDB.updateMany(
                {symbol: {$ne: symbol}, default: true},
                {$set: {default: false}},
            );
            await this.languagesDB.updateOne(
                {symbol},
                {$set: {default: true, ...auditStamp(editedBy)}},
            );
            return JSON.stringify({setDefault: {symbol}});
        } catch (err) {
            log.error({scope: 'languages.setDefault', err, symbol}, 'setDefault failed');
            await this.setupClient();
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    /**
     * F8 W3 — single-key translation set. Updates Mongo's translation map
     * for `symbol` and (best-effort) syncs the on-disk locale file. Atomic
     * write via tmp+rename to avoid half-written JSON if i18next reads
     * mid-write. If the on-disk file doesn't exist, we don't create it
     * (treat the locale as Mongo-only, mirroring `addUpdateLanguage`'s
     * disk-merge precedence rule).
     */
    async setKey({symbol, key, value, editedBy}: {symbol: string; key: string; value: string; editedBy?: string}): Promise<{symbol: string; key: string}> {
        if (!symbol) throw new Error('symbol-required');
        if (!key) throw new Error('key-required');
        const existing = await this.languagesDB.findOne({symbol}) as any;
        const merged: Record<string, string> = {
            ...((existing?.translations as Record<string, string> | undefined) ?? {}),
            [key]: value ?? '',
        };
        const existingVersion = typeof existing?.version === 'number' ? existing.version : 0;
        const version = nextVersion(existingVersion);
        await this.languagesDB.updateOne(
            {symbol},
            {$set: {translations: merged, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        // On-disk sync — only if the locale folder already exists. Avoids
        // accidentally creating new on-disk locales from a one-key call.
        try {
            const onDisk = this.fileManager.readTranslation(symbol);
            if (onDisk && Object.keys(onDisk).length > 0) {
                this.fileManager.saveTranslation(symbol, {...onDisk, [key]: value ?? ''} as unknown as JSON);
            }
        } catch (err) {
            log.error({scope: 'languages.setKey', err, symbol, key}, 'setKey disk write failed');
        }
        return {symbol, key};
    }

    /** F8 W3 — single-key translation delete. Symmetric to `setKey`. */
    async deleteKey({symbol, key, editedBy}: {symbol: string; key: string; editedBy?: string}): Promise<{symbol: string; key: string}> {
        if (!symbol) throw new Error('symbol-required');
        if (!key) throw new Error('key-required');
        const existing = await this.languagesDB.findOne({symbol}) as any;
        const map: Record<string, string> = {...((existing?.translations as Record<string, string> | undefined) ?? {})};
        delete map[key];
        const existingVersion = typeof existing?.version === 'number' ? existing.version : 0;
        const version = nextVersion(existingVersion);
        await this.languagesDB.updateOne(
            {symbol},
            {$set: {translations: map, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        try {
            const onDisk = this.fileManager.readTranslation(symbol);
            if (onDisk && Object.keys(onDisk).length > 0) {
                const next = {...onDisk};
                delete next[key];
                this.fileManager.saveTranslation(symbol, next as unknown as JSON);
            }
        } catch (err) {
            log.error({scope: 'languages.deleteKey', err, symbol, key}, 'deleteKey disk write failed');
        }
        return {symbol, key};
    }

    async deleteLanguage({language, deletedBy}: { language: INewLanguage, deletedBy?: string }): Promise<string> {
        try {
            const result = await this.languagesDB.deleteOne({symbol: language.symbol});
            if (language.symbol) {
                try {
                    this.fileManager.deleteTranslation(language.symbol);
                } catch (err) {
                    log.error({scope: 'languages.deleteJson', err, symbol: language.symbol}, 'delete translation JSON failed');
                }
            }
            return JSON.stringify({...result, ...(deletedBy ? {deletedBy} : {})});
        } catch (err) {
            log.error({scope: 'languages.delete', err, symbol: language.symbol}, 'delete language failed');
            await this.setupClient();
            return '';
        }
    }
}
