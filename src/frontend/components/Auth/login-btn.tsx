import { useSession, signIn, signOut } from "next-auth/react"
import AdminApp from "../AdminApp";
import React from "react";
import {Button} from "antd";

export default function LoginBtn() {
    const {data: session} = useSession()
    if (session) {
        return (
            <>

                <div className={'app-login-wrapper'}>
                    <div className={'container'}>
                        <p>User: {session?.user?.name}</p>
                    </div>
                    <Button type={"link"} onClick={() => signOut()}>Sign out</Button>
                </div>
                <AdminApp session={session} />
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