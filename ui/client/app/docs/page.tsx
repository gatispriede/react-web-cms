/**
 * `/docs` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/docs/index.tsx`. Pulls navigation +
 * active theme + footer via `gqlFetch`; the docs index is filtered out
 * of the main nav (pages whose admin name starts with `Docs ` are
 * surfaced through `/docs/<slug>` instead). Theme tokens travel down
 * to the `'use client'` view which applies them via
 * `applyThemeCssVars` in a `useEffect`.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import DocsIndexView from './DocsIndexView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Documentation',
    description: 'CMS documentation: setup, feature reference, AI / MCP workflow.',
};

const DOCS_PREFIX = 'Docs ';
const slugify = (s: string) => s.replace(/\s+/g, '-').toLowerCase();

interface DocPage {
    page: string;
    slug: string;
    title: string;
}

export default async function DocsIndexPage(): Promise<React.ReactElement> {
    let docs: DocPage[] = [];
    let themeTokens: unknown = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let navPages: {page: string}[] = [];

    const data = await gqlFetch<{mongo: {
        getNavigationCollection: {page: string}[];
        getActiveTheme: string | null;
        getFooter: string;
    }}>(
        `{ mongo { getNavigationCollection { page } getActiveTheme getFooter } }`,
    );
    try {
        const all = data?.mongo?.getNavigationCollection ?? [];
        navPages = all.map(p => ({page: p.page})).filter(p => !p.page.startsWith(DOCS_PREFIX));
        docs = all
            .filter(p => p.page.startsWith(DOCS_PREFIX))
            .map(p => {
                const title = p.page.slice(DOCS_PREFIX.length);
                return {page: p.page, title, slug: slugify(title)};
            })
            .sort((a, b) => a.title.localeCompare(b.title));
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = (JSON.parse(themeRaw) as {tokens?: unknown}).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
    } catch (err) {
        console.error('[docs/index] parse error:', err);
    }
    return <DocsIndexView docs={docs} themeTokens={themeTokens} footer={footer} navPages={navPages}/>;
}
