import { useSession, signIn } from "next-auth/react"
import React from "react";
import {Button} from "antd";
import UserStatusBar from "../Admin/UserStatusBar";
import { useTranslation } from 'next-i18next'

export default function LoginBtn({settings}: {settings?: boolean}) {
    const {data: session} = useSession()
    const t = useTranslation('common').t;
    const tApp = useTranslation('app').t;
    if (session) {
        return (
            <>
                <UserStatusBar t={t} tApp={tApp} session={session} settings={settings ? settings : false} />
            </>
        )
    }
    return (
        <div className={'login-wrapper'}>
            <div className={'container'}>
                <h3>{t("Please sign in to continue")}</h3>
                <Button type={"primary"} onClick={() => signIn()}>{t("Sign in")}</Button>
            </div>
        </div>
    )
}