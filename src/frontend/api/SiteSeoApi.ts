import {resolve} from "../gqty";
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from "../../Interfaces/ISiteSeo";

export class SiteSeoApi {
    async get(): Promise<ISiteSeoDefaults> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getSiteSeo);
            return raw ? JSON.parse(raw) : {...DEFAULT_SITE_SEO};
        } catch (err) {
            console.error('SiteSeoApi.get:', err);
            return {...DEFAULT_SITE_SEO};
        }
    }

    async save(seo: ISiteSeoDefaults): Promise<ISiteSeoDefaults | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveSiteSeo({seo}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.saveSiteSeo ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default SiteSeoApi;
