import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

const Page = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="release/publishing"/>
    </SessionProvider>
);

// Publishing is editor+ with `canPublishProduction` (gated inside the panel).
// Bundle / Audit are admin-only — see those files.
export const getServerSideProps = buildAdminSsr();
export default Page;
