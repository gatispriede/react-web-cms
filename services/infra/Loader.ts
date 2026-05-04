/**
 * Loader (abstract) — top of the unified feature-loading hierarchy described
 * in `docs/features/platform/class-loader.md`.
 *
 * Layers:
 *
 *   Loader (this file, abstract)
 *   ├── ServiceLoader        — backend (services/features/<Feature>/)
 *   └── UILoader (abstract)
 *       ├── ClientUILoader   — public site (ui/client/modules + ui/client/features)
 *       └── AdminUILoader    — admin (ui/admin/modules + ui/admin/features)
 *
 * The base class only carries identity + lifecycle metadata so the same
 * abstract type can describe a backend service, a public UI surface, OR
 * an admin UI surface. Concrete subclasses add the side-specific hooks.
 *
 * Loaders are class-based authoring for the existing `FeatureManifest`
 * contract — `ServiceLoader.toManifest()` feeds the same registry that
 * literal manifest objects feed. No codegen change is required to ship
 * one; legacy `feature.manifest.ts` literals keep working alongside.
 */
export abstract class Loader {
    /** Stable id — matches the folder name in lowerCamelCase. Same semantics as `FeatureManifest.id`. */
    abstract readonly id: string;

    /** Human-readable name shown in admin UIs and error messages. */
    abstract readonly displayName: string;

    /**
     * Other feature ids this one depends on. The registry topologically
     * sorts and auto-disables dependants when a required feature is off.
     */
    readonly requires?: readonly string[];

    /**
     * Default enabled state. The plug-and-play resolution stack
     * (env > Mongo override > default) takes precedence; this field is
     * the bottom of that stack.
     *
     * Use a thunk if the decision depends on env vars at boot time.
     */
    readonly enabled?: boolean | (() => boolean);

    /**
     * "Always on" — the platform depends on this feature being present.
     * The plug-and-play UI hides the toggle for these so a misconfigured
     * flag can never knock the system over.
     */
    readonly coreInfrastructure?: boolean;

    /**
     * Functional roles this feature contributes to the permission system.
     * Per `docs/features/platform/edit-levels.md` (decision 4). The
     * registry merges every Loader's `functionalRoles` into one global
     * list; the admin "assign roles to user" UI lists the
     * `assignable: true` subset. Empty/omitted is fine — most features
     * don't define their own functional roles.
     */
    readonly functionalRoles?: readonly import('@interfaces/IPermission').FunctionalRoleDescriptor[];
}
