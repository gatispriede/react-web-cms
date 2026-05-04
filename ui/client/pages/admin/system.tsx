import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {buildAdminSsr} from '@client/lib/adminSsr';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 * `/admin/system` — Users, MCP, Inquiries (admin only). Sub-pages live under
 * `/admin/system/<users|mcp|inquiries>`; the landing renders the AreaNav rail.
 */
const AdminSystem = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="system"/>
    </SessionProvider>
);

export const getServerSideProps = buildAdminSsr({adminOnly: true, redirectTo: '/admin/system/users'});

export default AdminSystem;
