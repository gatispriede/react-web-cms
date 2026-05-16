/**
 * `/docs/[slug]` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/docs/[slug].tsx`. The Pages-Router
 * version used `getStaticPaths` + `getStaticProps` (ISR `revalidate: 3600`);
 * the App-Router port renders per-request (`dynamic = 'force-dynamic'`)
 * to match the rest of the migrated routes — same staleness contract
 * as B4's blog/[slug]. The docs slug ↔ admin page title mapping
 * (`Docs <Title>` → slug) is identical to the Pages-Router lookup.
 *
 * `notFound()` from `next/navigation` replaces the gSSP `{notFound: true}`
 * sentinel.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {gqlFetch} from '@client/lib/gqlFetch';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import DocSlugView from './DocSlugView';

export const dynamic = 'force-dynamic';

const DOCS_PREFIX = 'Docs ';
const slugify = (s: string) => s.replace(/\s+/g, '-').toLowerCase();

interface LoadedDoc {
    title: string;
    html: string;
    themeTokens: unknown;
    footer: IFooterConfig;
    navPages: {page: string}[];
}

async function load(slug: string): Promise<LoadedDoc | null> {
    const data = await gqlFetch<{mongo: {
        getNavigationCollection: {page: string; sections: string[]}[];
        getActiveTheme: string | null;
        getFooter: string;
    }}>(
        `{ mongo { getNavigationCollection { page sections } getActiveTheme getFooter } }`,
    );
    try {
        const all = data?.mongo?.getNavigationCollection ?? [];
        const navPages = all.map(p => ({page: p.page})).filter(p => !p.page.startsWith(DOCS_PREFIX));
        const docPages = all.filter(p => p.page.startsWith(DOCS_PREFIX));
        const match = docPages.find(p => slugify(p.page.slice(DOCS_PREFIX.length)) === slug);
        if (!match) return null;
        const title = match.page.slice(DOCS_PREFIX.length);
        let html = '';
        const sectionIds = match.sections ?? [];
        if (sectionIds.length) {
            const secResp = await gqlFetch<{mongo: {getSections: {id: string; content: {type: string; content: string}[]}[]}}>(
                `query($ids:[String]){ mongo { getSections(ids: $ids) { id content { type content } } } }`,
                {ids: sectionIds},
            );
            const sections = secResp?.mongo?.getSections ?? [];
            // Concatenate every RichText payload across this page's sections
            // in authored order. Anything that isn't RichText is skipped —
            // docs pages are authored as RichText-only by the seeder, but a
            // hand-edited page might include other modules; ignoring those
            // keeps the docs view focused on prose.
            const ordered = sectionIds.map(id => sections.find(s => s.id === id)).filter(Boolean) as typeof sections;
            const parts: string[] = [];
            for (const sec of ordered) {
                for (const item of sec.content ?? []) {
                    if (item.type !== 'RICH_TEXT') continue;
                    try {
                        const v = JSON.parse(item.content || '{}');
                        if (typeof v.value === 'string') parts.push(v.value);
                    } catch { /* skip unparseable */ }
                }
            }
            html = parts.join('\n');
        }
        let themeTokens: unknown = null;
        let footer: IFooterConfig = {...DEFAULT_FOOTER};
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = (JSON.parse(themeRaw) as {tokens?: unknown}).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        return {title, html, themeTokens, footer, navPages};
    } catch (err) {
        console.error('[docs/[slug]] parse error:', err);
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{slug: string}>;
}): Promise<Metadata> {
    const {slug} = await params;
    const doc = await load(slug);
    if (!doc) return {title: 'Doc not found'};
    return {
        title: `${doc.title} — Docs`,
        description: `Documentation: ${doc.title}.`,
    };
}

export default async function DocSlugPage({
    params,
}: {
    params: Promise<{slug: string}>;
}): Promise<React.ReactElement> {
    const {slug} = await params;
    const doc = await load(slug);
    if (!doc) notFound();
    return (
        <DocSlugView
            title={doc.title}
            html={doc.html}
            themeTokens={doc.themeTokens}
            footer={doc.footer}
            navPages={doc.navPages}
        />
    );
}
