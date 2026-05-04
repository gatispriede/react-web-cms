import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

const Page = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="client-config/site-layout"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr();
export default Page;
