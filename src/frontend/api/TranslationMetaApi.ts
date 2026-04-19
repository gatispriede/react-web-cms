import {resolve} from "../gqty";
import {ITranslationMetaMap} from "../../Server/TranslationMetaService";
import {refreshBus} from "../lib/refreshBus";

export class TranslationMetaApi {
    async get(): Promise<ITranslationMetaMap> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getTranslationMeta);
            return raw ? JSON.parse(raw) : {};
        } catch (err) {
            console.error('TranslationMetaApi.get:', err);
            return {};
        }
    }

    async save(patch: ITranslationMetaMap): Promise<ITranslationMetaMap | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveTranslationMeta({meta: patch}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            return parsed.saveTranslationMeta ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default TranslationMetaApi;
