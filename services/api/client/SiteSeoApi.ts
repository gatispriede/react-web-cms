import {resolve} from "@services/api/generated";
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from "@interfaces/ISiteSeo";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";
import {log} from "@services/infra/logger";

export class SiteSeoApi {
    async get(): Promise<ISiteSeoDefaults> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getSiteSeo);
            return raw ? JSON.parse(raw) : {...DEFAULT_SITE_SEO};
        } catch (err) {
            log.error({scope: 'siteSeo.get', err}, 'site seo get failed');
            return {...DEFAULT_SITE_SEO};
        }
    }

    async save(seo: ISiteSeoDefaults, expectedVersion?: number | null): Promise<ISiteSeoDefaults | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveSiteSeo({
                seo,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            refreshBus.emit('settings');
            // Default SEO meta is baked into every public page HTML head.
            triggerRevalidate({scope: 'all'});
            return parsed.saveSiteSeo ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }
}

export default SiteSeoApi;
