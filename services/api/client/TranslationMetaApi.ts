import {resolve} from "@services/api/generated";
import {ITranslationMetaMap} from "@services/features/Languages/TranslationMetaService";
import {refreshBus} from "@client/lib/refreshBus";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";
import {log} from "@services/infra/logger";

export class TranslationMetaApi {
    async get(): Promise<{value: ITranslationMetaMap; version: number}> {
        // Direct-route bug: `gqty.resolve(({query}) => query.mongo.getTranslationMeta)`
        // returns an empty payload on cold load (gqty client not always
        // hydrated). Raw POST always returns the correct String! payload.
        // `gqty.resolve` is reserved for SPA paths that pre-warmed the client.
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getTranslationMeta } }`}),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.getTranslationMeta;
            if (!raw) return {value: {}, version: 0};
            const parsed = JSON.parse(raw);
            // Back-compat: earlier shape returned the map directly.
            if (parsed && typeof parsed === 'object' && 'value' in parsed && 'version' in parsed) {
                return {value: parsed.value ?? {}, version: Number(parsed.version) || 0};
            }
            return {value: parsed ?? {}, version: 0};
        } catch (err) {
            log.error({scope: 'translationMeta.get', err}, 'translation meta get failed');
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
