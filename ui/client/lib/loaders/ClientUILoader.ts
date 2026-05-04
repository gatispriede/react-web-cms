import type {ComponentType} from 'react';
import type {EItemType} from '@enums/EItemType';
import type {IItem} from '@interfaces/IItem';
import type {TFunction} from 'i18next';
import {UILoader} from './UILoader';

/**
 * Public-route descriptor. The router consumer (Next.js page tree)
 * reads this to apply `withFeatureGate` automatically and to know
 * which feature owns which path.
 */
export interface ClientPublicRoute {
    /** Next.js path pattern, e.g. `/products` or `/products/[slug]`. */
    readonly path: string;
    /** Feature id whose flag gates the route. Defaults to the loader's id. */
    readonly gate?: string;
}

/**
 * Item-type descriptor — the public-side renderer for a module. The
 * full registry today lives in `ui/admin/lib/itemTypes/registry.ts`;
 * Class Loader L3 will move each entry to its owning ClientUILoader
 * + AdminUILoader pair (renderer + editor sit next to the feature).
 */
export interface ClientItemType {
    readonly key: EItemType;
    readonly Display: ComponentType<{
        item: IItem;
        t: TFunction<'translation', undefined>;
        tApp: TFunction<string, undefined>;
        admin?: boolean;
    }>;
}

/**
 * ClientUILoader — public-site contributions for a feature.
 *
 *   ui/client/modules/<Feature>/   → module renderers (ClientItemType[])
 *   ui/client/features/<Feature>/  → feature-level public surfaces
 *                                    (e.g. /products list, /blog index)
 *
 * Concrete subclasses are loaded only into the public-site bundle —
 * Next.js imports them through a shared registry (Class Loader L3) so
 * the admin bundle and the server boot never pull in their React
 * imports.
 */
export abstract class ClientUILoader extends UILoader {
    /** Public Next.js routes this feature owns. Auto-gated by `withFeatureGate`. */
    readonly publicRoutes?: readonly ClientPublicRoute[];

    /** Module renderers contributed by this feature. */
    readonly itemTypes?: readonly ClientItemType[];
}
