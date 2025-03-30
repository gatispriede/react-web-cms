import React from 'react'
import {SessionProvider} from "next-auth/react"
import LoginBtn from "../components/Auth/login-btn";
import {Session} from "next-auth";
import {GetServerSideProps} from "next";
import {serverSideTranslations} from "next-i18next/serverSideTranslations";

const Admin = ({session}: { session: Session }) => {
    return (
        <SessionProvider session={session}>
            <LoginBtn/>
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
//             'common'
//         ])),
//     },
// })

export default Admin;