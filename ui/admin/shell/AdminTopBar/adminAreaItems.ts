import React from "react";
import {
    AppstoreOutlined,
    AuditOutlined,
    BgColorsOutlined,
    CloudUploadOutlined,
    DownloadOutlined,
    FileTextOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    LayoutOutlined,
    MailOutlined,
    PictureOutlined,
    SearchOutlined,
    SettingOutlined,
    ThunderboltOutlined,
    UserOutlined,
} from "@client/lib/icons";
import {TFunction} from "i18next";
import {AreaNavItem} from "../AreaNav";
// Local minimal AdminView shape to avoid circular import with UserStatusBar.
// `isInArea` only needs string-prefix logic, so a `string` constraint is
// enough; the canonical union lives in UserStatusBar.tsx.
type AdminView = string;

/**
 * `view` belongs to `area` when it equals the area slug or has it as a path
 * prefix (e.g. `release/bundle` is in `release`). Used by both the top-bar
 * area buttons (active highlight) and the shell (which area's rail to show).
 */
export const isInArea = (view: AdminView, area: string) =>
    view === area || view.startsWith(area + '/');

/**
 * Per-area sub-page rails. Each entry is the URL list rendered as the
 * left-hand `<AreaNav/>` on the area's pages. Item order is the visible
 * order; `adminOnly` items disappear for editor/viewer sessions.
 */
export const buildAreaItems = (
    tAdmin: TFunction<"translation", undefined>,
): Record<string, AreaNavItem[]> => ({
    build: [
        {path: '/admin/build', label: tAdmin('Pages'), icon: React.createElement(LayoutOutlined), testidSuffix: 'pages'},
        {path: '/admin/build/modules-preview', label: tAdmin('Style matrix'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'modules-preview'},
    ],
    'client-config': [
        {path: '/admin/client-config/themes', label: tAdmin('Theme'), icon: React.createElement(BgColorsOutlined), testidSuffix: 'themes'},
        {path: '/admin/client-config/logo', label: tAdmin('Logo'), icon: React.createElement(PictureOutlined), testidSuffix: 'logo'},
        {path: '/admin/client-config/site-layout', label: tAdmin('Layout'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'layout'},
    ],
    content: [
        {path: '/admin/content/translations', label: tAdmin('Translations'), icon: React.createElement(GlobalOutlined), testidSuffix: 'translations'},
        {path: '/admin/content/posts', label: tAdmin('Posts'), icon: React.createElement(FileTextOutlined), testidSuffix: 'posts'},
        {path: '/admin/content/footer', label: tAdmin('Footer'), icon: React.createElement(FileTextOutlined), testidSuffix: 'footer'},
        {path: '/admin/content/products', label: tAdmin('Products'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'products'},
        {path: '/admin/content/inventory', label: tAdmin('Inventory'), icon: React.createElement(CloudUploadOutlined), testidSuffix: 'inventory', adminOnly: true},
        {path: '/admin/content/orders', label: tAdmin('Orders'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'orders'},
    ],
    seo: [
        {path: '/admin/seo', label: tAdmin('SEO'), icon: React.createElement(SearchOutlined), testidSuffix: 'seo'},
        {path: '/admin/seo/analytics', label: tAdmin('Analytics'), icon: React.createElement(AuditOutlined), testidSuffix: 'analytics', adminOnly: true},
    ],
    release: [
        // Bundle (export / import) is the most-used release surface,
        // surface it first.
        {path: '/admin/release/bundle', label: tAdmin('Bundle'), icon: React.createElement(DownloadOutlined), testidSuffix: 'bundle'},
        {path: '/admin/release/publishing', label: tAdmin('Publishing'), icon: React.createElement(CloudUploadOutlined), testidSuffix: 'publishing'},
        {path: '/admin/release/audit', label: tAdmin('Audit'), icon: React.createElement(AuditOutlined), testidSuffix: 'audit'},
    ],
    system: [
        // User-facing operator concerns first — accounts, transactional
        // mail, customer inquiries — then platform-config, then the
        // power-user / observability surfaces.
        {path: '/admin/system/users', label: tAdmin('Users'), icon: React.createElement(UserOutlined), testidSuffix: 'users'},
        {path: '/admin/system/email', label: tAdmin('Email'), icon: React.createElement(MailOutlined), testidSuffix: 'email', adminOnly: true},
        {path: '/admin/system/inquiries', label: tAdmin('Inquiries'), icon: React.createElement(MailOutlined), testidSuffix: 'inquiries'},
        {path: '/admin/system/features', label: tAdmin('Feature flags'), icon: React.createElement(SettingOutlined), testidSuffix: 'features', adminOnly: true},
        // Power-user / observability — the rest below.
        {path: '/admin/system/mcp', label: tAdmin('MCP'), icon: React.createElement(AuditOutlined), testidSuffix: 'mcp'},
        {path: '/admin/system/analytics-filters', label: tAdmin('Analytics filters'), icon: React.createElement(SettingOutlined), testidSuffix: 'analytics-filters', adminOnly: true},
        {path: '/admin/system/agent', label: tAdmin('AI Agent'), icon: React.createElement(ThunderboltOutlined), testidSuffix: 'agent', adminOnly: true},
        {path: '/admin/system/errors', label: tAdmin('Errors'), icon: React.createElement(AuditOutlined), testidSuffix: 'errors', adminOnly: true},
        {path: '/admin/system/info', label: tAdmin('Diagnostics'), icon: React.createElement(InfoCircleOutlined), testidSuffix: 'info', adminOnly: true},
    ],
});
