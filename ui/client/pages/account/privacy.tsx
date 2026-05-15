/**
 * Phase 1.E follow-up — `/account/privacy` was the original W8b
 * surface, but the form was extracted into
 * `@client/components/Account/DataRightsForm` and is now mounted
 * inline in `/account/settings?tab=privacy`.
 *
 * This page is kept as a server-side redirect so pre-1.E bookmarks
 * and outbound links (e.g. from old emails) don't 404. Remove once
 * external references have aged out.
 */
import {GetServerSideProps} from 'next';

const PrivacyRedirect = (): null => null;

export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: {destination: '/account/settings?tab=privacy', permanent: false},
});

export default PrivacyRedirect;
