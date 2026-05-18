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
import {AnalyticsFiltersAdminUILoader} from '@admin/features/Analytics/AnalyticsFiltersAdminUILoader';
import {ErrorLogAdminUILoader} from '@admin/features/Observability/ErrorLogAdminUILoader';
import {PerfBeaconsAdminUILoader} from '@admin/features/Observability/PerfBeaconsAdminUILoader';
import {McpAdminUILoader} from '@admin/features/Mcp/McpAdminUILoader';
import {AuditAdminUILoader} from '@admin/features/Audit/AuditAdminUILoader';
import {PublishingAdminUILoader} from '@admin/features/Publishing/PublishingAdminUILoader';
import {LogoAdminUILoader} from '@admin/features/Logo/LogoAdminUILoader';
import {InquiriesAdminUILoader} from '@admin/features/Inquiries/InquiriesAdminUILoader';
import {UsersAdminUILoader} from '@admin/features/Users/UsersAdminUILoader';
import {PermissionsAdminUILoader} from '@admin/features/Permissions/PermissionsAdminUILoader';
import {BundleAdminUILoader} from '@admin/features/Bundle/BundleAdminUILoader';
import {OrdersAdminUILoader} from '@admin/features/Orders/OrdersAdminUILoader';
import {InventoryAdminUILoader} from '@admin/features/Inventory/InventoryAdminUILoader';
import {ProductsAdminUILoader} from '@admin/features/Products/ProductsAdminUILoader';
import {LayoutAdminUILoader} from '@admin/features/Navigation/LayoutAdminUILoader';
import {ThemeAdminUILoader} from '@admin/features/Themes/ThemeAdminUILoader';
import {LanguagesAdminUILoader} from '@admin/features/Languages/LanguagesAdminUILoader';
import {AgentAdminUILoader}     from '@admin/features/Agent/AgentAdminUILoader';
import {OnboardingAdminUILoader} from '@admin/features/Onboarding/OnboardingAdminUILoader';
import {ThingsToDoAdminUILoader} from '@admin/features/ThingsToDo/ThingsToDoAdminUILoader';
import {TrashAdminUILoader} from '@admin/features/Trash/TrashAdminUILoader';
import {DiagnosticsAdminUILoader} from '@admin/features/Diagnostics/DiagnosticsAdminUILoader';
import {EmailAdminUILoader} from '@admin/features/Email/EmailAdminUILoader';
import {EmailTemplatesAdminUILoader} from '@admin/features/Email/EmailTemplatesAdminUILoader';
import {ReleasesAdminUILoader} from '@admin/features/Releases/ReleasesAdminUILoader';
import {RedirectsAdminUILoader} from '@admin/features/Redirects/RedirectsAdminUILoader';
import {BackupAdminUILoader} from '@admin/features/Platform/BackupAdminUILoader';
import {CarsAdminUILoader} from '@admin/features/Cars/CarsAdminUILoader';
import {AttributionAdminUILoader} from '@admin/features/Observability/AttributionAdminUILoader';
import {SeoOverviewAdminUILoader} from '@admin/features/SeoOverview/SeoOverviewAdminUILoader';
import {ComplianceAdminUILoader} from '@admin/features/Compliance/ComplianceAdminUILoader';
import {CommerceAdminUILoader} from '@admin/features/Commerce/CommerceAdminUILoader';
import {AuthAdminUILoader} from '@admin/features/Auth/AuthAdminUILoader';
import {WarehouseSyncAdminUILoader} from '@admin/features/Pages/WarehouseSyncAdminUILoader';
import {SystemPagesAdminUILoader} from '@admin/features/Pages/SystemPagesAdminUILoader';
import {CustomerAccountSettingsAdminUILoader} from '@admin/features/CustomerAccountSettings/CustomerAccountSettingsAdminUILoader';
import {ProductTemplatesAdminUILoader} from '@admin/features/ProductTemplates/ProductTemplatesAdminUILoader';
import {CheckoutCustomizationAdminUILoader} from '@admin/features/Checkout/CheckoutCustomizationAdminUILoader';
import {AbandonedCartAdminUILoader} from '@admin/features/Checkout/AbandonedCartAdminUILoader';
import {ModulesPreviewAdminUILoader} from '@admin/features/ModulesPreview/ModulesPreviewAdminUILoader';
import {SeoAdminUILoader} from '@admin/features/Seo/SeoAdminUILoader';
import {InvoicesAdminUILoader} from '@admin/features/Invoices/InvoicesAdminUILoader';

const REGISTERED: AdminUILoader[] = [
    new PostsAdminUILoader(),
    new FooterAdminUILoader(),
    new AnalyticsAdminUILoader(),
    new AnalyticsFiltersAdminUILoader(),
    new ErrorLogAdminUILoader(),
    new PerfBeaconsAdminUILoader(),
    new McpAdminUILoader(),
    new AuditAdminUILoader(),
    new PublishingAdminUILoader(),
    new LogoAdminUILoader(),
    new InquiriesAdminUILoader(),
    new UsersAdminUILoader(),
    new PermissionsAdminUILoader(),
    new BundleAdminUILoader(),
    new OrdersAdminUILoader(),
    new InventoryAdminUILoader(),
    new ProductsAdminUILoader(),
    new LayoutAdminUILoader(),
    new ThemeAdminUILoader(),
    new LanguagesAdminUILoader(),
    new AgentAdminUILoader(),
    new OnboardingAdminUILoader(),
    new ThingsToDoAdminUILoader(),
    new TrashAdminUILoader(),
    new DiagnosticsAdminUILoader(),
    new EmailAdminUILoader(),
    new EmailTemplatesAdminUILoader(),
    new ReleasesAdminUILoader(),
    new RedirectsAdminUILoader(),
    new BackupAdminUILoader(),
    new CarsAdminUILoader(),
    new AttributionAdminUILoader(),
    new SeoOverviewAdminUILoader(),
    new ComplianceAdminUILoader(),
    new CommerceAdminUILoader(),
    new AuthAdminUILoader(),
    new WarehouseSyncAdminUILoader(),
    new SystemPagesAdminUILoader(),
    new CustomerAccountSettingsAdminUILoader(),
    new ProductTemplatesAdminUILoader(),
    new CheckoutCustomizationAdminUILoader(),
    new AbandonedCartAdminUILoader(),
    new ModulesPreviewAdminUILoader(),
    new SeoAdminUILoader(),
    new InvoicesAdminUILoader(),
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
