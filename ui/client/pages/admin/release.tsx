import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/release` — landing renders the AreaNav rail; sub-pages live at
 * `/admin/release/<publishing|bundle|audit>`.
 */
const AdminRelease = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="release"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({redirectTo: '/admin/release/publishing'});

export default AdminRelease;
