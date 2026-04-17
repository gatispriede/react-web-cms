import {Button} from "antd";
import AdminApp from "./AdminApp";
import React, {useEffect, useState} from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";
import {TFunction} from "i18next";
import {i18n} from "next-i18next";
import SiteFlagsApi from "../../api/SiteFlagsApi";

const UserStatusBar = ({session, settings, t, tApp}: {
    session: Session,
    settings: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    let lang = i18n?.language !== 'default' ? i18n?.language : 'en'
    const [blogEnabled, setBlogEnabled] = useState(true);
    useEffect(() => {
        void new SiteFlagsApi().get().then(f => setBlogEnabled(f.blogEnabled !== false));
    }, []);
    return (
        <>
            <div className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${t("User")}: ${session?.user?.name} `}</p>
                </div>
                <Button
                    type={settings ? "link" : "primary"}
                    href={`/${lang}/admin`}
                >
                    {t("App building")}
                </Button>
                <Button
                    type={settings ? "primary" : "link"}
                    href={`/${lang}/admin/settings`}
                >
                    {t("Site settings")}
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
                <Button type={"link"} href={'#'} onClick={() => signOut()}>{t("Sign out")}</Button>
            </div>
            {
                settings ?
                    <AdminSettings/>
                    :
                    <AdminApp t={t} tApp={tApp} session={session}/>
            }
        </>
    )
}
export default UserStatusBar;