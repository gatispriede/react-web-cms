import React from "react";
import {Button, Dropdown, Space} from "antd";
import {
    EyeOutlined,
    LogoutOutlined,
    ThunderboltOutlined,
} from "@client/lib/icons";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import {TFunction} from "i18next";
import {useTranslation as useReactTranslation} from "react-i18next";
import {ADMIN_LOCALES, AdminLocale, setAdminLocale} from "@admin/i18n/adminI18n";
import UserApi from "@services/api/client/UserApi";
import CommandPalette from "../CommandPalette";
import AdminModeSwitcher from "../AdminModeSwitcher";
import DarkModeSwitcher from "../DarkModeSwitcher";
import AdminAreaButtons from "./AdminAreaButtons";
import type {AdminView} from "../UserStatusBar";

/**
 * Admin top-bar nav: skip-to-content link, user name, area buttons,
 * preview/command/locale chrome, then mode + theme switchers and sign-out.
 *
 * The host shell (`UserStatusBarInner`) owns the area-rail + main pane;
 * everything inside the `<nav>` lives here.
 */
const AdminTopBar = ({
    view,
    session,
    simplified,
    tAdmin,
    lang,
    paletteOpen,
    setPaletteOpen,
}: {
    view: AdminView,
    session: Session,
    simplified: boolean,
    tAdmin: TFunction<"translation", undefined>,
    lang: string,
    paletteOpen: boolean,
    setPaletteOpen: (open: boolean) => void,
}) => {
    const {i18n: adminI} = useReactTranslation();
    const currentAdminLocale = (adminI.language as AdminLocale) || 'en';
    const adminLocaleLabel = currentAdminLocale.toUpperCase();

    return (
        <>
            <a href="#admin-main" className="skip-to-content" suppressHydrationWarning>{tAdmin("Skip to content")}</a>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}/>
            <nav aria-label={tAdmin("Admin")} className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${tAdmin("User")}: ${session?.user?.name} `}</p>
                </div>
                <AdminAreaButtons view={view} simplified={simplified} tAdmin={tAdmin}/>
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
                {/* Spacer — pushes everything from the language dropdown onward
                    to the far right. Nav actions (Build / Content / Preview /
                    Command…) stay left-aligned; account + chrome controls
                    (language / mode / theme / sign out) sit on the right. */}
                <span className="app-login-wrapper__spacer" aria-hidden="true"/>
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
                <AdminModeSwitcher/>
                <DarkModeSwitcher/>
                <Button type={"link"} icon={<LogoutOutlined/>} href={'#'} onClick={() => signOut()}>{tAdmin("Sign out")}</Button>
            </nav>
        </>
    );
};

export default AdminTopBar;
