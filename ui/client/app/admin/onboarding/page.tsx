/**
 * `/admin/onboarding` — App Router migration, Batch 6 (Q7).
 *
 * Server-Component port of `pages/admin/onboarding.tsx`. Runs the
 * fresh-install probe in-process via the mongo connection; if an admin
 * already exists, redirects to `/admin/build` so the wizard can't be
 * re-run. The client `OnboardingWizard` itself is unchanged — see
 * `OnboardingView`.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import OnboardingView from './OnboardingView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Onboarding', robots: {index: false, follow: false}};

export default async function AdminOnboardingPage(): Promise<React.ReactElement> {
    let fresh = true;
    try {
        // Lazy require — same trick the Pages-Router version used to
        // keep the mongo connection out of the browser bundle graph.
        // `eval('require')` defeats Turbopack/webpack static analysis.

        const nodeRequire = eval('require') as NodeJS.Require;
        const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
        const conn = getMongoConnection() as unknown as {featureServices?: {onboarding?: {isFreshInstall?: () => Promise<boolean>}}};
        const svc = conn.featureServices?.onboarding;
        if (svc?.isFreshInstall) {
            fresh = await svc.isFreshInstall();
        } else {
            // OnboardingService not booted yet — bail safely.
            fresh = false;
        }
    } catch {
        fresh = false;
    }
    if (!fresh) redirect('/admin/build');
    return <OnboardingView/>;
}
