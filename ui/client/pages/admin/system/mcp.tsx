import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

const Page = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="system/mcp"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({adminOnly: true});
export default Page;
