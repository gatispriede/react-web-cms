import {Alert, Button, Dropdown, Space} from "antd";
import {ThunderboltOutlined} from "@client/lib/icons";
import AdminApp from "./AdminApp";
import React, {useEffect, useState} from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";
import AdminSettingsLanguages from "@admin/features/Languages/Languages";
import TranslationManager from "./TranslationManager";
import {useTranslation} from "next-i18next";
import Backend from "i18next-http-backend";
import {TFunction} from "i18next";
import {i18n} from "next-i18next";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import CommandPalette, {useCommandPaletteHotkey} from "./CommandPalette";
import {I18nextProvider, useTranslation as useReactTranslation} from "react-i18next";
import adminI18n, {ADMIN_LOCALES, AdminLocale, setAdminLocale} from "@admin/i18n/adminI18n";
import UserApi from "@services/api/client/UserApi";

export type AdminView = 'app' | 'settings' | 'languages';

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
    // resolvedLanguage is set by i18next to the actual detected locale, never
    // 'default' — safer than falling back to a hardcoded language code.
    let lang = i18n?.resolvedLanguage ?? (i18n?.language !== 'default' ? i18n?.language : null) ?? 'lv'
    const [blogEnabled, setBlogEnabled] = useState(true);
    const [paletteOpen, setPaletteOpen] = useState(false);
    useCommandPaletteHotkey(setPaletteOpen);
    const {t: tCommon, i18n: i18nCommon} = useTranslation('common');
    i18nCommon.use(Backend);
    useEffect(() => {
        void new SiteFlagsApi().get().then(f => setBlogEnabled(f.blogEnabled !== false));
    }, []);
    // Session-backed preference wins over the localStorage fallback that
    // `adminI18n`'s SSR init already applied — the user set it on purpose.
    const sessionLocale = (session?.user as any)?.preferredAdminLocale;
    useEffect(() => {
        if ((sessionLocale === 'en' || sessionLocale === 'lv') && adminI.language !== sessionLocale) {
            setAdminLocale(sessionLocale as AdminLocale);
        }
    }, [sessionLocale]); // eslint-disable-line react-hooks/exhaustive-deps
    const mustChangePassword = Boolean((session?.user as any)?.mustChangePassword);
    const currentAdminLocale = (adminI.language as AdminLocale) || 'en';
    const adminLocaleLabel = currentAdminLocale.toUpperCase();
    return (
        <>
            <a href="#admin-main" className="skip-to-content">{tAdmin("Skip to content")}</a>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}/>
            {mustChangePassword && (
                <Alert
                    type="error"
                    showIcon
                    banner
                    message={tAdmin("Change your password — you're using the seeded initial password.")}
                    description={
                        <span>
                            {tAdmin("Open")}{' '}
                            <a href={`/admin/settings`}>{tAdmin("Site settings → Users")}</a>{' '}
                            {tAdmin("and set a new password to clear this warning.")}
                        </span>
                    }
                />
            )}
            <nav aria-label={tAdmin("Admin")} className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${tAdmin("User")}: ${session?.user?.name} `}</p>
                </div>
                <Button
                    type={view === 'app' ? "primary" : "link"}
                    href={`/admin`}
                >
                    {tAdmin("App building")}
                </Button>
                <Button
                    type={view === 'settings' ? "primary" : "link"}
                    href={`/admin/settings`}
                >
                    {tAdmin("Site settings")}
                </Button>
                <Button
                    type={view === 'languages' ? "primary" : "link"}
                    href={`/admin/languages`}
                >
                    {tAdmin("Languages")}
                </Button>
                <Button type={"link"} onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                        window.open(`/${lang}`, '_blank', 'noopener,noreferrer');
                    }
                }}>{tAdmin("Preview")}</Button>
                {blogEnabled && (
                    <Button type={"link"} onClick={(e) => {
                        e.preventDefault();
                        if (typeof window !== 'undefined') {
                            window.open(`/${lang}/blog`, '_blank', 'noopener,noreferrer');
                        }
                    }}>{tAdmin("Blog")}</Button>
                )}
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
                <Button type={"link"} href={'#'} onClick={() => signOut()}>{tAdmin("Sign out")}</Button>
            </nav>
            <main id="admin-main" aria-label={tAdmin("Admin workspace")}>
                {/*
                  AdminApp + its descendant editors (Input*, AddNewSectionItem, section picker)
                  treat their `t` prop as the admin-chrome translator (field labels, buttons,
                  dialog titles) and `tApp` as the public-site translator for user content.
                  Pass `tAdmin` (from the dedicated `adminI18n` instance) so the admin-language
                  selector actually drives those labels; the public-site `t` is never
                  forwarded in here because it would ignore the admin-locale toggle.
                */}
                {view === 'app' && <AdminApp t={tAdmin as TFunction<"translation", undefined>} tApp={tApp} session={session}/>}
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
