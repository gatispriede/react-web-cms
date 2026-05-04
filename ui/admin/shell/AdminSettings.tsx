import {Tabs, TabsProps} from "antd";
import {
    AppstoreOutlined,
    AuditOutlined,
    BgColorsOutlined,
    CloudUploadOutlined,
    DownloadOutlined,
    FileTextOutlined,
    MailOutlined,
    PictureOutlined,
    SearchOutlined,
    UserOutlined,
} from "@client/lib/icons";
import AdminSettingsUsers from "@admin/features/Users/Users";
import AdminSettingsTheme from "@admin/features/Themes/Theme";
import BundleSettings from "@admin/features/Bundle/Bundle";
import AdminSettingsPublishing from "@admin/features/Publishing/Publishing";
import AdminSettingsPosts from "@admin/features/Posts/Posts";
import AdminSettingsProducts from "@admin/features/Products/Products";
import AdminSettingsInventory from "@admin/features/Inventory/Inventory";
import McpTokensPanel from "@admin/features/Mcp/McpTokensPanel";
import AdminOrders from "@admin/features/Orders/Orders";
import AdminSettingsFooter from "@admin/features/Footer/Footer";
import AdminSettingsSEO from "@admin/features/Seo/SEO";
import AdminSettingsLogo from "@admin/features/Logo/LogoSettings";
import AdminSettingsLayout from "@admin/features/Navigation/Layout";
import AdminSettingsInquiries from "@admin/features/Inquiries/Inquiries";
import AuditTab from "@admin/features/Audit/AuditTab";
import {useTranslation} from "react-i18next";
import {useSession} from "next-auth/react";
import {TFunction} from "i18next";
import {UserRole} from "@interfaces/IUser";

/**
 * Phase 1 of admin segregation (docs/features/platform/admin-segregation.md).
 *
 * `area` filters the tab set down to the subset that belongs to a given
 * concern area. `undefined` keeps the current behavior (all tabs) so the
 * legacy `/admin/settings` route is unaffected. The map below is the
 * Phase-1 contract — Phase 2 will move per-area sub-routes here.
 *
 * Each entry is the set of tab `key`s in `getItems` that belongs to the area.
 */
export type SettingsArea =
    | 'client-config'
    | 'content'
    | 'seo'
    | 'release'
    | 'system';

const AREA_TAB_KEYS: Record<SettingsArea, ReadonlySet<string>> = {
    'client-config': new Set(['3', '9', '10']),                  // Theme, Logo, Layout
    'content':       new Set(['6', '13', '14', '15', '7']),      // Posts, Products, Inventory, Orders, Footer
    'seo':           new Set(['8']),                              // SEO
    'release':       new Set(['5', '4', '11']),                   // Publishing, Bundle, Audit
    'system':        new Set(['1', '16', '12']),                  // Users, MCP, Inquiries
};

const getItems = (
    t: TFunction<"translation", undefined>,
    role: UserRole,
): TabsProps['items'] => {
    const items: NonNullable<TabsProps['items']> = [];
    // Tab `icon` is rendered by AntD to the left of `label` automatically.
    // Icons are presentational — `label` stays the accessible name.
    if (role === 'admin') {
        items.push({
            key: '1',
            icon: <UserOutlined/>,
            label: <span data-testid="admin-settings-tab-users">{t('Users')}</span>,
            children: <AdminSettingsUsers/>,
        });
    }
    items.push({
        key: '3',
        icon: <BgColorsOutlined/>,
        label: <span data-testid="admin-settings-tab-theme">{t('Theme')}</span>,
        children: <AdminSettingsTheme/>,
    });
    items.push({
        key: '9',
        icon: <PictureOutlined/>,
        label: <span data-testid="admin-settings-tab-logo">{t('Logo')}</span>,
        children: <AdminSettingsLogo/>,
    });
    items.push({
        key: '10',
        icon: <AppstoreOutlined/>,
        label: <span data-testid="admin-settings-tab-layout">{t('Layout')}</span>,
        children: <AdminSettingsLayout/>,
    });
    items.push({
        key: '8',
        icon: <SearchOutlined/>,
        label: <span data-testid="admin-settings-tab-seo">{t('SEO')}</span>,
        children: <AdminSettingsSEO/>,
    });
    items.push({
        key: '6',
        icon: <FileTextOutlined/>,
        label: <span data-testid="admin-settings-tab-posts">{t('Posts')}</span>,
        children: <AdminSettingsPosts/>,
    });
    items.push({
        key: '13',
        icon: <AppstoreOutlined/>,
        label: t('Products'),
        children: <AdminSettingsProducts/>,
    });
    if (role === 'admin') {
        items.push({
            key: '14',
            icon: <CloudUploadOutlined/>,
            label: t('Inventory'),
            children: <AdminSettingsInventory/>,
        });
        items.push({
            key: '16',
            icon: <AuditOutlined/>,
            label: t('MCP'),
            children: <McpTokensPanel/>,
        });
    }
    // Orders pane is editor-grade — warehouse staff need access to drive
    // the queue without admin elevation. Refunds inside the pane gate
    // themselves to admin.
    items.push({
        key: '15',
        icon: <AppstoreOutlined/>,
        label: t('Orders'),
        children: <AdminOrders/>,
    });
    // Footer tab — no dedicated "align-bottom" in lucide; a text document icon
    // reads adjacent to SEO / Posts and ties "Footer" to editable copy.
    items.push({
        key: '7',
        icon: <FileTextOutlined/>,
        label: <span data-testid="admin-settings-tab-footer">{t('Footer')}</span>,
        children: <AdminSettingsFooter/>,
    });
    if (role === 'admin') {
        items.push({
            key: '12',
            icon: <MailOutlined/>,
            label: t('Inquiries'),
            children: <AdminSettingsInquiries/>,
        });
        items.push({
            key: '4',
            icon: <DownloadOutlined/>,
            // Wrap label in a span so the testid attaches to a real DOM
            // node — AntD Tabs don't forward arbitrary HTML attrs on
            // items[i] directly, but they do render whatever JSX you
            // pass as `label`.
            label: <span data-testid="admin-settings-tab-bundle">{t('Bundle')}</span>,
            children: <BundleSettings t={t}/>,
        });
        items.push({
            key: '5',
            icon: <CloudUploadOutlined/>,
            label: t('Publishing'),
            children: <AdminSettingsPublishing/>,
        });
        items.push({
            key: '11',
            icon: <AuditOutlined/>,
            label: t('Audit'),
            children: <AuditTab/>,
        });
    }
    return items;
};

const AdminSettings = ({area}: {area?: SettingsArea} = {}) => {
    const {t} = useTranslation()

    const {data: session} = useSession();
    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;

    const allItems = getItems(t, role) ?? [];
    const items = area
        ? allItems.filter(it => AREA_TAB_KEYS[area].has(String(it.key)))
        : allItems;
    // DECISION: pick first surviving tab key as the default — different areas
    // start with different first tabs, and the legacy default ('1' for admin,
    // '3' otherwise) doesn't necessarily exist in a filtered view.
    const defaultKey = items[0]?.key
        ?? (role === 'admin' ? '1' : '3');

    return (
        <Tabs defaultActiveKey={defaultKey as string} items={items}/>
    )
}
export default AdminSettings