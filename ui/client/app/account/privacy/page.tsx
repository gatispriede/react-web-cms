/**
 * `/account/privacy` — App Router migration, Batch 5.
 *
 * Phase 1.E moved the data-rights form into
 * `/account/settings?tab=privacy`. This route is kept as a
 * server-side redirect so pre-1.E bookmarks + outbound email links
 * don't 404. Remove once external references have aged out.
 */
import {redirect} from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PrivacyRedirectPage(): never {
    redirect('/account/settings?tab=privacy');
}
