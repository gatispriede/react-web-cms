/**
 * `/welcome` — App Router migration, Batch 6.
 *
 * System-page-backed marketing landing (all-pages-module-composed,
 * Marketing batch). Replaces the hand-coded `<LandingPage>` tree with
 * a `<SystemPageDispatch>` over the registered `marketing-landing`
 * system page; copy is carried in the registry's `defaultSections()`
 * and is operator-editable via the module editors.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import WelcomeView from './WelcomeView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'CMS — MCP-native CMS for agencies',
    description: 'An MCP-native CMS. Describe a page in plain English; modules, themes and copy land ready to publish.',
    robots: {index: true, follow: true},
};

export default async function WelcomePage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('marketing-landing');
    return <WelcomeView systemPage={systemPage}/>;
}
