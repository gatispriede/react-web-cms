/**
 * Cache header builder for the Caddy SWR layer.
 *
 * Two outputs:
 *   - `X-Cms-Cache-Tag: feature=ver,feature=ver,…` — the value Caddy
 *     hashes into the cache key (alongside `bootId`). Bumping the
 *     version of any contributing feature naturally evicts the entry.
 *   - `Cache-Control` — the SWR policy. `PROD_CACHE=1` enables it;
 *     unset/falsy keeps responses `no-store` so dev runs can't serve
 *     stale data while iterating.
 *
 * Why a header instead of a query-string seed: query strings split
 * URLs across the proxy (analytics, share-links break). A header
 * keeps URLs canonical while still feeding the Caddy cache key.
 */
import {bootId} from './bootId';
import {getFeatureVersions} from './cacheVersion';

export interface CacheHeaderOpts {
    /** Feature ids that contributed data to this response. */
    features: readonly string[];
    /** Public anonymous response → SWR. Authed → no-store always. */
    isPublic: boolean;
    /** GraphQL anon reads use a shorter TTL than full HTML pages. */
    audience?: 'page' | 'graphql';
}

const PROD_CACHE_ON = (): boolean => process.env.PROD_CACHE === '1';

const TTL_PAGE = 60;
const TTL_GRAPHQL = 30;
const SWR = 600;

/** Build the header pair. Empty `features` is fine — emits bootId-only tag. */
export async function buildCacheHeaders(opts: CacheHeaderOpts): Promise<Record<string, string>> {
    const versions = await getFeatureVersions(opts.features);
    const tagBody = opts.features
        .map(f => `${f}=${versions[f] ?? 0}`)
        .join(',');
    const tag = tagBody ? `${bootId};${tagBody}` : bootId;

    const headers: Record<string, string> = {'X-Cms-Cache-Tag': tag};

    if (!PROD_CACHE_ON() || !opts.isPublic) {
        headers['Cache-Control'] = 'no-store';
        return headers;
    }
    const ttl = opts.audience === 'graphql' ? TTL_GRAPHQL : TTL_PAGE;
    headers['Cache-Control'] = `public, max-age=${ttl}, stale-while-revalidate=${SWR}`;
    return headers;
}

/** Convenience for Next API routes — apply directly to the response. */
export async function applyCacheHeaders(
    res: {setHeader: (k: string, v: string) => void},
    opts: CacheHeaderOpts,
): Promise<void> {
    const headers = await buildCacheHeaders(opts);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
}
