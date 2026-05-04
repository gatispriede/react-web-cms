import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/seo` — site-wide SEO. No sub-pages today; per-page SEO consolidation
 * is a separate Phase.
 */
const AdminSeo = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="seo"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr();

export default AdminSeo;
