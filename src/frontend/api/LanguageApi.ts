import {resolve} from "../gqty";
import {INewLanguage} from "../components/interfaces/INewLanguage";
import {refreshBus} from "../lib/refreshBus";
import {isConflictError, parseMutationResponse} from "../lib/conflict";

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
                    version: typeof l.version === 'number' ? l.version : undefined,
                    editedBy: l.editedBy ?? undefined,
                    editedAt: l.editedAt ?? undefined,
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

    async saveLanguage(language: INewLanguage, translations?: any, expectedVersion?: number | null): Promise<{symbol?: string; version?: number; error?: string}> {
        const clean = {label: language.label, symbol: language.symbol, default: language.default, flag: language.flag};
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.addUpdateLanguage({
                language: clean,
                translations,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            refreshBus.emit('settings');
            return parsed.addUpdateLanguage ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }

    async deleteTranslation(language: INewLanguage): Promise<any> {
        const clean = {label: language.label, symbol: language.symbol, default: language.default, flag: language.flag};
        const r = await resolve(({mutation}) => mutation.mongo.deleteLanguage({language: clean}));
        refreshBus.emit('settings');
        return r;
    }
}

export default LanguageApi;
