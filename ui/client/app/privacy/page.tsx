/**
 * Privacy policy page — App Router migration, Batch 1.
 *
 * Direct port of the former `pages/privacy.tsx` (Wave 8b placeholder).
 * It had no `getServerSideProps` / `getStaticProps` data deps, so the
 * port is mechanical: a plain Server Component under `app/privacy/`.
 * The Pages-Router `pages/privacy.tsx` was deleted in the same change —
 * `app/privacy` and `pages/privacy` cannot both exist (Next errors on
 * the route collision).
 *
 * Operator: replace the placeholder content blocks below with reviewed
 * legal copy before public deployment. The structure (sections, links to
 * /terms + cookie classification runbook) is the technical scaffold;
 * the prose is intentionally generic and marked OPERATOR.
 */
import React from 'react';
import Link from 'next/link';
import type {Metadata} from 'next';

export const metadata: Metadata = {
    title: 'Privacy policy',
};

const PrivacyPolicyPage: React.FC = () => {
    return (
        <main style={{maxWidth: 760, margin: '40px auto', padding: 16, lineHeight: 1.6}} data-testid="public-privacy-page">
            <h1>Privacy policy</h1>
            <p>
                <em>Last updated: {new Date().toISOString().slice(0, 10)} —{' '}
                <strong>OPERATOR: replace with reviewed legal text.</strong></em>
            </p>

            <h2>What we collect</h2>
            <p>
                We collect account information you provide (email, name, addresses), order
                history, and aggregate usage data such as page views and referrer information.
                See the <Link href="/privacy#cookies">cookies section</Link> for tracking
                technology specifics.
            </p>

            <h2>Why we collect it</h2>
            <ul>
                <li>To fulfil orders and provide customer support.</li>
                <li>To send transactional emails (receipts, shipping updates).</li>
                <li>To improve the site (analytics, with consent).</li>
                <li>To meet our legal obligations (tax, fraud prevention).</li>
            </ul>

            <h2>Your rights</h2>
            <p>
                You can download a JSON copy of your data or request deletion from your{' '}
                <Link href="/account/privacy">privacy settings</Link>. Deletion has a 30-day
                grace window; contact support during that window to cancel.
            </p>

            <h2 id="cookies">Cookies</h2>
            <p>
                We use strictly-necessary cookies for the site to work, plus optional
                functional / analytics / marketing categories you control through the
                consent banner. A full list with retention periods is available in our
                cookie classification document.
            </p>

            <h2>Contact</h2>
            <p>
                <strong>OPERATOR:</strong> add data-protection officer contact + supervisory
                authority reference (Datu valsts inspekcija for Latvia).
            </p>

            <p style={{marginTop: 32}}>
                <Link href="/terms">Terms of service</Link>
            </p>
        </main>
    );
};

export default PrivacyPolicyPage;
