import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/client-config` — landing; sub-pages at `/admin/client-config/<themes|logo|layout>`.
 */
const AdminClientConfig = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="client-config"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({redirectTo: '/admin/client-config/themes'});

export default AdminClientConfig;
