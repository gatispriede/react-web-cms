import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/build` — page-building shell (existing AdminApp). Sub-page
 * `/admin/build/modules-preview` re-homes the style matrix.
 */
const AdminBuild = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="build"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr();

export default AdminBuild;
