import {Button} from "antd";
import {ThunderboltOutlined} from "@ant-design/icons";
import AdminApp from "./AdminApp";
import React, {useEffect, useState} from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";
import AdminSettingsLanguages from "./AdminSettings/Languages";
import TranslationManager from "./TranslationManager";
import {useTranslation} from "next-i18next";
import Backend from "i18next-http-backend";
import {TFunction} from "i18next";
import {i18n} from "next-i18next";
import SiteFlagsApi from "../../api/SiteFlagsApi";
import CommandPalette, {useCommandPaletteHotkey} from "./CommandPalette";

export type AdminView = 'app' | 'settings' | 'languages';

const UserStatusBar = ({session, view, t, tApp}: {
    session: Session,
    view: AdminView,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    let lang = i18n?.language !== 'default' ? i18n?.language : 'en'
    const [blogEnabled, setBlogEnabled] = useState(true);
    const [paletteOpen, setPaletteOpen] = useState(false);
    useCommandPaletteHotkey(setPaletteOpen);
    const {t: tCommon, i18n: i18nCommon} = useTranslation('common');
    i18nCommon.use(Backend);
    useEffect(() => {
        void new SiteFlagsApi().get().then(f => setBlogEnabled(f.blogEnabled !== false));
    }, []);
    return (
        <>
            <a href="#admin-main" className="skip-to-content">{t("Skip to content")}</a>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}/>
            <nav aria-label={t("Admin")} className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${t("User")}: ${session?.user?.name} `}</p>
                </div>
                <Button
                    type={view === 'app' ? "primary" : "link"}
                    href={`/${lang}/admin`}
                >
                    {t("App building")}
                </Button>
                <Button
                    type={view === 'settings' ? "primary" : "link"}
                    href={`/${lang}/admin/settings`}
                >
                    {t("Site settings")}
                </Button>
                <Button
                    type={view === 'languages' ? "primary" : "link"}
                    href={`/${lang}/admin/languages`}
                >
                    {t("Languages")}
                </Button>
                <Button type={"link"} onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                        window.open(`/${lang}`, '_blank', 'noopener,noreferrer');
                    }
                }}>{t("Preview")}</Button>
                {blogEnabled && (
                    <Button type={"link"} onClick={(e) => {
                        e.preventDefault();
                        if (typeof window !== 'undefined') {
                            window.open(`/${lang}/blog`, '_blank', 'noopener,noreferrer');
                        }
                    }}>{t("Blog")}</Button>
                )}
                <Button type={"link"} icon={<ThunderboltOutlined/>} onClick={() => setPaletteOpen(true)} title="Ctrl+K / ⌘K">
                    {t("Command")}
                </Button>
                <Button type={"link"} href={'#'} onClick={() => signOut()}>{t("Sign out")}</Button>
            </nav>
            <main id="admin-main" aria-label={t("Admin workspace")}>
                {view === 'app' && <AdminApp t={t} tApp={tApp} session={session}/>}
                {view === 'settings' && <AdminSettings/>}
                {view === 'languages' && (
                    <AdminSettingsLanguages
                        translationManager={new TranslationManager()}
                        i18n={i18nCommon}
                        tAdmin={tCommon}
                    />
                )}
            </main>
        </>
    )
}
export default UserStatusBar;
