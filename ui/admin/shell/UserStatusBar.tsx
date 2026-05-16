import AdminApp from "./AdminApp";
import Head from "next/head";
import React, {useEffect, useState, ReactNode, Suspense} from "react";
import {Spin} from "antd";
import {Session} from "next-auth";
import AdminSettings from "./AdminSettings";
import AdminSettingsLanguages from "@admin/features/Languages/Languages";
import TranslationManager from "./TranslationManager";
import {useT as useTranslation} from "next-i18next/client";
import Backend from "i18next-http-backend";
import {TFunction} from "i18next";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import CommandPalette from "./CommandPalette/CommandPalette";
import {I18nextProvider, useTranslation as useReactTranslation} from "react-i18next";
import adminI18n, {AdminLocale, setAdminLocale, detectStoredOrNavigatorLocale} from "@admin/i18n/adminI18n";
import ModulesPreview from "@client/lib/preview/ModulesPreview";
import AreaNav from "./AreaNav";
import AdminSettingsSEO from "@admin/features/Seo/SEO";
import {findAdminPaneById} from "@admin/lib/loaders/adminUILoaderRegistry";
import {useAdminMode} from "@admin/lib/adminMode";
import FeatureFlagsPanel from "@admin/features/Platform/FeatureFlagsPanel";
import {UserRole} from "@interfaces/IUser";
import AdminTopBar from "./AdminTopBar/AdminTopBar";
import {buildAreaItems, isInArea} from "./AdminTopBar/adminAreaItems";

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 *
 * Each sub-concern is its own URL — no tab-strip inside an area. The view
 * literal that the page passes in identifies a single component to render
 * in the main pane, alongside its area's `<AreaNav/>` rail.
 *
 * `app`, `settings`, `languages`, `modules-preview` are the legacy views
 * kept for backwards compatibility with the (302-redirected) old URLs.
 */
export type AdminView =
    | 'app'
    | 'settings'
    | 'languages'
    | 'modules-preview'
    | 'build'
    | 'build/modules-preview'
    // admin-information-architecture re-pivot (2026-05-16, same day as
    // first ship) — 5 task-driven top-level buckets:
    //   Build / Content / Settings / Analytics / System
    | 'content'
    | 'content/pages'
    | 'content/translations'
    | 'content/posts'
    | 'content/system-pages'
    | 'content/releases'
    | 'content/publishing'
    | 'content/trash'
    | 'content/products'
    | 'content/inventory'
    | 'content/orders'
    | 'content/invoices'
    | 'content/customers'
    | 'content/inquiries'
    | 'settings'
    | 'settings/chrome'
    | 'settings/chrome/footer'
    | 'settings/chrome/header'
    | 'settings/chrome/logo'
    | 'settings/theme'
    | 'settings/languages'
    | 'settings/seo'
    | 'settings/features'
    | 'settings/features/auth'
    | 'settings/features/commerce'
    | 'settings/features/dropship'
    | 'settings/features/email'
    | 'settings/features/compliance'
    | 'settings/features/redirects'
    | 'settings/access'
    | 'settings/access/users'
    | 'settings/access/permissions'
    | 'settings/access/auth'
    | 'settings/account'
    | 'analytics'
    | 'analytics/seo'
    | 'analytics/audit-log'
    | 'analytics/attribution'
    | 'analytics/filters'
    | 'system'
    | 'system/mcp'
    | 'system/features'
    | 'system/agent'
    | 'system/diagnostics'
    | 'system/errors'
    | 'system/performance'
    | 'system/bundle'
    | 'system/backups'
    | 'system/modules-preview'
    | 'system/demo-content/cars'
    // First-ship 6-bucket aliases — kept for the 301-shim period so the
    // shell still renders the right pane for anyone who bookmarked one
    // of yesterday's 6-bucket URLs. Retired alongside the per-area sweeps.
    | 'site'
    | 'site/themes'
    | 'site/logo'
    | 'site/layout'
    | 'site/footer'
    | 'site/seo'
    | 'site/email'
    | 'site/email-templates'
    | 'site/compliance'
    | 'site/redirects'
    | 'site/account-settings'
    | 'commerce'
    | 'commerce/products'
    | 'commerce/inventory'
    | 'commerce/orders'
    | 'commerce/invoices'
    | 'commerce/settings'
    | 'commerce/checkout'
    | 'commerce/abandoned-carts'
    | 'commerce/warehouse-sync'
    | 'commerce/product-templates'
    | 'people'
    | 'people/users'
    | 'people/inquiries'
    | 'people/permissions'
    | 'people/auth'
    // Pre-IA-jump legacy aliases preserved while the 301 shim is live.
    | 'client-config'
    | 'client-config/themes'
    | 'client-config/logo'
    | 'client-config/site-layout'
    | 'content/footer'
    | 'seo'
    | 'seo/analytics'
    | 'release'
    | 'release/publishing'
    | 'release/bundle'
    | 'release/audit'
    | 'system/users'
    | 'system/analytics-filters'
    | 'system/inquiries'
    | 'system/info'
    | 'system/email';

/**
 * Inner chrome — uses the dedicated `adminI18n` instance via the
 * `I18nextProvider` wrapper below. Visible nav text doesn't shift when
 * the admin edits a language for the public site. Deeper panels still
 * pull their `t` from the public `next-i18next` instance via the `t` /
 * `tApp` props passed in from the SSR loader; that mixed state is
 * acceptable for now (chrome stable, body strings TBD migration).
 */
const UserStatusBarInner = ({session, view, tApp}: {
    session: Session,
    view: AdminView,
    /** Public-site `t` is no longer forwarded into the admin tree — it ignored
     *  the admin-language selector. The admin chrome / field labels now use
     *  `tAdmin` (from `adminI18n`); user content still uses `tApp`. */
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const {t: tAdmin, i18n: adminI} = useReactTranslation();
    const {t: tCommon, i18n: i18nCommon} = useTranslation('common');
    let lang = i18nCommon?.resolvedLanguage ?? (i18nCommon?.language !== 'default' ? i18nCommon?.language : null) ?? 'lv'
    const [, setBlogEnabled] = useState(true);
    const {mode: adminMode} = useAdminMode();
    i18nCommon.use(Backend);
    useEffect(() => {
        void new SiteFlagsApi().get().then(f => setBlogEnabled(f.blogEnabled !== false));
    }, []);
    // Re-install the error reporter with `source: 'admin'` once the admin
    // shell mounts. _app.tsx already installs with 'client' for public
    // pages; this overrides the source for the admin tab so error
    // entries land in the right bucket without a sister listener.
    useEffect(() => {
        // Lazy import keeps the public bundle from pulling the admin
        // imports of this module — admin already pulls it directly here.
        import('@client/lib/reportError').then(({installErrorReporter}) => {
            installErrorReporter({source: 'admin'});
        });
    }, []);
    useEffect(() => {
        const pref = detectStoredOrNavigatorLocale();
        if (pref && adminI.language !== pref) {
            setAdminLocale(pref);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const sessionLocale = (session?.user as any)?.preferredAdminLocale;
    useEffect(() => {
        if ((sessionLocale === 'en' || sessionLocale === 'lv') && adminI.language !== sessionLocale) {
            setAdminLocale(sessionLocale as AdminLocale);
        }
    }, [sessionLocale]); // eslint-disable-line react-hooks/exhaustive-deps

    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;
    const isAdmin = role === 'admin';

    const simplified = adminMode === 'simplified';
    const allAreaItems = buildAreaItems(tAdmin as TFunction<"translation", undefined>);
    // Simplified-mode authors don't manage commerce — the Content rail
    // shows them just the author-facing rows (Posts / Translations /
    // System pages). Products / Inventory / Orders / Invoices stay in
    // the rail for advanced mode. The Commerce + People legacy rails
    // are kept here intact — anyone landing on a legacy URL via the
    // 301 shim still gets a working rail until those sweeps land.
    const areaItems = simplified
        ? {
            ...allAreaItems,
            content: (allAreaItems.content ?? []).filter(item =>
                !item.path.includes('/products')
                && !item.path.includes('/inventory')
                && !item.path.includes('/orders')
                && !item.path.includes('/invoices')),
        }
        : allAreaItems;
    // DECISION: derive currentPath from the view literal — the SSR-rendered
    // page already knows its own URL via the `view` prop; no need to read
    // `window.location` (and SSR-safe).
    const currentPath = `/admin/${view}`.replace(/\/(app|settings|languages|modules-preview)$/, m => {
        // Legacy aliases — not used by AreaNav anyway, but keep the path
        // sensible.
        return m;
    });

    /**
     * Pick which area's rail (if any) should render based on the active view.
     * The five AREA_* prefixes get their rail; the legacy views render bare.
     */
    const activeArea: keyof typeof areaItems | null =
        // admin-information-architecture re-pivot — 5 task-driven buckets.
        isInArea(view, 'settings') ? 'settings'
        : isInArea(view, 'analytics') ? 'analytics'
        : isInArea(view, 'content') ? 'content'
        : isInArea(view, 'system') ? 'system'
        : isInArea(view, 'build') ? 'build'
        // First-ship 6-bucket legacy aliases — kept while the 301 shim
        // is live so a yesterday-bookmark to `/admin/site/footer` etc.
        // still renders the right rail.
        : isInArea(view, 'site') ? 'site'
        : isInArea(view, 'commerce') ? 'commerce'
        : isInArea(view, 'people') ? 'people'
        // Pre-IA-jump legacy aliases.
        : isInArea(view, 'client-config') ? 'client-config'
        : isInArea(view, 'seo') ? 'seo'
        : isInArea(view, 'release') ? 'release'
        : null;

    /**
     * Map the view literal to the component to render in the main pane.
     *
     * Class Loader L4 — first consults the AdminUILoader registry; if
     * the view matches a registered pane, render through the loader's
     * descriptor. Falls back to the legacy switch for non-migrated
     * panes. As more features ship `*AdminUILoader.ts` the switch
     * shrinks; eventually it disappears.
     */
    const renderPane = (): ReactNode => {
        const fromRegistry = findAdminPaneById(view);
        if (fromRegistry) {
            // Mode-aware resolution (admin-ui-modes 2026-05-02): pick
            // `modes.simplified` when both the user is in simplified
            // mode AND the pane has a simplified variant; otherwise
            // fall back to `modes.advanced` (always defined). The shell
            // never branches on mode itself — descriptors carry the choice.
            const Pane = (adminMode === 'simplified' && fromRegistry.modes.simplified)
                ? fromRegistry.modes.simplified
                : fromRegistry.modes.advanced;
            // Pane may be a `React.lazy()` import — wrap in Suspense so
            // the chunk streams in on first render. Fallback is a small
            // Spin; the swap is short-lived.
            return (
                <Suspense fallback={<div style={{padding: 24, textAlign: 'center'}}><Spin/></div>}>
                    <Pane/>
                </Suspense>
            );
        }
        switch (view) {
            // Legacy / utility views
            case 'app':
            case 'build':
                return <AdminApp t={tAdmin as TFunction<"translation", undefined>} tApp={tApp} session={session}/>;
            case 'settings':
                return <AdminSettings/>;
            case 'languages':
                return (
                    <AdminSettingsLanguages
                        translationManager={new TranslationManager()}
                        i18n={i18nCommon}
                        tAdmin={tCommon}
                    />
                );
            case 'modules-preview':
            case 'build/modules-preview':
                // admin-module-composed: `ModulesPreview` is now the
                // `AdminLoader` bridge — it resolves `t` / `tApp` itself and
                // composes `AdminPreviewModule`. The registered
                // `ModulesPreviewAdminUILoader` dispatches the same pane via
                // `AdminPageDispatch`; this legacy case stays as a fallback.
                return <ModulesPreview/>;

            // Area landings — render nothing in the pane; AreaNav covers it.
            case 'client-config':
            case 'content':
            case 'release':
            case 'system':
                return null;
            case 'seo':
                // SEO has no sub-pages — render the SEO component directly.
                return <AdminSettingsSEO/>;

            // System sub-pages — `system/features` is the only pane that
            // hasn't been migrated to AdminUILoader yet (its FeatureFlagsPanel
            // hosts the restart banner + special grid). All other panes are
            // dispatched through the registry above (Class Loader L4).
            case 'system/features':   return <FeatureFlagsPanel/>;
        }
    };

    return (
        // The kbar `<CommandPalette>` provider wraps the entire admin
        // chrome — top-bar trigger + every dispatched pane — so ⌘K and the
        // `CommandPaletteTrigger` button work from any admin route, not
        // just the build view. (`AdminApp` no longer mounts its own.)
        <CommandPalette lang={lang}>
            <Head>
                {/* PWA install — admin pages get their own manifest. iOS Safari +
                    Android Chrome show "Add to Home Screen" → standalone mode.
                    Public site keeps `public/manifest.json` for the storefront
                    PWA install. */}
                <link rel="manifest" href="/admin/manifest.json"/>
                <meta name="apple-mobile-web-app-capable" content="yes"/>
                <meta name="apple-mobile-web-app-title" content="CMS Admin"/>
                <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
                <meta name="theme-color" content="#c65a2a"/>
                {/* iOS bottom safe-area + viewport-fit=cover so the notch +
                    bottom bar don't overlap the admin chrome on phones. */}
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
            </Head>
            <AdminTopBar
                view={view}
                session={session}
                simplified={simplified}
                tAdmin={tAdmin as TFunction<"translation", undefined>}
                lang={lang}
            />
            <main id="admin-main" aria-label={tAdmin("Admin workspace")} className="admin-main">
                {activeArea ? (
                    /* Desktop: rail + pane side-by-side. Mobile (≤768 px,
                       see AdminAntdOverrides.scss): rail flips above the
                       pane and renders horizontally — stacking vertically
                       was eating most of the viewport on phones. */
                    <div className="admin-area-layout">
                        <AreaNav
                            area={activeArea}
                            items={areaItems[activeArea]}
                            currentPath={currentPath}
                            isAdmin={isAdmin}
                        />
                        <div className="admin-area-pane">
                            {renderPane()}
                        </div>
                    </div>
                ) : (
                    renderPane()
                )}
            </main>
        </CommandPalette>
    )
}

const UserStatusBar = (props: {
    session: Session,
    view: AdminView,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>,
}) => (
    <I18nextProvider i18n={adminI18n}>
        <UserStatusBarInner {...props}/>
    </I18nextProvider>
);

export default UserStatusBar;
