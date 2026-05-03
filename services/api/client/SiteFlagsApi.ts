import {resolve} from "@services/api/generated";
import {DEFAULT_SITE_FLAGS, ISiteFlags} from "@services/features/Seo/SiteFlagsService";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";
import {log} from "@services/infra/logger";

export class SiteFlagsApi {
    async get(): Promise<ISiteFlags> {
        // Direct-route bug: `gqty.resolve(({query}) => query.mongo.getSiteFlags)`
        // returns an empty payload on cold load (gqty client not always
        // hydrated). Raw POST always returns the correct String! payload.
        // `gqty.resolve` is reserved for SPA paths that pre-warmed the client.
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getSiteFlags } }`}),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.getSiteFlags;
            return raw ? JSON.parse(raw) : {...DEFAULT_SITE_FLAGS};
        } catch (err) {
            log.error({scope: 'siteFlags.get', err}, 'site flags get failed');
            return {...DEFAULT_SITE_FLAGS};
        }
    }

    async save(flags: Partial<ISiteFlags>, expectedVersion?: number | null): Promise<ISiteFlags | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveSiteFlags({
                flags,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            refreshBus.emit('settings');
            // Flags affect layoutMode / blogEnabled / etc. — site-wide.
            triggerRevalidate({scope: 'all'});
            return parsed.saveSiteFlags ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }
}

export default SiteFlagsApi;
