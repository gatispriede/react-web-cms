import {resolve} from "@services/api/generated";
import {DEFAULT_SITE_FLAGS, ISiteFlags} from "@services/features/Seo/SiteFlagsService";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";

export class SiteFlagsApi {
    async get(): Promise<ISiteFlags> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getSiteFlags);
            return raw ? JSON.parse(raw) : {...DEFAULT_SITE_FLAGS};
        } catch (err) {
            console.error('SiteFlagsApi.get:', err);
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
