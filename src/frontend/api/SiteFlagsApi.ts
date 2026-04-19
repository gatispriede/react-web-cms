import {resolve} from "../gqty";
import {DEFAULT_SITE_FLAGS, ISiteFlags} from "../../Server/SiteFlagsService";
import {refreshBus} from "../lib/refreshBus";

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

    async save(flags: Partial<ISiteFlags>): Promise<ISiteFlags | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveSiteFlags({flags}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            return parsed.saveSiteFlags ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default SiteFlagsApi;
