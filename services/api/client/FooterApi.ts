import {resolve} from "@services/api/generated";
import {DEFAULT_FOOTER, IFooterConfig} from "@interfaces/IFooter";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";
import {log} from "@services/infra/logger";

export class FooterApi {
    async get(): Promise<IFooterConfig> {
        // Direct-route bug: `gqty.resolve(({query}) => query.mongo.getFooter)`
        // returns an empty payload on cold load (gqty client not always
        // hydrated). Raw POST always returns the correct String! payload.
        // `gqty.resolve` is reserved for SPA paths that pre-warmed the client.
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getFooter } }`}),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.getFooter;
            return raw ? JSON.parse(raw) : {...DEFAULT_FOOTER};
        } catch (err) {
            log.error({scope: 'footer.get', err}, 'footer get failed');
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
