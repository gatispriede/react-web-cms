import React, {ReactNode} from "react";
import {Button, Tooltip} from "antd";
import {
    AuditOutlined,
    FileTextOutlined,
    LayoutOutlined,
    SettingOutlined,
    ThunderboltOutlined,
} from "@client/lib/icons";
import {TFunction} from "i18next";
import {PARENT_BUCKET_OVERRIDES, isInArea} from "./adminAreaItems";
import type {AdminView} from "../UserStatusBar";

/**
 * Top-bar area button — five entries, each highlighted when its prefix
 * is the active area. `isInArea` covers both `/admin/settings` (landing)
 * and `/admin/settings/chrome/footer` (sub-page).
 */
const topBarButton = (
    view: AdminView,
    areaSlug: string,
    href: string,
    icon: ReactNode,
    label: string,
    tooltip: string,
) => (
    // Tooltip wraps each top-bar area button with a one-line plain-English
    // description. Non-technical operators (the audience for the admin-IA
    // sweep) need a hint at the labels — "Build" / "Content" / "Advanced"
    // are short by design; the tooltip carries the meaning. `mouseEnterDelay`
    // matches the rail's 400 ms so hovering across the top bar doesn't
    // flicker tooltips on every button.
    <Tooltip key={areaSlug} title={tooltip} placement="bottom" mouseEnterDelay={0.4}>
        <Button
            data-testid={`nav-area-${areaSlug}-link`}
            type={(PARENT_BUCKET_OVERRIDES[view] === areaSlug || isInArea(view, areaSlug)) ? "primary" : "link"}
            href={href}
            icon={icon}
            aria-label={`${label} — ${tooltip}`}
        >
            {label}
        </Button>
    </Tooltip>
);

/**
 * Five area buttons — admin-information-architecture re-pivot
 * (2026-05-16, same day as the first ship).
 *
 * Refined from the first-shipped 6-bucket noun taxonomy (Site / Content
 * / Commerce / People / Analytics / System) to the 5-bucket task-driven
 * taxonomy. The shift: organise by *what am I doing in this area*
 * rather than *what kind of thing is this*.
 *
 *   Build — compose the site's page tree from modules (the AdminApp page editor)
 *   Content — author the content the site shows (pages list, posts, products, orders, invoices, customers, inquiries, releases, trash, system pages)
 *   Settings — configure how everything works (hierarchical: chrome / theme / languages / seo / features/* / access / account)
 *   Analytics — see what happened (overview, SEO health, audit log, attribution, filters)
 *   System — power-user / dev tools (advanced-only — dim/hidden by default)
 *
 * Site / Commerce / People buckets dissolve. Their members fan out:
 *   - Site → Settings (chrome / theme / seo / languages) or Settings/features/* per feature
 *   - Commerce → Content (products / invoices / orders / inventory) or Settings/features/commerce + Settings/features/dropship
 *   - People → Content (customers / inquiries) or Settings/access (admin users + permissions + auth config)
 *
 * Legacy URLs 301-redirect to new homes via next.config.js. System is
 * advanced-only — simplified-mode authors don't see it; their top bar
 * drops to four buttons (Build / Content / Settings / Analytics).
 */
const AdminAreaButtons = ({view, simplified, tAdmin}: {
    view: AdminView,
    simplified: boolean,
    tAdmin: TFunction<"translation", undefined>,
}) => (
    // LABEL-ONLY rename (admin-IA sweep): the System bucket is renamed
    // "Advanced" in the chrome to set the right expectation for
    // non-technical operators ("System" reads as core/required; "Advanced"
    // reads as opt-in power-user). The URL prefix `/admin/system/*` stays
    // — 301 redirect-shim work + deep links + adminAreaItems all key off
    // the `system` slug. Renaming the URL is a separate, riskier change
    // tracked in the follow-on sweep.
    <>
        {topBarButton(view, 'build', '/admin/build', <LayoutOutlined/>, tAdmin('Build'), tAdmin('topBar.build.tooltip'))}
        {topBarButton(view, 'content', '/admin/content', <FileTextOutlined/>, tAdmin('Content'), tAdmin('topBar.content.tooltip'))}
        {topBarButton(view, 'settings', '/admin/settings', <SettingOutlined/>, tAdmin('Settings'), tAdmin('topBar.settings.tooltip'))}
        {!simplified && topBarButton(view, 'analytics', '/admin/analytics', <AuditOutlined/>, tAdmin('Analytics'), tAdmin('topBar.analytics.tooltip'))}
        {!simplified && topBarButton(view, 'system', '/admin/system', <ThunderboltOutlined/>, tAdmin('Advanced'), tAdmin('topBar.advanced.tooltip'))}
    </>
);

export default AdminAreaButtons;
