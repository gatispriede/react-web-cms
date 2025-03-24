import {Button} from "antd";
import AdminApp from "./AdminApp";
import React from "react";
import {Session} from "next-auth";
import {signOut} from "next-auth/react";
import AdminSettings from "./AdminSettings";

const UserStatusBar = ({session, settings}: {
    session: Session, settings: boolean
}) => {
    return (
        <>
            <div className={'app-login-wrapper'}>
                <div className={'container'}>
                    <p>User: {session?.user?.name}</p>
                </div>
                {
                    settings ?
                        <Button type={"link"} href={'/admin'}>Admin</Button>
                        :
                        <Button type={"link"} href={'/admin/settings'}>Settings</Button>
                }
                <Button type={"link"} target={'_blank'} href={'/'}>Preview</Button>
                <Button type={"link"} href={'#'} onClick={() => signOut()}>Sign out</Button>
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