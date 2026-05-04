import {Loader} from '@services/infra/Loader';

/**
 * UILoader (abstract) — the UI-side branch of the Class Loader hierarchy.
 * Sub-classed by `ClientUILoader` (public site) and `AdminUILoader` (admin).
 *
 * Lives in `ui/client/lib/loaders/` because both client and admin trees
 * import from `@client/lib/...` — keeps the abstract base reachable
 * from either side without a circular dependency.
 *
 * UI loaders DO NOT register services or contribute to the GraphQL
 * surface — they're a parallel branch off the same `Loader` root,
 * carrying only the metadata the UI needs to mount the feature. The
 * boundary is enforced at the type level so server bundles never pull
 * in React / AntD imports through a misclassified loader.
 */
export abstract class UILoader extends Loader {
    /**
     * Optional i18n namespaces this loader contributes — registered
     * with the i18n boot when the feature is mounted. `null`/omitted
     * means "use the global `admin` / `common` namespaces."
     */
    readonly i18nNamespaces?: readonly string[];
}
