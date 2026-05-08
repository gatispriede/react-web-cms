import AdminApp from "./AdminApp";
import Head from "next/head";
import React, {useEffect, useState, ReactNode, Suspense} from "react";
import {Spin} from "antd";
import {Session} from "next-auth";
import AdminSettings from "./AdminSettings";
import AdminSettingsLanguages from "@admin/features/Languages/Languages";
import TranslationManager from "./TranslationManager";
import {useTranslation} from "next-i18next/pages";
import Backend from "i18next-http-backend";
import {TFunction} from "i18next";
import {i18n} from "next-i18next/pages";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import {useCommandPaletteHotkey} from "./CommandPalette";
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
    | 'client-config'
    | 'client-config/themes'
    | 'client-config/logo'
    | 'client-config/site-layout'
    | 'content'
    | 'content/translations'
    | 'content/posts'
    | 'content/footer'
    | 'content/products'
    | 'content/inventory'
    | 'content/orders'
    | 'seo'
    | 'seo/analytics'
    | 'release'
    | 'release/publishing'
    | 'release/bundle'
    | 'release/audit'
    | 'system'
    | 'system/users'
    | 'system/mcp'
    | 'system/analytics-filters'
    | 'system/inquiries'
    | 'system/features'
    | 'system/agent'
    | 'system/info'
    | 'system/email'
    | 'system/errors';

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
    let lang = i18n?.resolvedLanguage ?? (i18n?.language !== 'default' ? i18n?.language : null) ?? 'lv'
    const [, setBlogEnabled] = useState(true);
    const {mode: adminMode} = useAdminMode();
    const [paletteOpen, setPaletteOpen] = useState(false);
    useCommandPaletteHotkey(setPaletteOpen);
    const {t: tCommon, i18n: i18nCommon} = useTranslation('common');
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
    // Simplified-mode authors don't manage commerce — products / inventory
    // / orders are advanced-only. The routes themselves still resolve if
    // bookmarked, but the area-nav drops them.
    const areaItems = simplified
        ? {
            ...allAreaItems,
            content: allAreaItems.content.filter(it => !['products', 'inventory', 'orders'].includes(it.testidSuffix ?? '')),
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
        isInArea(view, 'build') ? 'build'
        : isInArea(view, 'client-config') ? 'client-config'
        : isInArea(view, 'content') ? 'content'
        : isInArea(view, 'seo') ? 'seo'
        : isInArea(view, 'release') ? 'release'
        : isInArea(view, 'system') ? 'system'
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
                return <ModulesPreview t={tAdmin as TFunction<"translation", undefined>} tApp={tApp}/>;

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
        <>
            <Head>
                {/* PWA install — admin pages get their own manifest. iOS Safari +
                    Android Chrome show "Add to Home Screen" → standalone mode.
                    Public site keeps `public/manifest.json` for the storefront
                    PWA install. */}
                <link rel="manifest" href="/api/admin/manifest.json"/>
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
                paletteOpen={paletteOpen}
                setPaletteOpen={setPaletteOpen}
            />
            <main id="admin-main" aria-label={tAdmin("Admin workspace")}>
                {activeArea ? (
                    <div style={{display: 'flex', alignItems: 'flex-start', gap: 16}}>
                        <AreaNav
                            area={activeArea}
                            items={areaItems[activeArea]}
                            currentPath={currentPath}
                            isAdmin={isAdmin}
                        />
                        <div style={{flex: 1, minWidth: 0}}>
                            {renderPane()}
                        </div>
                    </div>
                ) : (
                    renderPane()
                )}
            </main>
        </>
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
