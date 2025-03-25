import {Button} from "antd";
import AdminApp from "./AdminApp";
import React from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";
import {TFunction} from "i18next";
import {i18n} from "next-i18next";

const UserStatusBar = ({session, settings, t}: {
    session: Session, settings: boolean, t:  TFunction<"translation", undefined>
}) => {
    const lang = i18n?.language
    return (
        <>
            <div className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>{`${t("User")}: ${session?.user?.name} `}</p>
                </div>
                {
                    settings ?
                        <Button type={"link"} href={`/${lang}/admin`}>{t("Admin")}</Button>
                        :
                        <Button type={"link"} href={`/${lang}/admin/settings`}>{t("Settings")}</Button>
                }
                <Button type={"link"} target={'_blank'} href={`/${lang}`}>{t("Preview")}</Button>
                <Button type={"link"} href={'#'} onClick={() => signOut()}>{t("Sign out")}</Button>
            </div>
            {
                settings ?
                    <AdminSettings/>
                    :
                    <AdminApp session={session}/>
            }
        </>
    )
}
export default UserStatusBar;