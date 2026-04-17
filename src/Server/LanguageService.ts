import {Collection} from 'mongodb';
import {INewLanguage} from "../frontend/components/interfaces/INewLanguage";
import {ILanguageService} from "./mongoConfig";

export class LanguageService implements ILanguageService {
    private languagesDB: Collection;
    private setupClient: () => Promise<void>;

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

    async addUpdateLanguage({language, translations}: { language: INewLanguage, translations: JSON }): Promise<string> {
        try {
            const result = await this.languagesDB.updateOne(
                {symbol: language.symbol},
                {$set: {...language, translations}},
                {upsert: true}
            );
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error adding/updating language:', err);
            await this.setupClient();
            return '';
        }
    }

    async deleteLanguage({language}: { language: INewLanguage }): Promise<string> {
        try {
            const result = await this.languagesDB.deleteOne({symbol: language.symbol});
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error deleting language:', err);
            await this.setupClient();
            return '';
        }
    }
}
