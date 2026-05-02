import {describe, expect, it} from 'vitest';
import {ProductsServiceLoader} from './ProductsServiceLoader';
import {productsFeature} from './feature.manifest';
import {ServiceLoader} from '@services/infra/ServiceLoader';
import {Loader} from '@services/infra/Loader';

/**
 * Class Loader L2 — sanity tests for the loader hierarchy and the
 * `toManifest()` adapter. The detailed manifest-shape coverage lives
 * in `feature.manifest.test.ts` (the literal-style tests still apply
 * because the literal IS now the loader's `.toManifest()` output).
 */
describe('ProductsServiceLoader', () => {
    it('extends ServiceLoader -> Loader', () => {
        const loader = new ProductsServiceLoader();
        expect(loader).toBeInstanceOf(ServiceLoader);
        expect(loader).toBeInstanceOf(Loader);
    });

    it('toManifest() reproduces the same shape the registry sees', () => {
        // The exported `productsFeature` IS the loader's toManifest().
        // A second loader instance should produce a structurally equal
        // manifest (apart from function identity).
        const loader = new ProductsServiceLoader();
        const fresh = loader.toManifest();
        expect(fresh.id).toBe(productsFeature.id);
        expect(fresh.displayName).toBe(productsFeature.displayName);
        expect(fresh.indexes).toEqual(productsFeature.indexes);
        expect(fresh.schemaSDL).toBe(productsFeature.schemaSDL);
        expect(fresh.authz).toEqual(productsFeature.authz);
        // services + onBoot are functions; just check presence parity.
        expect(typeof fresh.services).toBe(typeof productsFeature.services);
        expect(typeof fresh.onBoot).toBe(typeof productsFeature.onBoot);
    });

    it('does not leak loader-only fields onto the manifest', () => {
        const m = new ProductsServiceLoader().toManifest();
        // Manifest interface keys only — no class-internal fields.
        const allowed = new Set([
            'id', 'displayName', 'requires', 'enabled', 'coreInfrastructure',
            'services', 'indexes', 'schemaSDL', 'resolvers', 'authz', 'onBoot',
        ]);
        for (const key of Object.keys(m)) {
            expect(allowed.has(key)).toBe(true);
        }
    });
});
