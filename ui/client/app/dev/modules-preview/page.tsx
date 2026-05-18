/**
 * `/dev/modules-preview` — App Router migration, Batch 6.
 *
 * Dev-only modules preview — same renderer as `/admin/modules-preview`
 * but with no auth gate. Returns a 404 outside `NODE_ENV=development`
 * so this route never escapes into a production build.
 *
 * Use case: while iterating on new module code we want a fast
 * hot-reload loop without round-tripping through the admin login +
 * UserStatusBar shell. The admin route is the canonical surface for
 * operators; this one is for the developer running `npm run dev`.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import DevModulesPreviewView from './DevModulesPreviewView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Dev · Modules preview', robots: {index: false, follow: false}};

export default async function DevModulesPreviewPage(): Promise<React.ReactElement> {
    if (process.env.NODE_ENV !== 'development') notFound();
    return <DevModulesPreviewView/>;
}
