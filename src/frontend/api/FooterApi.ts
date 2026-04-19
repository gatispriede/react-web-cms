import {resolve} from "../gqty";
import {DEFAULT_FOOTER, IFooterConfig} from "../../Interfaces/IFooter";
import {refreshBus} from "../lib/refreshBus";

export class FooterApi {
    async get(): Promise<IFooterConfig> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getFooter);
            return raw ? JSON.parse(raw) : {...DEFAULT_FOOTER};
        } catch (err) {
            console.error('FooterApi.get:', err);
            return {...DEFAULT_FOOTER};
        }
    }

    async save(config: IFooterConfig): Promise<{ok?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveFooter({config}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            return parsed.saveFooter ?? parsed;
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default FooterApi;
