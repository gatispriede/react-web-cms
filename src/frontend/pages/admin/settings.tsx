import React from 'react'
import LoginBtn from "../../components/Auth/login-btn";
import {SessionProvider} from "next-auth/react";

const AdminSettings = () => {
    return (
        <SessionProvider>
            <LoginBtn settings={true}/>
        </SessionProvider>
    )
}

export default AdminSettings;