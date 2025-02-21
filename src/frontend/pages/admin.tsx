import React from 'react'
import {SessionProvider} from "next-auth/react"
import LoginBtn from "../components/Auth/login-btn";
import {Session} from "next-auth";

const Admin = ({session}: {session: Session}) => {
    return (
        <SessionProvider session={session}>
            <LoginBtn />
        </SessionProvider>
    )
}

export default Admin;