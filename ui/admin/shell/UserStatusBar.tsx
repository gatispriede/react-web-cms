import {Button, Dropdown, Space} from "antd";
import {
    AppstoreOutlined,
    AuditOutlined,
    BgColorsOutlined,
    CloudUploadOutlined,
    DownloadOutlined,
    EyeOutlined,
    FileTextOutlined,
    GlobalOutlined,
    LayoutOutlined,
    LogoutOutlined,
    MailOutlined,
    PictureOutlined,
    SearchOutlined,
    ThunderboltOutlined,
    UserOutlined,
} from "@client/lib/icons";
import AdminApp from "./AdminApp";
import React, {useEffect, useState, ReactNode} from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";
import AdminSettingsLanguages from "@admin/features/Languages/Languages";
import TranslationManager from "./TranslationManager";
import {useTranslation} from "next-i18next/pages";
import Backend from "i18next-http-backend";
import {TFunction} from "i18next";
import {i18n} from "next-i18next/pages";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import CommandPalette, {useCommandPaletteHotkey} from "./CommandPalette";
import {I18nextProvider, useTranslation as useReactTranslation} from "react-i18next";
import adminI18n, {ADMIN_LOCALES, AdminLocale, setAdminLocale, detectStoredOrNavigatorLocale} from "@admin/i18n/adminI18n";
import UserApi from "@services/api/client/UserApi";
import ModulesPreview from "@client/lib/preview/ModulesPreview";
import AreaNav, {AreaNavItem} from "./AreaNav";
import AdminSettingsTheme from "@admin/features/Themes/Theme";
import AdminSettingsLogo from "@admin/features/Logo/LogoSettings";
import AdminSettingsLayout from "@admin/features/Navigation/Layout";
import AdminSettingsPosts from "@admin/features/Posts/Posts";
import AdminSettingsFooter from "@admin/features/Footer/Footer";
import AdminSettingsProducts from "@admin/features/Products/Products";
import AdminSettingsInventory from "@admin/features/Inventory/Inventory";
import AdminOrders from "@admin/features/Orders/Orders";
import AdminSettingsSEO from "@admin/features/Seo/SEO";
import AdminSettingsPublishing from "@admin/features/Publishing/Publishing";
import BundleSettings from "@admin/features/Bundle/Bundle";
import AuditTab from "@admin/features/Audit/AuditTab";
import AdminSettingsUsers from "@admin/features/Users/Users";
import McpTokensPanel from "@admin/features/Mcp/McpTokensPanel";
import AdminSettingsInquiries from "@admin/features/Inquiries/Inquiries";
import {UserRole} from "@interfaces/IUser";

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
    | 'release'
    | 'release/publishing'
    | 'release/bundle'
    | 'release/audit'
    | 'system'
    | 'system/users'
    | 'system/mcp'
    | 'system/inquiries';

const isInArea = (view: AdminView, area: string) =>
    view === area || view.startsWith(area + '/');

/**
 * Per-area sub-page rails. Each entry is the URL list rendered as the
 * left-hand `<AreaNav/>` on the area's pages. Item order is the visible
 * order; `adminOnly` items disappear for editor/viewer sessions.
 */
const buildAreaItems = (
    tAdmin: TFunction<"translation", undefined>,
): Record<string, AreaNavItem[]> => ({
    build: [
        {path: '/admin/build', label: tAdmin('Pages'), icon: <LayoutOutlined/>, testidSuffix: 'pages'},
        {path: '/admin/build/modules-preview', label: tAdmin('Style matrix'), icon: <AppstoreOutlined/>, testidSuffix: 'modules-preview'},
    ],
    'client-config': [
        {path: '/admin/client-config/themes', label: tAdmin('Theme'), icon: <BgColorsOutlined/>, testidSuffix: 'themes'},
        {path: '/admin/client-config/logo', label: tAdmin('Logo'), icon: <PictureOutlined/>, testidSuffix: 'logo'},
        {path: '/admin/client-config/site-layout', label: tAdmin('Layout'), icon: <AppstoreOutlined/>, testidSuffix: 'layout'},
    ],
    content: [
        {path: '/admin/content/translations', label: tAdmin('Translations'), icon: <GlobalOutlined/>, testidSuffix: 'translations'},
        {path: '/admin/content/posts', label: tAdmin('Posts'), icon: <FileTextOutlined/>, testidSuffix: 'posts'},
        {path: '/admin/content/footer', label: tAdmin('Footer'), icon: <FileTextOutlined/>, testidSuffix: 'footer'},
        {path: '/admin/content/products', label: tAdmin('Products'), icon: <AppstoreOutlined/>, testidSuffix: 'products'},
        {path: '/admin/content/inventory', label: tAdmin('Inventory'), icon: <CloudUploadOutlined/>, testidSuffix: 'inventory', adminOnly: true},
        {path: '/admin/content/orders', label: tAdmin('Orders'), icon: <AppstoreOutlined/>, testidSuffix: 'orders'},
    ],
    release: [
        {path: '/admin/release/publishing', label: tAdmin('Publishing'), icon: <CloudUploadOutlined/>, testidSuffix: 'publishing'},
        {path: '/admin/release/bundle', label: tAdmin('Bundle'), icon: <DownloadOutlined/>, testidSuffix: 'bundle'},
        {path: '/admin/release/audit', label: tAdmin('Audit'), icon: <AuditOutlined/>, testidSuffix: 'audit'},
    ],
    system: [
        {path: '/admin/system/users', label: tAdmin('Users'), icon: <UserOutlined/>, testidSuffix: 'users'},
        {path: '/admin/system/mcp', label: tAdmin('MCP'), icon: <AuditOutlined/>, testidSuffix: 'mcp'},
        {path: '/admin/system/inquiries', label: tAdmin('Inquiries'), icon: <MailOutlined/>, testidSuffix: 'inquiries'},
    ],
});

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
    const [blogEnabled, setBlogEnabled] = useState(true);
    const [paletteOpen, setPaletteOpen] = useState(false);
    useCommandPaletteHotkey(setPaletteOpen);
    const {t: tCommon, i18n: i18nCommon} = useTranslation('common');
    i18nCommon.use(Backend);
    useEffect(() => {
        void new SiteFlagsApi().get().then(f => setBlogEnabled(f.blogEnabled !== false));
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
    const currentAdminLocale = (adminI.language as AdminLocale) || 'en';
    const adminLocaleLabel = currentAdminLocale.toUpperCase();

    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;
    const isAdmin = role === 'admin';

    const areaItems = buildAreaItems(tAdmin as TFunction<"translation", undefined>);
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
        : isInArea(view, 'release') ? 'release'
        : isInArea(view, 'system') ? 'system'
        : null;

    /**
     * Map the view literal to the component to render in the main pane.
     * This is the single dispatch point — each sub-page is one component.
     */
    const renderPane = (): ReactNode => {
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

            // Client config sub-pages
            case 'client-config/themes':  return <AdminSettingsTheme/>;
            case 'client-config/logo':    return <AdminSettingsLogo/>;
            case 'client-config/site-layout':  return <AdminSettingsLayout/>;

            // Content sub-pages
            case 'content/translations':
                return (
                    <AdminSettingsLanguages
                        translationManager={new TranslationManager()}
                        i18n={i18nCommon}
                        tAdmin={tCommon}
                    />
                );
            case 'content/posts':      return <AdminSettingsPosts/>;
            case 'content/footer':     return <AdminSettingsFooter/>;
            case 'content/products':   return <AdminSettingsProducts/>;
            case 'content/inventory':  return <AdminSettingsInventory/>;
            case 'content/orders':     return <AdminOrders/>;

            // Release sub-pages
            case 'release/publishing': return <AdminSettingsPublishing/>;
            case 'release/bundle':     return <BundleSettings t={tAdmin as TFunction<"translation", undefined>}/>;
            case 'release/audit':      return <AuditTab/>;

            // System sub-pages
            case 'system/users':      return <AdminSettingsUsers/>;
            case 'system/mcp':        return <McpTokensPanel/>;
            case 'system/inquiries':  return <AdminSettingsInquiries/>;
        }
    };

    /**
     * Top-bar area button — six entries, each highlighted when its prefix
     * is the active area. `isInArea` covers both `/admin/release` (landing)
     * and `/admin/release/bundle` (sub-page).
     */
    const topBarButton = (
        areaSlug: string,
        href: string,
        icon: ReactNode,
        label: string,
    ) => (
        <Button
            data-testid={`nav-area-${areaSlug}-link`}
            type={isInArea(view, areaSlug) ? "primary" : "link"}
            href={href}
            icon={icon}
        >
            {label}
        </Button>
    );

    return (
        <>
            <a href="#admin-main" className="skip-to-content" suppressHydrationWarning>{tAdmin("Skip to content")}</a>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}/>
            <nav aria-label={tAdmin("Admin")} className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${tAdmin("User")}: ${session?.user?.name} `}</p>
                </div>
                {/* Six area buttons — Phase 2 of admin segregation. The legacy
                    seven-entry nav (App building / Site settings / Languages /
                    Style matrix / Preview / Blog / Command) has been replaced;
                    legacy URLs 302-redirect via next.config.js. */}
                {topBarButton('build', '/admin/build', <LayoutOutlined/>, tAdmin('Build'))}
                {topBarButton('client-config', '/admin/client-config', <BgColorsOutlined/>, tAdmin('Client config'))}
                {topBarButton('content', '/admin/content', <FileTextOutlined/>, tAdmin('Content'))}
                {topBarButton('seo', '/admin/seo', <SearchOutlined/>, tAdmin('SEO'))}
                {topBarButton('release', '/admin/release', <CloudUploadOutlined/>, tAdmin('Release'))}
                {topBarButton('system', '/admin/system', <UserOutlined/>, tAdmin('System'))}
                <Button type={"link"} icon={<EyeOutlined/>} onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                        window.open(`/${lang}`, '_blank', 'noopener,noreferrer');
                    }
                }}>{tAdmin("Preview")}</Button>
                {/* DECISION: the public-blog link moved into the Content
                    area's sub-nav as a "View live blog" affordance under
                    Posts (per user instruction "move blog under content"
                    — Phase 2 of admin segregation). The admin top-bar no
                    longer carries a Blog utility button; the public blog
                    is reachable via Preview → /lang/blog or the Command
                    palette's "Open blog" entry. */}
                <Button type={"link"} icon={<ThunderboltOutlined/>} onClick={() => setPaletteOpen(true)} title="Ctrl+K / ⌘K">
                    {tAdmin("Command")}
                </Button>
                <Dropdown
                    menu={{
                        selectedKeys: [currentAdminLocale],
                        items: ADMIN_LOCALES.map(({code, label}: {code: AdminLocale; label: string}) => ({
                            key: code, label: tAdmin(label),
                            onClick: () => {
                                setAdminLocale(code);
                                const userId = (session?.user as any)?.id;
                                const userEmail = session?.user?.email;
                                if (userId && userEmail) {
                                    void new UserApi().updateUser({
                                        id: userId,
                                        email: userEmail,
                                        preferredAdminLocale: code,
                                    });
                                }
                            },
                        })),
                    }}
                    placement="bottomRight"
                >
                    <Button type="link" title={tAdmin("Admin language")} aria-label={tAdmin("Admin language")}>
                        <Space size={4}>
                            <span style={{fontFamily: 'ui-monospace, monospace', fontWeight: 600}}>{adminLocaleLabel}</span>
                        </Space>
                    </Button>
                </Dropdown>
                <Button type={"link"} icon={<LogoutOutlined/>} href={'#'} onClick={() => signOut()}>{tAdmin("Sign out")}</Button>
            </nav>
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
