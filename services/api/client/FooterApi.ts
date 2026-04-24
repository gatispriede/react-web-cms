import {resolve} from "@services/api/generated";
import {DEFAULT_FOOTER, IFooterConfig} from "@interfaces/IFooter";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";

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
            // Footer renders on every public page.
            triggerRevalidate({scope: 'all'});
            return parsed.saveFooter ?? parsed;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }
}

export default FooterApi;
