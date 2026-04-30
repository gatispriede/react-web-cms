import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

const Page = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="release/bundle"/>
    </SessionProvider>
);

// DECISION: Bundle was admin-only inside AdminSettings; smoke spec drives it
// signed-in as admin so that gate stays. Editors land back on /admin/build.
export const getServerSideProps = buildAdminSsr({adminOnly: true});
export default Page;
