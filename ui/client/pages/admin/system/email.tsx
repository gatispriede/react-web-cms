import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/** Email-provider admin route. AdminShell looks up `system/email` on the registry. */
const Page = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="system/email"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({adminOnly: true});
export default Page;
