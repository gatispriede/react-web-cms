/**
 * Wave 8b — Terms of service page (placeholder).
 *
 * Operator: replace the placeholder content with reviewed legal copy.
 */
import React from 'react';
import Link from 'next/link';

const TermsPage: React.FC = () => {
    return (
        <main style={{maxWidth: 760, margin: '40px auto', padding: 16, lineHeight: 1.6}} data-testid="public-terms-page">
            <h1>Terms of service</h1>
            <p>
                <em>Last updated: {new Date().toISOString().slice(0, 10)} —{' '}
                <strong>OPERATOR: replace with reviewed legal text.</strong></em>
            </p>

            <h2>Use of the service</h2>
            <p>
                By using this site you agree to use it lawfully and to not interfere with its
                operation. <strong>OPERATOR: expand on acceptable use, account responsibilities,
                payment terms, refund window, dispute resolution.</strong>
            </p>

            <h2>Orders &amp; payment</h2>
            <p>
                Prices, taxes and shipping fees are shown at checkout. Orders are confirmed by
                email. <strong>OPERATOR: insert jurisdiction-specific consumer-protection
                clauses (EU 14-day distance-selling withdrawal etc.).</strong>
            </p>

            <h2>Liability</h2>
            <p>
                <strong>OPERATOR: insert liability cap + disclaimer language reviewed by
                counsel.</strong>
            </p>

            <h2>Governing law</h2>
            <p>
                <strong>OPERATOR: name the governing jurisdiction (Latvia by default).</strong>
            </p>

            <p style={{marginTop: 32}}>
                <Link href="/privacy">Privacy policy</Link>
            </p>
        </main>
    );
};

export default TermsPage;
