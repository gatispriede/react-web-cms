import {listPublicRoutes} from './clientUILoaderRegistry';
import {withFeatureGate, withFeatureGatePaths} from '@client/lib/featureGate';

/**
 * Resolve a Next.js page path (e.g. `/products`, `/products/[slug]`)
 * back to the feature id that gates it. Returns `undefined` when no
 * registered ClientUILoader owns the path — the caller stays on its
 * legacy literal-id `withFeatureGate(...)` call.
 *
 * Match is exact on `path` first; we don't try to pattern-match URL
 * params here because pages know their own pattern at compile time
 * (`pages/products/[slug].tsx` calls `gateForPath('/products/[slug]')`
 * literally).
 */
export function gateForPath(path: string): string | undefined {
    for (const r of listPublicRoutes()) {
        if (r.path === path) return r.featureId;
    }
    return undefined;
}

/**
 * Sugar for `getStaticProps` / `getServerSideProps`: resolves the gate
 * from the page's own pathname and wraps the loader. Throws at boot if
 * the path isn't registered — that's a programmer error (the page
 * declared `gatePath('/foo')` but no ClientUILoader claims `/foo`).
 *
 *   export const getStaticProps = gatePath('/products', async (ctx) => {…})
 *
 * Equivalent to:
 *
 *   export const getStaticProps = withFeatureGate('products', async (ctx) => {…})
 *
 * but the literal feature id moves out of the page file and into the
 * feature's loader.
 */
export function gatePath<T extends (ctx: any) => any>(path: string, inner?: T): T {
    const id = gateForPath(path);
    if (!id) {
        throw new Error(`[applyPublicGates] no ClientUILoader registers path "${path}"`);
    }
    return withFeatureGate(id, inner) as T;
}

/** Same as `gatePath` for `getStaticPaths`. */
export function gatePathPaths<T extends (ctx: any) => any>(path: string, inner: T): T {
    const id = gateForPath(path);
    if (!id) {
        throw new Error(`[applyPublicGates] no ClientUILoader registers path "${path}"`);
    }
    return withFeatureGatePaths(id, inner) as T;
}
