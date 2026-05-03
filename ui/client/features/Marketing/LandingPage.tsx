import React from 'react';
import Head from 'next/head';
import Hero from './Hero';
import Comparison from './Comparison';
import Features from './Features';
import Pricing from './Pricing';
import FinalCta from './FinalCta';
import FooterMarketing from './FooterMarketing';
// landing.scss is mounted from ui/client/pages/_app.tsx (Next forbids
// global CSS imports outside _app.tsx). Class selectors are namespaced
// under `.marketing` so they don't leak into the CMS site.

/**
 * Composes the marketing landing page. Stateless, server-renderable.
 *
 * Rendered from two routes:
 *   - `/welcome` — always reachable, used for previews from admin.
 *   - `/`        — only when the install is fresh (no published pages and
 *                  no logo configured). See `pages/index.tsx`.
 */
const LandingPage: React.FC = () => (
    <>
        <Head>
            <title>CMS — MCP-native CMS for agencies</title>
            <meta
                name="description"
                content="An MCP-native CMS. Describe a page in plain English; modules, themes and copy land ready to publish."
            />
            <meta name="robots" content="index,follow" />
        </Head>
        <main className="marketing" id="main">
            <Hero />
            <Comparison />
            <Features />
            <Pricing />
            <FinalCta />
            <FooterMarketing />
        </main>
    </>
);

export default LandingPage;
