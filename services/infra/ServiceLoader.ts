import {Loader} from './Loader';
import type {
    FeatureAuthzContribution,
    FeatureContext,
    FeatureIndexSpec,
    FeatureManifest,
} from './featureManifest';

/**
 * ServiceLoader — backend half of the Class Loader hierarchy.
 *
 * Lives at `services/features/<Feature>/<Feature>ServiceLoader.ts`. A
 * concrete subclass declares the same artefacts a `FeatureManifest`
 * literal would: services, indexes, SDL fragment, resolvers, authz,
 * `onBoot` hook. The `toManifest()` adapter feeds the existing
 * `featureRegistry` pipeline — Loader-authored features and literal
 * manifests boot through the same code path.
 *
 * Why class authoring:
 *   - Inheritance: shared base behaviour (e.g. a base ECommerceServiceLoader
 *     that defaults `coreInfrastructure: false` and `enabled: () => …`)
 *     becomes one class to inherit from instead of a literal-spread
 *     pattern.
 *   - Type discipline: methods like `buildServices(ctx)` carry the
 *     `FeatureContext` type from the abstract signature; literal-form
 *     manifests had to re-declare the type at every call site.
 *   - Future surface: per-feature `RestartReason`, `functionalRoles`,
 *     batched data accessors (the deferred DataLoader item) all hang
 *     off the loader. Adding them to a base class subclass-by-subclass
 *     is cleaner than amending the manifest interface.
 */
export abstract class ServiceLoader extends Loader {
    /**
     * Construct services. Same contract as `FeatureManifest.services` —
     * returns a `{<key>: instance}` map shallow-merged into the shared
     * service map. Earlier features in topological order are visible
     * via `ctx.services`.
     */
    buildServices?(ctx: FeatureContext): Record<string, unknown>;

    /** Mongo indexes to ensure on first connect. */
    readonly indexes?: readonly FeatureIndexSpec[];

    /** GraphQL SDL fragment as a string. Concatenated into the composed schema. */
    readonly schemaSDL?: string;

    /** Resolver tree — strict-merged into the composed resolver map. */
    readonly resolvers?: Record<string, unknown>;

    /** Authz table contributions. */
    readonly authz?: FeatureAuthzContribution;

    /** One-shot lifecycle hook after services are built and indexes applied. */
    onBoot?(ctx: FeatureContext): Promise<void> | void;

    /**
     * Adapter — emit a literal `FeatureManifest` the existing registry
     * understands. Methods are bound so `this` survives the indirection
     * when the registry calls them later.
     *
     * The shape mirrors `FeatureManifest` 1:1 with one exception:
     * methods on the loader are wrapped in arrow functions so the
     * registry's existing call sites (`feature.services?.(ctx)`) work
     * without `.bind(this)` everywhere.
     */
    toManifest(): FeatureManifest {
        const m: FeatureManifest = {
            id: this.id,
            displayName: this.displayName,
        };
        if (this.requires) m.requires = this.requires;
        if (this.enabled !== undefined) m.enabled = this.enabled;
        if (this.coreInfrastructure !== undefined) m.coreInfrastructure = this.coreInfrastructure;
        if (this.indexes) m.indexes = this.indexes;
        if (this.schemaSDL) m.schemaSDL = this.schemaSDL;
        if (this.resolvers) m.resolvers = this.resolvers;
        if (this.authz) m.authz = this.authz;
        if (this.buildServices) m.services = (ctx) => this.buildServices!(ctx);
        if (this.onBoot) m.onBoot = (ctx) => this.onBoot!(ctx);
        if (this.functionalRoles) m.functionalRoles = this.functionalRoles;
        return m;
    }
}
