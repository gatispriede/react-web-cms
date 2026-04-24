/**
 * Build-time GraphQL fetcher used by getStaticProps / getStaticPaths.
 *
 * At build time the standalone GraphQL server (`npm run standalone-graphql`)
 * serves every path including `/api/graphql` on localhost:80 — that's what
 * this helper targets. In `next dev` the Apollo route at `/api/graphql` on
 * the dev server handles it. Override with `GRAPHQL_ENDPOINT` env var for
 * custom topologies (e.g. container-internal `http://server:3000/api/graphql`).
 */
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {IPost} from '@interfaces/IPost';
import {IThemeTokens} from '@interfaces/ITheme';

// In Docker the standalone GraphQL server is at http://server:<BUILD_PORT>/
// (root path). In local dev there's no BUILD_PORT and Next.js handles GraphQL
// at /api/graphql via its own Apollo route.
const _bp = process.env.BUILD_PORT;
const RESOLVED_ENDPOINT: string =
    process.env.GRAPHQL_ENDPOINT
    || (_bp ? `http://server:${_bp}/` : 'http://localhost/api/graphql');

export async function gqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
    try {
        const r = await fetch(RESOLVED_ENDPOINT, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query, variables}),
        });
        if (!r.ok) {
            console.error(`[gqlFetch] ${RESOLVED_ENDPOINT} → ${r.status}`);
            return null;
        }
        const json = await r.json();
        if (json.errors) console.warn('[gqlFetch] errors:', json.errors);
        return (json.data as T) ?? null;
    } catch (err) {
        console.error('[gqlFetch] network failure:', err);
        return null;
    }
}

export interface InitialPageData {
    pages: Array<{
        id?: string;
        type?: string;
        page: string;
        sections: string[];
        seo?: any;
    }>;
    /** key = page name, value = fully-resolved sections in authored order */
    sectionsByPage: Record<string, any[]>;
    posts: IPost[];
    footer: IFooterConfig;
    blogEnabled: boolean;
    layoutMode: 'tabs' | 'scroll';
    themeTokens: IThemeTokens | null;
    languages: Array<{label: string; symbol: string; default?: boolean; flag?: string}>;
}

const EMPTY_INITIAL: InitialPageData = {
    pages: [],
    sectionsByPage: {},
    posts: [],
    footer: {...DEFAULT_FOOTER},
    blogEnabled: true,
    layoutMode: 'tabs',
    themeTokens: null,
    languages: [],
};

const NAV_AND_META_QUERY = `{
  mongo {
    getNavigationCollection {
      id type page sections
      seo {
        description keywords viewport charSet url image image_alt
        published_time modified_time author locale
      }
    }
    getLanguages { label symbol default flag }
    getFooter
    getSiteFlags
    getActiveTheme
    getPosts(limit: 20)
  }
}`;

const SECTIONS_QUERY = `query($ids:[String]){
  mongo {
    getSections(ids: $ids) {
      id page type
      slots overlay overlayAnchor version
      transparent transparentOpacity
      content { name type style content action actionStyle actionType actionContent }
    }
  }
}`;

/** Fetch everything the public render needs in two GraphQL calls. */
export async function fetchInitialPageData(): Promise<InitialPageData> {
    const nav = await gqlFetch<{
        mongo: {
            getNavigationCollection: InitialPageData['pages'];
            getLanguages: InitialPageData['languages'];
            getFooter: string;
            getSiteFlags: string;
            getActiveTheme: string | null;
            getPosts: string;
        }
    }>(NAV_AND_META_QUERY);
    if (!nav) return {...EMPTY_INITIAL};

    const pages = nav.mongo.getNavigationCollection ?? [];
    const allIds = Array.from(new Set(pages.flatMap(p => p.sections ?? [])));
    const sectionsResp = allIds.length > 0
        ? await gqlFetch<{mongo: {getSections: any[]}}>(SECTIONS_QUERY, {ids: allIds})
        : null;
    const allSections = sectionsResp?.mongo?.getSections ?? [];

    const sectionsByPage: Record<string, any[]> = {};
    for (const p of pages) {
        sectionsByPage[p.page] = (p.sections ?? [])
            .map(id => allSections.find(s => s.id === id))
            .filter(Boolean);
    }

    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    try { if (nav.mongo.getFooter) footer = JSON.parse(nav.mongo.getFooter); } catch {}

    let blogEnabled = true;
    let layoutMode: 'tabs' | 'scroll' = 'tabs';
    try {
        const flags = JSON.parse(nav.mongo.getSiteFlags || '{}');
        blogEnabled = flags.blogEnabled !== false;
        layoutMode = flags.layoutMode === 'scroll' ? 'scroll' : 'tabs';
    } catch {}

    let themeTokens: IThemeTokens | null = null;
    try {
        if (nav.mongo.getActiveTheme) themeTokens = JSON.parse(nav.mongo.getActiveTheme).tokens ?? null;
    } catch {}

    let posts: IPost[] = [];
    try { posts = nav.mongo.getPosts ? JSON.parse(nav.mongo.getPosts) : []; } catch {}

    return {
        pages,
        sectionsByPage,
        posts,
        footer,
        blogEnabled,
        layoutMode,
        themeTokens,
        languages: nav.mongo.getLanguages ?? [],
    };
}
