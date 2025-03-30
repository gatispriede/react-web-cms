import React from 'react'
import LoginBtn from "../../components/Auth/login-btn";
import {SessionProvider} from "next-auth/react";

import {GetServerSideProps} from "next";
import {serverSideTranslations} from 'next-i18next/serverSideTranslations'

const AdminSettings = () => {
    return (
        <SessionProvider>
            <LoginBtn settings={true}/>
        </SessionProvider>
    )
}

//
// export const getServerSideProps: GetServerSideProps<{}> = async (
//     {
//         locale,
//     }) => ({
//     props: {
//         ...(await serverSideTranslations(locale ?? 'en', [
//             'common', 'app'
//         ])),
//     },
// })

export default AdminSettings;