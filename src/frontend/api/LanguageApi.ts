import {resolve} from "../gqty";
import {INewLanguage} from "../components/interfaces/INewLanguage";

export class LanguageApi {
    async getLanguages(): Promise<Record<string, INewLanguage>> {
        try {
            const data = await resolve(({query}) => {
                const list: any = query.mongo.getLanguages;
                return list.map((l: any) => ({
                    default: l.default,
                    label: l.label,
                    symbol: l.symbol,
                    flag: l.flag,
                }));
            });
            const byKey: Record<string, INewLanguage> = {};
            data.forEach((l: INewLanguage) => {
                byKey[l.symbol] = l;
            });
            return byKey;
        } catch (err) {
            console.error('Error while fetching languages', err);
            return {};
        }
    }

    async saveLanguage(language: INewLanguage, translations?: any): Promise<any> {
        return await resolve(({mutation}) => mutation.mongo.addUpdateLanguage({language, translations}));
    }

    async deleteTranslation(language: INewLanguage): Promise<any> {
        return await resolve(({mutation}) => mutation.mongo.deleteLanguage({language}));
    }
}

export default LanguageApi;
