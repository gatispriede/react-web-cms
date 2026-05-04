import {isFeatureEnabled} from '@services/infra/featureFlags';

/**
 * Wrap a Next.js data loader (`getStaticProps` / `getServerSideProps`)
 * with a plug-and-play feature gate. If the feature is disabled at
 * request time, the wrapped loader skips the wrapped function entirely
 * and returns `notFound: true` — the route 404s end-to-end (no leaked
 * empty-state render, no half-mounted `cart` button on a checkout-off
 * site).
 *
 * Usage:
 *   export const getStaticProps = withFeatureGate('products', async (ctx) => { … }) as GetStaticProps<Props>;
 *   export const getServerSideProps = withFeatureGate('cart') as GetServerSideProps;
 *
 * Type-erased on purpose. Next's loader result types are loose enough
 * that a precise typing here ends up fighting every caller's shape;
 * the call site casts to the concrete loader type.
 */
type AnyLoader = (ctx: any) => Promise<unknown> | unknown;

export function withFeatureGate(featureId: string, inner?: AnyLoader): AnyLoader {
    return async (ctx: any) => {
        if (!isFeatureEnabled(featureId)) {
            return {notFound: true};
        }
        if (inner) {
            return await inner(ctx);
        }
        return {props: {}};
    };
}

/**
 * Same idea for `getStaticPaths` — if the feature is off, return zero
 * paths and `fallback: false` so Next won't even attempt to render the
 * route. Pair with `withFeatureGate` on the matching `getStaticProps`
 * so a hand-typed URL still 404s when the feature flips off.
 */
export function withFeatureGatePaths(featureId: string, inner: AnyLoader): AnyLoader {
    return async (ctx: any) => {
        if (!isFeatureEnabled(featureId)) {
            return {paths: [], fallback: false};
        }
        return await inner(ctx);
    };
}
