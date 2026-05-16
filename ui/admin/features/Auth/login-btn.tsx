import { useSession } from "next-auth/react"
import React from "react";
import {Button} from "antd";
import UserStatusBar, {AdminView} from "@admin/shell/UserStatusBar";
import { useT as useTranslation } from 'next-i18next/client'

/** Phase 1.A auth-split: admin auth has its own NextAuth instance under
 *  `/api/admin/auth/*` + signin page at `/admin/signin`. Calling
 *  `signIn()` from `next-auth/react` with no args targets the DEFAULT
 *  base path (`/api/auth/*` = customer instance), which then redirects
 *  to `/account/signin` (404'd by the `auth.clientLoginEnabled` flag
 *  gate). Operator gets a 404 instead of an admin signin form.
 *
 *  Fix: navigate directly to `/admin/signin` with a `callbackUrl`
 *  pointing back at the current admin URL. The admin signin page does
 *  the credentials handshake against the admin NextAuth instance via
 *  manual POST (no `signIn()` helper). */
function goToAdminSignIn(): void {
    if (typeof window === 'undefined') return;
    const callbackUrl = window.location.href;
    window.location.href = `/admin/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export default function LoginBtn({view = 'app'}: {view?: AdminView}) {
    const {data: session} = useSession()
    const t = useTranslation('common').t;
    const tApp = useTranslation('app').t;
    if (session) {
        return (
            <>
                <UserStatusBar t={t} tApp={tApp} session={session} view={view}/>
            </>
        )
    }
    return (
        <div className={'login-wrapper'}>
            <div className={'container'}>
                <h3>{t("Please sign in to continue")}</h3>
                <Button type={"primary"} data-testid="admin-loginbtn-signin" onClick={goToAdminSignIn}>{t("Sign in")}</Button>
            </div>
        </div>
    )
}