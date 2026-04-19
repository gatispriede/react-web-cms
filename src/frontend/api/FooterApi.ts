import {resolve} from "../gqty";
import {DEFAULT_FOOTER, IFooterConfig} from "../../Interfaces/IFooter";
import {refreshBus} from "../lib/refreshBus";
import {isConflictError, parseMutationResponse} from "../lib/conflict";

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

    async save(config: IFooterConfig, expectedVersion?: number | null): Promise<{ok?: boolean; version?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveFooter({
                config,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            refreshBus.emit('settings');
            return parsed.saveFooter ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }
}

export default FooterApi;
