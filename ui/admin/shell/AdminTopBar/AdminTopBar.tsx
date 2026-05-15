import React from "react";
import {Button, Drawer, Dropdown, Space} from "antd";
import {
    EyeOutlined,
    LogoutOutlined,
    MenuOutlined,
    ThunderboltOutlined,
} from "@client/lib/icons";
import {Session} from "next-auth";
/** Phase 1.A auth-split: `signOutAdmin()` from next-auth/react targets
 *  `/api/auth/signout` (customer instance) — wrong cookie, no-op for
 *  admin. Manual POST against the admin instance hits the right
 *  endpoint and clears `cms.admin-session`. */
async function signOutAdmin(): Promise<void> {
    const ADMIN_AUTH_BASE = '/api/admin/auth';
    try {
        const csrfRes = await fetch(`${ADMIN_AUTH_BASE}/csrf`, {credentials: 'include'});
        const {csrfToken} = await csrfRes.json();
        await fetch(`${ADMIN_AUTH_BASE}/signout`, {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
            body: new URLSearchParams({csrfToken, callbackUrl: '/admin', json: 'true'}).toString(),
        });
        // Hard-purge: also expire any stale `cms.admin-session` cookie at
        // legacy paths (`/admin`, etc.) that NextAuth won't touch because
        // it only clears the path defined in the current options.
        await fetch(`${ADMIN_AUTH_BASE}/force-signout`, {method: 'POST', credentials: 'include'});
    } catch { /* best-effort; redirect below clears state visually */ }
    if (typeof window !== 'undefined') window.location.href = '/admin';
}
import {TFunction} from "i18next";
import {useTranslation as useReactTranslation} from "react-i18next";
import {ADMIN_LOCALES, AdminLocale, setAdminLocale} from "@admin/i18n/adminI18n";
import UserApi from "@services/api/client/UserApi";
import {useIsMobile} from "@admin/lib/useIsMobile";
import {CommandPaletteTrigger} from "../CommandPalette/CommandPalette";
import AdminModeSwitcher from "../AdminModeSwitcher";
import DarkModeSwitcher from "../DarkModeSwitcher";
import AdminAreaButtons from "./AdminAreaButtons";
import type {AdminView} from "../UserStatusBar";

/**
 * Admin top-bar nav: skip-to-content link, user name, area buttons,
 * preview/command/locale chrome, then mode + theme switchers and sign-out.
 *
 * **Mobile shrink (≤768 px)** — the inline nav row wrapped onto 4 lines
 * on phones (operator screenshot 2026-05-08 surfaced this). Below the
 * breakpoint:
 *   - Top row keeps just User name + hamburger + sign-out.
 *   - Area buttons + Preview + Command + locale + mode + theme switch
 *     move into a slide-in `<Drawer>` triggered by the hamburger.
 *   - The drawer dismisses on overlay tap and on any nav item activation
 *     so the operator returns to the page they just picked.
 */
const AdminTopBar = ({
    view,
    session,
    simplified,
    tAdmin,
    lang,
}: {
    view: AdminView,
    session: Session,
    simplified: boolean,
    tAdmin: TFunction<"translation", undefined>,
    lang: string,
}) => {
    const {i18n: adminI} = useReactTranslation();
    const currentAdminLocale = (adminI.language as AdminLocale) || 'en';
    const adminLocaleLabel = currentAdminLocale.toUpperCase();
    const isMobile = useIsMobile();
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const dismiss = (): void => setDrawerOpen(false);

    const localeDropdown = (
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
    );

    const previewButton = (
        <Button type={"link"} icon={<EyeOutlined/>} onClick={(e) => {
            e.preventDefault();
            if (typeof window !== 'undefined') {
                window.open(`/${lang}`, '_blank', 'noopener,noreferrer');
            }
            dismiss();
        }}>{tAdmin("Preview")}</Button>
    );
    // kbar owns the palette open/close state — the trigger calls
    // `query.toggle()` via `useKBar` (see `CommandPaletteTrigger`). Styled
    // as an AntD link button so it sits flush with the rest of the nav row.
    const commandButton = (
        <span onClick={dismiss} className="admin-topbar-command-trigger">
            <ThunderboltOutlined/>
            <CommandPaletteTrigger className="admin-topbar-command-trigger__btn" label={tAdmin("Command")}/>
        </span>
    );

    return (
        <>
            <a href="#admin-main" className="skip-to-content" suppressHydrationWarning>{tAdmin("Skip to content")}</a>
            <nav aria-label={tAdmin("Admin")} className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${tAdmin("User")}: ${session?.user?.name} `}</p>
                </div>
                {isMobile ? (
                    <>
                        <span className="app-login-wrapper__spacer" aria-hidden="true"/>
                        <Button
                            data-testid="admin-topbar-mobile-toggle"
                            type="text"
                            icon={<MenuOutlined/>}
                            onClick={() => setDrawerOpen(true)}
                            aria-label={tAdmin("Open admin menu")}
                            aria-expanded={drawerOpen}
                        />
                        <Button type={"link"} icon={<LogoutOutlined/>} onClick={() => signOutAdmin()} aria-label={tAdmin("Sign out")}/>
                        <Drawer
                            data-testid="admin-topbar-mobile-drawer"
                            data-state={drawerOpen ? 'open' : 'closed'}
                            placement="right"
                            open={drawerOpen}
                            onClose={dismiss}
                            width="80vw"
                            title={tAdmin("Admin")}
                        >
                            <div onClick={dismiss}>
                                <AdminAreaButtons view={view} simplified={simplified} tAdmin={tAdmin}/>
                            </div>
                            <div style={{borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 12, paddingTop: 12}}>
                                {previewButton}
                                {commandButton}
                                {localeDropdown}
                                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 12}}>
                                    <AdminModeSwitcher/>
                                    <DarkModeSwitcher/>
                                </div>
                            </div>
                        </Drawer>
                    </>
                ) : (
                    <>
                        <AdminAreaButtons view={view} simplified={simplified} tAdmin={tAdmin}/>
                        {previewButton}
                        {/* DECISION: the public-blog link moved into the Content
                            area's sub-nav as a "View live blog" affordance under
                            Posts (per user instruction "move blog under content"
                            — Phase 2 of admin segregation). The admin top-bar no
                            longer carries a Blog utility button; the public blog
                            is reachable via Preview → /lang/blog or the Command
                            palette's "Open blog" entry. */}
                        {commandButton}
                        {/* Spacer — pushes everything from the language dropdown onward
                            to the far right. Nav actions (Build / Content / Preview /
                            Command…) stay left-aligned; account + chrome controls
                            (language / mode / theme / sign out) sit on the right. */}
                        <span className="app-login-wrapper__spacer" aria-hidden="true"/>
                        {localeDropdown}
                        <AdminModeSwitcher/>
                        <DarkModeSwitcher/>
                        <Button type={"link"} icon={<LogoutOutlined/>} href={'#'} onClick={() => signOutAdmin()}>{tAdmin("Sign out")}</Button>
                    </>
                )}
            </nav>
        </>
    );
};

export default AdminTopBar;
