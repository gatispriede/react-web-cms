/**
 * Public homepage (`/`) — App Router migration, Batch 3.
 *
 * Direct port of the former `pages/index.tsx`. Server Component: fetches
 * `fetchInitialPageData()` server-side and hands the snapshot to the
 * client `<SiteShell>` so first paint already has navigation, sections,
 * footer, and theme tokens. The Pages-Router page used
 * `getServerSideProps` (see the comment block in the original file for
 * the rationale: the production Docker prebuild ran against an empty
 * in-memory Mongo and baked `showLanding=true` into the image, regressing
 * the home page to the marketing landing for the first hour after every
 * deploy until ISR flipped it). The App-Router port preserves that
 * contract — the root `app/layout.tsx` is already `dynamic = 'force-dynamic'`
 * so this page inherits per-request rendering, and we read live Mongo
 * via `fetchInitialPageData()` (which goes through GraphQL → Mongo) on
 * every request. The mongo re-entry guard from B2 makes concurrent
 * server-component reads safe.
 *
 * The "fresh install → marketing landing" branch (no pages published yet)
 * is preserved exactly. Pages-Router `pages/index.tsx` was deleted in
 * this same change — `app/page.tsx` + `pages/index.tsx` is the canonical
 * Next route-collision error.
 */
import React from 'react';
import SiteShell from '@client/lib/SiteShell';
import LandingPage from '@client/features/Marketing/LandingPage';
import {fetchInitialPageData} from '@client/lib/gqlFetch';

// The Pages-Router predecessor explicitly switched off SSG (see header
// comment) in favour of `getServerSideProps`. The root layout already
// opts the entire App-Router tree out of static rendering
// (`dynamic = 'force-dynamic'`), so this page inherits the same
// per-request contract. Stated here for archaeology.
export const dynamic = 'force-dynamic';

const HomePage: React.FC = async () => {
    const initialData = await fetchInitialPageData();
    // Fresh install (no Navigation entries): show the marketing landing.
    // After the first page is published, this flips automatically.
    const showLanding = (initialData.pages?.length ?? 0) === 0;
    if (showLanding) return <LandingPage/>;
    return <SiteShell page="/" initialData={initialData}/>;
};

export default HomePage;
