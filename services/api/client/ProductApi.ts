import {IProduct, InProduct} from "@interfaces/IProduct";

/**
 * MOCK STUB — the GraphQL `getProducts`/`saveProduct` resolvers don't exist
 * on the server yet, so every call to gqty's `resolve(({query}) => query.mongo.getProducts)`
 * throws `query.mongo.getProducts is not a function` at runtime and crashes
 * the admin Products page. Until the real schema lands, every method returns
 * empty/no-op data so the UI mounts cleanly. Replace with the real `resolve`-
 * backed implementation once `services/api/schema.graphql` exposes the
 * Products operations and `pnpm generate` re-emits the gqty client.
 */
export class ProductApi {
    async list(_opts: {
        includeDrafts?: boolean;
        limit?: number;
        category?: string;
        inStockOnly?: boolean;
        source?: 'manual' | 'warehouse';
    } = {}): Promise<IProduct[]> {
        return [];
    }

    async getBySlug(_slug: string, _includeDrafts = false): Promise<IProduct | null> {
        return null;
    }

    async search(_q: string, _limit = 50, _includeDrafts = false): Promise<IProduct[]> {
        return [];
    }

    async save(_product: InProduct, _expectedVersion?: number | null): Promise<{id?: string; version?: number; slug?: string; error?: string}> {
        return {error: 'Products API not implemented yet'};
    }

    async remove(_id: string): Promise<{id?: string; deleted?: number; error?: string}> {
        return {error: 'Products API not implemented yet'};
    }

    async setPublished(_id: string, _publish: boolean): Promise<{id?: string; draft?: boolean; error?: string}> {
        return {error: 'Products API not implemented yet'};
    }
}

export default ProductApi;
