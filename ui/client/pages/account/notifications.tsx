/**
 * Phase 1.E follow-up — `/account/notifications` was the original W8f
 * surface, but the form was extracted into
 * `@client/components/Account/NotificationPreferencesForm` and is now
 * mounted inline in `/account/settings?tab=notifications`.
 *
 * This page is kept as a server-side redirect so pre-1.E bookmarks
 * and outbound links (e.g. from old emails) don't 404. Remove once
 * external references have aged out.
 */
import {GetServerSideProps} from 'next';

const NotificationsRedirect = (): null => null;

export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: {destination: '/account/settings?tab=notifications', permanent: false},
});

export default NotificationsRedirect;
