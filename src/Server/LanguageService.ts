import {Collection} from 'mongodb';
import {INewLanguage} from "../frontend/components/interfaces/INewLanguage";
import {ILanguageService} from "./mongoConfig";
import FileManager from "./fileManager";
import {auditStamp} from "./audit";
import {nextVersion, requireVersion} from "./conflict";

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
            console.error('Error getting languages:', err);
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
        await this.languagesDB.updateOne(
            {symbol: language.symbol},
            {$set: {...language, translations: merged, version, ...auditStamp(editedBy)}},
            {upsert: true}
        );
        if (language.symbol) {
            try {
                this.fileManager.saveTranslation(language.symbol, merged as unknown as JSON);
            } catch (err) {
                console.error('Error writing translation JSON to disk:', err);
            }
        }
        return {symbol: language.symbol, version};
    }

    async deleteLanguage({language, deletedBy}: { language: INewLanguage, deletedBy?: string }): Promise<string> {
        try {
            const result = await this.languagesDB.deleteOne({symbol: language.symbol});
            if (language.symbol) {
                try {
                    this.fileManager.deleteTranslation(language.symbol);
                } catch (err) {
                    console.error('Error resetting translation JSON on disk:', err);
                }
            }
            return JSON.stringify({...result, ...(deletedBy ? {deletedBy} : {})});
        } catch (err) {
            console.error('Error deleting language:', err);
            await this.setupClient();
            return '';
        }
    }
}
