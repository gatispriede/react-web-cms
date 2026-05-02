import type {AdminPaneDescriptor, AdminUILoader} from './AdminUILoader';

/**
 * Admin UI loader registry — Class Loader L4 (2026-05-02).
 *
 * Per `docs/features/platform/class-loader.md`: each migrated feature
 * exports an `<X>AdminUILoader.ts` that declares its admin pane shape.
 * The registry collects those declarations; the AdminShell looks up by
 * route/id instead of running through a hand-wired switch.
 *
 * Migration is feature-by-feature (decision 11 — 2026-05-02). Until a
 * feature's loader lands, the legacy `UserStatusBar.tsx` switch continues
 * to handle it. Once the registry covers everything, the switch shrinks
 * to a fallback and eventually disappears.
 *
 * No codegen for the UI side yet — manual registration here keeps the
 * surface small while the pattern beds in. Codegen scan of
 * `ui/admin/features/.../*AdminUILoader.ts` is a later cleanup.
 */

import {PostsAdminUILoader} from '@admin/features/Posts/PostsAdminUILoader';
import {FooterAdminUILoader} from '@admin/features/Footer/FooterAdminUILoader';
import {AnalyticsAdminUILoader} from '@admin/features/Analytics/AnalyticsAdminUILoader';
import {ErrorLogAdminUILoader} from '@admin/features/Observability/ErrorLogAdminUILoader';
import {McpAdminUILoader} from '@admin/features/Mcp/McpAdminUILoader';
import {AuditAdminUILoader} from '@admin/features/Audit/AuditAdminUILoader';
import {PublishingAdminUILoader} from '@admin/features/Publishing/PublishingAdminUILoader';
import {LogoAdminUILoader} from '@admin/features/Logo/LogoAdminUILoader';
import {InquiriesAdminUILoader} from '@admin/features/Inquiries/InquiriesAdminUILoader';
import {UsersAdminUILoader} from '@admin/features/Users/UsersAdminUILoader';
import {BundleAdminUILoader} from '@admin/features/Bundle/BundleAdminUILoader';
import {OrdersAdminUILoader} from '@admin/features/Orders/OrdersAdminUILoader';
import {InventoryAdminUILoader} from '@admin/features/Inventory/InventoryAdminUILoader';
import {ProductsAdminUILoader} from '@admin/features/Products/ProductsAdminUILoader';
import {LayoutAdminUILoader} from '@admin/features/Navigation/LayoutAdminUILoader';
import {ThemeAdminUILoader} from '@admin/features/Themes/ThemeAdminUILoader';
import {LanguagesAdminUILoader} from '@admin/features/Languages/LanguagesAdminUILoader';
import {AgentAdminUILoader}     from '@admin/features/Agent/AgentAdminUILoader';

const REGISTERED: AdminUILoader[] = [
    new PostsAdminUILoader(),
    new FooterAdminUILoader(),
    new AnalyticsAdminUILoader(),
    new ErrorLogAdminUILoader(),
    new McpAdminUILoader(),
    new AuditAdminUILoader(),
    new PublishingAdminUILoader(),
    new LogoAdminUILoader(),
    new InquiriesAdminUILoader(),
    new UsersAdminUILoader(),
    new BundleAdminUILoader(),
    new OrdersAdminUILoader(),
    new InventoryAdminUILoader(),
    new ProductsAdminUILoader(),
    new LayoutAdminUILoader(),
    new ThemeAdminUILoader(),
    new LanguagesAdminUILoader(),
    new AgentAdminUILoader(),
];

/**
 * Look up an AdminUILoader by its `adminPane.id`. Returns `undefined`
 * for non-migrated panes — the legacy switch handles those.
 */
export function findAdminPaneById(id: string): AdminPaneDescriptor | undefined {
    for (const loader of REGISTERED) {
        if (loader.adminPane?.id === id) return loader.adminPane;
    }
    return undefined;
}

/**
 * Look up by route, e.g. `/admin/release/analytics`. Slower than id
 * lookup but lets the AdminShell mount panes off the URL when the
 * shell doesn't know an explicit `view` string.
 */
export function findAdminPaneByRoute(route: string): AdminPaneDescriptor | undefined {
    for (const loader of REGISTERED) {
        if (loader.adminPane?.route === route) return loader.adminPane;
    }
    return undefined;
}

/** Every registered admin pane descriptor — sidebar helpers iterate here. */
export function listAdminPanes(): readonly AdminPaneDescriptor[] {
    return REGISTERED
        .map(l => l.adminPane)
        .filter((p): p is AdminPaneDescriptor => Boolean(p));
}
