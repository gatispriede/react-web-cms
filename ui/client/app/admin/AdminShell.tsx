'use client';
/**
 * App-Router admin shell — App Router migration, Batch 6.
 *
 * Mirrors the JSX every Pages-Router admin page wrapped around its
 * `LoginBtn`: a `<SessionProvider session={session} basePath="/api/admin/auth">`
 * that pins useSession()/signIn() to the admin NextAuth instance
 * (`/api/admin/auth/*`) rather than the default customer one (auth-split
 * Phase 1.A). Without `basePath` the admin chrome would call signIn()
 * → `/api/auth/signin` (customer) and bounce through `/account/signin`.
 *
 * The Server Component `page.tsx` does the SSR session pull via
 * `resolveAdminSession()` and passes the cloned `session` down so
 * `useSession()` hydrates without flicker (risk-map #9).
 *
 * `view` is the literal string the legacy `LoginBtn` reads to decide
 * which inner pane `UserStatusBar` renders — identical to the Pages-Router
 * `<LoginBtn view="…"/>` prop.
 */
import React from 'react';
import {SessionProvider} from 'next-auth/react';
import type {Session} from 'next-auth';
import LoginBtn from '@admin/features/Auth/login-btn';
import type {AdminView} from '@admin/shell/UserStatusBar';
import SeoHead from '@client/lib/seo/SeoHead';

interface AdminShellProps {
    session: Session | null;
    view?: AdminView;
    /** Optional non-indexable preview-style title. When set, mounts
     *  `<SeoHead indexable={false} title=…/>` the same way the legacy
     *  Pages-Router admin pages did. */
    seoTitle?: string;
}

const AdminShell: React.FC<AdminShellProps> = ({session, view, seoTitle}) => (
    <SessionProvider session={session} basePath="/api/admin/auth">
        {seoTitle ? <SeoHead indexable={false} title={seoTitle}/> : null}
        {view ? <LoginBtn view={view}/> : <LoginBtn/>}
    </SessionProvider>
);

export default AdminShell;
