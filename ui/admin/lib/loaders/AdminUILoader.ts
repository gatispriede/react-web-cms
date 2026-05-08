import type {ComponentType, LazyExoticComponent} from 'react';
import type {EItemType} from '@enums/EItemType';
import type {TFunction} from 'i18next';
import {UILoader} from '@client/lib/loaders/UILoader';

/**
 * Admin-side variants of the feature pane. Per `admin-ui-modes.md`
 * (decision 2026-05-02) each feature ships TWO components — a
 * simplified view and an advanced view — and the AdminShell never
 * branches on mode internally; it just picks the right component.
 */
export interface AdminPaneDescriptor {
    /** Stable id — used as the route segment + admin-ui-mode key. */
    readonly id: string;
    /** Sidebar / top-bar label. Translated via the loader's i18n namespace. */
    readonly title: string;
    /** AntD icon component (or any ReactNode-returning ComponentType). */
    readonly icon?: ComponentType<{className?: string}>;
    /** Admin route, e.g. `/admin/content/products`. */
    readonly route: string;
    /**
     * Per-mode view components. Either a plain `ComponentType` or a
     * `React.lazy()`-wrapped component — the shell wraps the dispatch
     * site in `<Suspense>` so lazy variants stream in on first render
     * (admin-ui-modes 2026-05-07: simplified-base / advanced-extends
     * lazy-load convention).
     */
    readonly modes: {
        readonly simplified?:
            | ComponentType<Record<string, unknown>>
            | LazyExoticComponent<ComponentType<Record<string, unknown>>>;
        readonly advanced:
            | ComponentType<Record<string, unknown>>
            | LazyExoticComponent<ComponentType<Record<string, unknown>>>;
    };
    /**
     * Default to `false` for any write/mutation tool surfaced via MCP.
     * Used by the MCP execution gate in simplified mode (per
     * `admin-ui-modes.md` decision 3).
     */
    readonly advancedOnly?: boolean;
}

/**
 * Admin-side editor for a module item type. Pairs with the public-site
 * `ClientItemType.Display` defined on the matching ClientUILoader.
 */
export interface AdminItemType {
    readonly key: EItemType;
    readonly Editor: ComponentType<{
        t: TFunction<'translation', undefined>;
        content: string;
        setContent: (value: string) => void;
    }>;
    /** Default content JSON for a freshly created item (one-row seed lives here). */
    readonly defaultContent: string;
    /** Allowed style enum (drives the Style picker). */
    readonly styleEnum: Record<string, string>;
    /** Translation keys for label + description in the picker. */
    readonly labelKey: string;
    readonly descriptionKey: string;
    /** Picker category bucket. */
    readonly category: 'hero' | 'media' | 'content' | 'cta';
}

/**
 * AdminUILoader — admin-side contributions for a feature.
 *
 *   ui/admin/modules/<Feature>/   → module editors (AdminItemType[])
 *   ui/admin/features/<Feature>/  → feature-level admin surfaces
 *                                    (e.g. Products.tsx admin pane)
 *
 * Loaded only into the admin client bundle. Server boot and public-site
 * bundles never import it.
 */
export abstract class AdminUILoader extends UILoader {
    /** Top-level admin pane descriptor, if the feature owns a route. */
    readonly adminPane?: AdminPaneDescriptor;

    /** Module editors contributed by this feature. */
    readonly itemTypeEditors?: readonly AdminItemType[];
}
