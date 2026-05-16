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
 *
 * admin-information-architecture re-pivot (2026-05-16, same day as the
 * first ship): the 6-bucket Site/Content/Commerce/People/Analytics/System
 * taxonomy collapses to 5 task-driven buckets: Build / Content / Settings
 * / Analytics / System. Settings absorbs every configuration surface
 * hierarchically (chrome / theme / seo / languages / features/* /
 * access / account).
 *
 * Only the demonstrator panes whose loaders + App Router directories
 * actually moved point at the NEW URLs. Other panes in each bucket still
 * link to their LEGACY URLs (the 301 shim plus the per-area sweep
 * follow-ups will move them).
 *
 * Legacy rails (build / client-config / seo / release / site / commerce
 * / people) are kept so an operator landing on a still-legacy URL still
 * sees the right rail; they retire as each per-area sweep lands.
 */
export const buildAreaItems = (
    tAdmin: TFunction<"translation", undefined>,
): Record<string, AreaNavItem[]> => ({
    // ── New top-level buckets (5) ────────────────────────────────────
    // Build — single page, the AdminApp page editor. No sub-rail items
    // beyond the editor itself; modules-preview is a dev tool under System.
    build: [
        {path: '/admin/build', label: tAdmin('Pages'), icon: React.createElement(LayoutOutlined), testidSuffix: 'pages'},
    ],
    // Content — author the content the site shows. Demonstrator
    // SystemPages + Invoices on new URLs; others still legacy.
    content: [
        {path: '/admin/content/system-pages', label: tAdmin('System pages'), icon: React.createElement(FileTextOutlined), testidSuffix: 'system-pages', adminOnly: true},
        {path: '/admin/content/posts', label: tAdmin('Posts'), icon: React.createElement(FileTextOutlined), testidSuffix: 'posts'},
        {path: '/admin/content/products', label: tAdmin('Products'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'products'},
        {path: '/admin/content/inventory', label: tAdmin('Inventory'), icon: React.createElement(CloudUploadOutlined), testidSuffix: 'inventory', adminOnly: true},
        {path: '/admin/content/orders', label: tAdmin('Orders'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'orders'},
        {path: '/admin/content/invoices', label: tAdmin('Invoices'), icon: React.createElement(FileTextOutlined), testidSuffix: 'invoices'},
        {path: '/admin/system/inquiries', label: tAdmin('Inquiries'), icon: React.createElement(MailOutlined), testidSuffix: 'inquiries'},
        {path: '/admin/content/translations', label: tAdmin('Translations'), icon: React.createElement(GlobalOutlined), testidSuffix: 'translations'},
        {path: '/admin/release/publishing', label: tAdmin('Publishing'), icon: React.createElement(CloudUploadOutlined), testidSuffix: 'publishing', adminOnly: true},
    ],
    // Settings — hierarchical configuration surface. Demonstrator
    // Footer at `/admin/settings/chrome/footer` + Users at
    // `/admin/settings/access/users`; everything else still legacy.
    settings: [
        {path: '/admin/settings/chrome/footer', label: tAdmin('Chrome'), icon: React.createElement(LayoutOutlined), testidSuffix: 'chrome'},
        {path: '/admin/client-config/themes', label: tAdmin('Theme'), icon: React.createElement(BgColorsOutlined), testidSuffix: 'theme'},
        {path: '/admin/languages', label: tAdmin('Languages'), icon: React.createElement(GlobalOutlined), testidSuffix: 'languages'},
        {path: '/admin/seo', label: tAdmin('SEO defaults'), icon: React.createElement(SearchOutlined), testidSuffix: 'seo'},
        {path: '/admin/system/email', label: tAdmin('Email'), icon: React.createElement(MailOutlined), testidSuffix: 'email', adminOnly: true},
        {path: '/admin/system/compliance', label: tAdmin('Compliance'), icon: React.createElement(InfoCircleOutlined), testidSuffix: 'compliance', adminOnly: true},
        {path: '/admin/system/redirects', label: tAdmin('Redirects'), icon: React.createElement(GlobalOutlined), testidSuffix: 'redirects', adminOnly: true},
        {path: '/admin/settings/access/users', label: tAdmin('Users'), icon: React.createElement(UserOutlined), testidSuffix: 'users', adminOnly: true},
        {path: '/admin/system/permissions', label: tAdmin('Permissions'), icon: React.createElement(UserOutlined), testidSuffix: 'permissions', adminOnly: true},
    ],
    // Analytics rail — Analytics dashboard (the AnalyticsPanel
    // demonstrator) lives at `/admin/analytics`; others still legacy.
    analytics: [
        {path: '/admin/analytics', label: tAdmin('Overview'), icon: React.createElement(AuditOutlined), testidSuffix: 'overview', adminOnly: true},
        {path: '/admin/release/audit', label: tAdmin('Audit log'), icon: React.createElement(AuditOutlined), testidSuffix: 'audit-log', adminOnly: true},
        {path: '/admin/system/analytics-filters', label: tAdmin('Filters'), icon: React.createElement(SettingOutlined), testidSuffix: 'filters', adminOnly: true},
    ],
    // System rail — power-user / dev tools. Demonstrator Diagnostics
    // on its new URL; others still legacy.
    system: [
        {path: '/admin/system/diagnostics', label: tAdmin('Diagnostics'), icon: React.createElement(InfoCircleOutlined), testidSuffix: 'diagnostics', adminOnly: true},
        {path: '/admin/system/mcp', label: tAdmin('MCP'), icon: React.createElement(AuditOutlined), testidSuffix: 'mcp', adminOnly: true},
        {path: '/admin/system/features', label: tAdmin('Feature flags'), icon: React.createElement(SettingOutlined), testidSuffix: 'features', adminOnly: true},
        {path: '/admin/system/agent', label: tAdmin('AI Agent'), icon: React.createElement(ThunderboltOutlined), testidSuffix: 'agent', adminOnly: true},
        {path: '/admin/system/errors', label: tAdmin('Errors'), icon: React.createElement(AuditOutlined), testidSuffix: 'errors', adminOnly: true},
        {path: '/admin/release/bundle', label: tAdmin('Bundle'), icon: React.createElement(DownloadOutlined), testidSuffix: 'bundle', adminOnly: true},
    ],

    // ── Legacy rails (kept for 301-shim period) ──────────────────────
    // An operator landing on a still-legacy URL through an old bookmark
    // sees its rail. After each bucket's sweep lands and its old URLs
    // 301 to the new homes, the corresponding legacy rail entry is
    // dropped here.
    //
    // The first-ship 6-bucket rails (site / commerce / people) are
    // kept too — anyone landing via a yesterday-shipped 6-bucket URL
    // (now also 301-redirected) lands cleanly while the shim is live.
    'client-config': [
        {path: '/admin/client-config/themes', label: tAdmin('Theme'), icon: React.createElement(BgColorsOutlined), testidSuffix: 'themes'},
        {path: '/admin/client-config/logo', label: tAdmin('Logo'), icon: React.createElement(PictureOutlined), testidSuffix: 'logo'},
        {path: '/admin/client-config/site-layout', label: tAdmin('Layout'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'layout'},
    ],
    seo: [
        {path: '/admin/seo', label: tAdmin('SEO'), icon: React.createElement(SearchOutlined), testidSuffix: 'seo'},
        {path: '/admin/analytics', label: tAdmin('Analytics'), icon: React.createElement(AuditOutlined), testidSuffix: 'analytics', adminOnly: true},
    ],
    release: [
        {path: '/admin/release/bundle', label: tAdmin('Bundle'), icon: React.createElement(DownloadOutlined), testidSuffix: 'bundle'},
        {path: '/admin/release/publishing', label: tAdmin('Publishing'), icon: React.createElement(CloudUploadOutlined), testidSuffix: 'publishing'},
        {path: '/admin/release/audit', label: tAdmin('Audit'), icon: React.createElement(AuditOutlined), testidSuffix: 'audit'},
    ],
    // First-ship 6-bucket rails — kept for 2 months while operators
    // refresh their bookmarks past the same-day re-pivot.
    site: [
        {path: '/admin/settings/chrome/footer', label: tAdmin('Footer'), icon: React.createElement(FileTextOutlined), testidSuffix: 'footer'},
        {path: '/admin/client-config/themes', label: tAdmin('Theme'), icon: React.createElement(BgColorsOutlined), testidSuffix: 'themes'},
        {path: '/admin/client-config/logo', label: tAdmin('Logo'), icon: React.createElement(PictureOutlined), testidSuffix: 'logo'},
        {path: '/admin/seo', label: tAdmin('SEO defaults'), icon: React.createElement(SearchOutlined), testidSuffix: 'seo'},
    ],
    commerce: [
        {path: '/admin/content/invoices', label: tAdmin('Invoices'), icon: React.createElement(FileTextOutlined), testidSuffix: 'invoices'},
        {path: '/admin/content/products', label: tAdmin('Products'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'products'},
        {path: '/admin/content/orders', label: tAdmin('Orders'), icon: React.createElement(AppstoreOutlined), testidSuffix: 'orders'},
    ],
    people: [
        {path: '/admin/settings/access/users', label: tAdmin('Users'), icon: React.createElement(UserOutlined), testidSuffix: 'users'},
        {path: '/admin/system/inquiries', label: tAdmin('Inquiries'), icon: React.createElement(MailOutlined), testidSuffix: 'inquiries'},
    ],
});
