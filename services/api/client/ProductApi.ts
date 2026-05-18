import {resolve} from "@services/api/generated";
import {IProduct, InProduct} from "@interfaces/IProduct";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";
import {log} from "@services/infra/logger";

export class ProductApi {
    async list(opts: {
        includeDrafts?: boolean;
        limit?: number;
        category?: string;
        inStockOnly?: boolean;
        source?: 'manual' | 'warehouse';
    } = {}): Promise<IProduct[]> {
        // Direct fetch instead of gqty.resolve — same workaround pattern
        // as ThemeApi.listThemes() and UserApi.removeUser(). gqty's
        // resolve silently returned nothing here (no network request
        // ever issued) even with `getProducts` present in the generated
        // schema; the admin Products page rendered "No products yet"
        // despite 7 products living in Mongo. Raw POST resolves cleanly.
        try {
            const args = {
                includeDrafts: !!opts.includeDrafts,
                limit: opts.limit ?? 50,
                category: opts.category ?? null,
                inStockOnly: opts.inStockOnly ?? null,
                source: opts.source ?? null,
            };
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    query: `query L($includeDrafts: Boolean, $limit: Int, $category: String, $inStockOnly: Boolean, $source: String) { mongo { getProducts(includeDrafts: $includeDrafts, limit: $limit, category: $category, inStockOnly: $inStockOnly, source: $source) } }`,
                    variables: args,
                }),
            });
            const json = await r.json();
            if (json?.errors?.length) {
                log.error({scope: 'product.list', errors: json.errors}, 'product list graphql errors');
                return [];
            }
            const raw = json?.data?.mongo?.getProducts;
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            log.error({scope: 'product.list', err}, 'product list failed');
            return [];
        }
    }

    async getBySlug(slug: string, includeDrafts = false): Promise<IProduct | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getProduct({slug, includeDrafts}));
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            log.error({scope: 'product.getBySlug', err}, 'product getBySlug failed');
            return null;
        }
    }

    async search(q: string, limit = 50, includeDrafts = false): Promise<IProduct[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.searchProducts({q, limit, includeDrafts}));
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            log.error({scope: 'product.search', err}, 'product search failed');
            return [];
        }
    }

    async save(product: InProduct, expectedVersion?: number | null): Promise<{id?: string; version?: number; slug?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.saveProduct({
                product,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            const result = parsed.saveProduct ?? parsed;
            refreshBus.emit('settings');
            const finalSlug = result?.slug || product?.slug;
            // Mirror PostApi: if the server collision-bumped the slug,
            // revalidate BOTH the requested and final paths so a stale
            // ISR snapshot doesn't keep serving the previous body.
            if (finalSlug) triggerRevalidate({scope: 'product', slug: finalSlug});
            if (product?.slug && finalSlug && product.slug !== finalSlug) {
                triggerRevalidate({scope: 'product', slug: product.slug});
            }
            triggerRevalidate({scope: 'products'});
            return result;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }

    async remove(id: string): Promise<{id?: string; deleted?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.deleteProduct({id}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            triggerRevalidate({scope: 'products'});
            return parsed.deleteProduct ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }

    async setPublished(id: string, publish: boolean): Promise<{id?: string; draft?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.setProductPublished({id, publish}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            triggerRevalidate({scope: 'products'});
            return parsed.setProductPublished ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }
}

export default ProductApi;
