import React, {ReactNode} from "react";
import {Button} from "antd";
import {
    BgColorsOutlined,
    CloudUploadOutlined,
    FileTextOutlined,
    LayoutOutlined,
    SearchOutlined,
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
 * Six area buttons — Phase 2 of admin segregation. The legacy
 * seven-entry nav (App building / Site settings / Languages /
 * Style matrix / Preview / Blog / Command) has been replaced;
 * legacy URLs 302-redirect via next.config.js.
 *
 * SEO / Release / System are advanced-only — simplified-mode
 * users get a stripped top bar focused on authoring. The
 * routes themselves still resolve directly if bookmarked,
 * but nav surfaces hide them. Per-pane simplified variants
 * are tracked separately (admin-ui-modes per-feature
 * simplified components item).
 */
const AdminAreaButtons = ({view, simplified, tAdmin}: {
    view: AdminView,
    simplified: boolean,
    tAdmin: TFunction<"translation", undefined>,
}) => (
    <>
        {topBarButton(view, 'build', '/admin/build', <LayoutOutlined/>, tAdmin('Build'))}
        {topBarButton(view, 'client-config', '/admin/client-config', <BgColorsOutlined/>, tAdmin('Client config'))}
        {topBarButton(view, 'content', '/admin/content', <FileTextOutlined/>, tAdmin('Content'))}
        {!simplified && topBarButton(view, 'seo', '/admin/seo', <SearchOutlined/>, tAdmin('SEO'))}
        {!simplified && topBarButton(view, 'release', '/admin/release', <CloudUploadOutlined/>, tAdmin('Release'))}
        {!simplified && topBarButton(view, 'system', '/admin/system', <UserOutlined/>, tAdmin('System'))}
    </>
);

export default AdminAreaButtons;
