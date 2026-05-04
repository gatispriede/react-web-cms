import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/content` — landing; sub-pages at
 * `/admin/content/<translations|posts|footer|products|inventory|orders>`.
 */
const AdminContent = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="content"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({redirectTo: '/admin/content/translations'});

export default AdminContent;
