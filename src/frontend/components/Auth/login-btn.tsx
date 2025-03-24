import { useSession, signIn } from "next-auth/react"
import React from "react";
import {Button} from "antd";
import UserStatusBar from "../Admin/UserStatusBar";

export default function LoginBtn({settings}: {settings?: boolean}) {
    const {data: session} = useSession()
    if (session) {
        return (
            <>
                <UserStatusBar session={session} settings={settings ? settings : false} />
            </>
        )
    }
    return (
        <div className={'login-wrapper'}>
            <div className={'container'}>
                <h3>Please sign in to continue</h3>
                <Button type={"primary"} onClick={() => signIn()}>Sign in</Button>
            </div>
        </div>
    )
}