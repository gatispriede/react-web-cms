import {resolve} from "../gqty";
import {ITranslationMetaMap} from "../../Server/TranslationMetaService";
import {refreshBus} from "../lib/refreshBus";
import {isConflictError, parseMutationResponse} from "../lib/conflict";

export class TranslationMetaApi {
    async get(): Promise<{value: ITranslationMetaMap; version: number}> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getTranslationMeta);
            if (!raw) return {value: {}, version: 0};
            const parsed = JSON.parse(raw);
            // Back-compat: earlier shape returned the map directly.
            if (parsed && typeof parsed === 'object' && 'value' in parsed && 'version' in parsed) {
                return {value: parsed.value ?? {}, version: Number(parsed.version) || 0};
            }
            return {value: parsed ?? {}, version: 0};
        } catch (err) {
            console.error('TranslationMetaApi.get:', err);
            return {value: {}, version: 0};
        }
    }

    async save(
        patch: ITranslationMetaMap,
        expectedVersion?: number | null,
    ): Promise<{value?: ITranslationMetaMap; version?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveTranslationMeta({
                meta: patch,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            refreshBus.emit('settings');
            return parsed.saveTranslationMeta ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }
}

export default TranslationMetaApi;
