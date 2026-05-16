import React, {ReactNode} from "react";
import {Button} from "antd";
import {
    AppstoreOutlined,
    AuditOutlined,
    BgColorsOutlined,
    FileTextOutlined,
    SettingOutlined,
    UserOutlined,
} from "@client/lib/icons";
import {TFunction} from "i18next";
import {isInArea} from "./adminAreaItems";
import type {AdminView} from "../UserStatusBar";

/**
 * Top-bar area button — six entries, each highlighted when its prefix
 * is the active area. `isInArea` covers both `/admin/release` (landing)
 * and `/admin/release/bundle` (sub-page).
 */
const topBarButton = (
    view: AdminView,
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

/**
 * Six area buttons — admin-information-architecture jump (2026-05-16).
 * Replaces the legacy six-entry top bar (Build / Client config / Content
 * / SEO / Release / System) with the new operator-mental-model taxonomy:
 *
 *   Site — global site config (theme, logo, footer, languages, SEO defaults)
 *   Content — pages, posts, translations, releases
 *   Commerce — products, orders, invoices, inventory
 *   People — admin users, customers, permissions, inquiries
 *   Analytics — traffic, SEO health, audit log
 *   System — dev/power-user knobs (advanced-only)
 *
 * Legacy URLs 301-redirect to new homes via next.config.js. System +
 * Analytics are advanced-only — simplified-mode authors don't need
 * either; their top bar drops to four buttons.
 */
const AdminAreaButtons = ({view, simplified, tAdmin}: {
    view: AdminView,
    simplified: boolean,
    tAdmin: TFunction<"translation", undefined>,
}) => (
    <>
        {topBarButton(view, 'site', '/admin/site', <BgColorsOutlined/>, tAdmin('Site'))}
        {topBarButton(view, 'content', '/admin/content', <FileTextOutlined/>, tAdmin('Content'))}
        {topBarButton(view, 'commerce', '/admin/commerce', <AppstoreOutlined/>, tAdmin('Commerce'))}
        {topBarButton(view, 'people', '/admin/people', <UserOutlined/>, tAdmin('People'))}
        {!simplified && topBarButton(view, 'analytics', '/admin/analytics', <AuditOutlined/>, tAdmin('Analytics'))}
        {!simplified && topBarButton(view, 'system', '/admin/system', <SettingOutlined/>, tAdmin('System'))}
    </>
);

export default AdminAreaButtons;
