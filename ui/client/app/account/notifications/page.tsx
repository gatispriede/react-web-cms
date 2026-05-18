/**
 * `/account/notifications` — App Router migration, Batch 5.
 *
 * Phase 1.E moved the notification-preferences form into
 * `/account/settings?tab=notifications`. This route is kept as a
 * server-side redirect so pre-1.E bookmarks + outbound email links
 * don't 404. Remove once external references have aged out.
 */
import {redirect} from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NotificationsRedirectPage(): never {
    redirect('/account/settings?tab=notifications');
}
