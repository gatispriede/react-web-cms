'use client';
/**
 * SiteShell — the public-site shell (header / navigation / language
 * dropdown / footer / SEO `<Head>` / scroll- vs tabs-mode switch).
 *
 * App-Router migration, Batch 3. This file is the former `pages/app.tsx`
 * (519-line client class) lifted out of the Pages-Router routes folder
 * into `lib/` so both routers can consume it during the migration window:
 *  - Pages Router `pages/[...slug].tsx` still imports it for the
 *    catch-all public route (B4 territory; untouched here).
 *  - App Router `app/page.tsx` (this batch's index port) imports it for
 *    `/`.
 *
 * What changed vs. `pages/app.tsx`:
 *  - Marked `'use client'` — it consumes browser APIs (window, hashchange,
 *    `ConfigProvider`, `Spin`, `Dropdown`, the `useTranslation` hook in
 *    the new wrapper). The Pages-Router route file's own `'use client'`
 *    inheritance was implicit; under App Router this is mandatory.
 *  - Default export is now a small functional wrapper `SiteShell` that
 *    pulls `t` / `i18n` from `useTranslation('app')` and `pathname` from
 *    `usePathname()` and forwards them to the inner `App` class. The
 *    upstream API for the class itself is unchanged so the Pages-Router
 *    `[...slug].tsx` import continues to work without prop-plumbing
 *    edits. (The pages-router import shape is `<App t={...} i18n={...}
 *    pathname={...} .../>`; we re-export the class as a *named* export
 *    `LegacyAppClass` so callers that already supply those props keep
 *    using it directly until B4 reshapes them.)
 *
 * NOT changed: every internal method (`buildStateFromInitialData`,
 * `initialize`, `handleHashChange`, `findIdForActiveTab`, the render
 * tree). This is a mechanical port — behaviour deltas would mask any
 * App-Router-induced regressions during smoke testing.
 */
import React from 'react'
import {useT} from 'next-i18next/client';
import {usePathname} from 'next/navigation';
import {resolve} from "@services/api/generated";
import {ConfigProvider, Dropdown, MenuProps, Space, Spin, Typography} from 'antd';
import DynamicTabsContent from "@client/lib/DynamicTabsContent";
import {IPage} from "@interfaces/IPage";
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import ThemeApi from '@services/api/client/ThemeApi';
import type {ThemeConfig} from 'antd';
import {IMongo} from "@interfaces/IMongo";
import MongoApi from '@services/api/client/MongoApi';
import {ISection} from "@interfaces/ISection";
import Logo from "@client/features/Logo/Logo";
import Link from 'next/link'
import Head from 'next/head'
import {i18n as I18nInstance, TFunction} from "i18next";
import {INavigation} from "@services/api/generated/schema.generated";
import {translateOrKeep} from "@utils/translateOrKeep";
import PublishApi from "@services/api/client/PublishApi";
import PostApi from "@services/api/client/PostApi";
import FooterApi from "@services/api/client/FooterApi";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import SiteFooter from "@client/features/Footer/SiteFooter";
import {DEFAULT_FOOTER, IFooterConfig} from "@interfaces/IFooter";
import type {InitialPageData} from "@client/lib/gqlFetch";
import {PostsProvider} from "@client/lib/PostsContext";
import {refreshBus} from "@client/lib/refreshBus";
import ScrollNav from "@client/features/Navigation/ScrollNav";
import MainMenu from "@client/features/Navigation/MainMenu";
import CustomerAccountDropdown from "@client/components/Auth/CustomerAccountDropdown";
import type {IMenuPage} from "@client/features/Navigation/menuItems";
import MobileNav, {MobileNavLink} from "@client/features/MobileNav/MobileNav";

interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[],
    themeConfig?: ThemeConfig,
    footer: IFooterConfig,
    hasPosts: boolean,
    blogEnabled: boolean,
    layoutMode: 'tabs' | 'scroll',
}

export interface ISiteShellProps {
    page: string,
    /** F7 — server-resolved page id for the current route (the canonical
     *  `INavigation.id` like `sc7-nav-sakums`). When present, the active
     *  tab is looked up by id (exact match). Falls back to the first
     *  tab when undefined (legacy single-page mount that bypasses the
     *  catch-all). Removes the brittle display-name re-normalisation
     *  that used to live in `findIdForActiveTab`. */
    pageId?: string,
    t: TFunction<string, undefined>,
    i18n: I18nInstance,
    pathname: string,
    /** F1 sub-pages — full slug chain (root → leaf) for the current
     *  route. Drives MainMenu trail-highlight and feeds `activeChain`
     *  on first paint without waiting on `router.query`. */
    slugChain?: string[],
    initialData?: InitialPageData,
}

// Legacy alias — Pages-Router `pages/[...slug].tsx` (and any test still
// importing `App`) keep working. Renamed in the new file for clarity but
// the wire shape is identical.
type IHomeProps = ISiteShellProps;

export class LegacyAppClass extends React.Component<IHomeProps> {
    sections: any[] = []
    private MongoApi = new MongoApi()
    private PublishApi = new PublishApi()
    private ThemeApi = new ThemeApi()
    private PostApi = new PostApi()
    private FooterApi = new FooterApi()
    private SiteFlagsApi = new SiteFlagsApi()
    private snapshotSectionsByPage: Record<string, ISection[]> = {}
    loadSections: any
    getNavigationListCache: any
    page: string
    state: IHomeState = {
        loading: false,
        pages: [],
        tabProps: [],
        activeTab: '0',
        footer: {...DEFAULT_FOOTER},
        hasPosts: false,
        blogEnabled: true,
        layoutMode: 'tabs',
    }
    private languages: any;

    constructor(props: IHomeProps) {
        super(props);
        this.page = props.page
        this.loadSections = this.MongoApi.loadSections
        this.getNavigationListCache = this.getNavigationList
        if (props.initialData) {
            // SSG path — synchronously hydrate state so first paint has real content.
            this.state = this.buildStateFromInitialData(props.initialData);
            this.languages = props.initialData.languages;
        } else {
            this.state.loading = true
            void this.initialize(true)
        }
    }

    private refreshUnsub?: () => void;

    componentDidMount() {
        if (this.props.initialData?.themeTokens) {
            applyThemeCssVars(this.props.initialData.themeTokens);
        }
        // SSG initialData can go stale against Mongo (language flag saved via
        // admin after build). Always top up `languages` from live on mount so
        // the dropdown trigger picks up flags without a rebuild.
        if (this.props.initialData) {
            void (async () => {
                try {
                    const fresh = await this.MongoApi.getLanguages();
                    const arr = Array.isArray(fresh) ? fresh : Object.values(fresh ?? {});
                    if (arr.length > 0) {
                        this.languages = arr;
                        this.forceUpdate();
                    }
                } catch { /* noop */ }
            })();
        }
        this.refreshUnsub = refreshBus.subscribe(() => this.refreshView());
        // Tabs-mode hash routing: when someone lands on `/#career-record` or
        // clicks an in-page anchor, find the tab whose sections include that
        // id and switch to it before letting the browser scroll. Without this
        // the hash points at a node that's hidden behind another tab and the
        // jump silently no-ops. Scroll-mode pages already render every section
        // inline so the native browser jump works without help.
        if (typeof window !== 'undefined') {
            // `handleHashChange` is an arrow class property — already bound to
            // `this`, so the same reference works for add + remove listener.
            window.addEventListener('hashchange', this.handleHashChange!);
            // Defer initial resolution until after first paint so section DOM
            // ids exist (they're rendered inside DynamicTabsContent).
            setTimeout(() => this.handleHashChange!(), 0);
        }
    }

    componentWillUnmount() {
        this.refreshUnsub?.();
        if (typeof window !== 'undefined' && this.handleHashChange) {
            window.removeEventListener('hashchange', this.handleHashChange!);
        }
    }

    /** Bound in `componentDidMount` so we can pass the same reference to
     *  `removeEventListener`. Resolves the current `window.location.hash`
     *  to the tab containing that anchor (in tabs mode), switches tabs,
     *  then scrolls the element into view on the next frame. No-op in
     *  scroll mode — the browser handles it natively. */
    private handleHashChange?: () => void = () => {
        if (typeof window === 'undefined') return;
        const raw = window.location.hash.replace(/^#/, '');
        if (!raw) return;
        // Tabs mode is the only one that hides peer sections behind a tab —
        // scroll mode renders the whole page so the native browser jump is
        // sufficient.
        if (this.state.layoutMode === 'tabs') {
            const tabs = this.state.tabProps ?? [];
            const owner = tabs.findIndex(tp => {
                const sections: ISection[] = tp?.page?.sections ?? [];
                return sections.some(s => {
                    if (s.id === raw) return true;
                    // Match a slugified module-title anchor by walking the
                    // content items. Keeps this resolver in sync with the
                    // ids modules render via `slugifyAnchor`.
                    const items = (s as any).content ?? [];
                    return items.some((it: any) => {
                        try {
                            const j = typeof it?.content === 'string' ? JSON.parse(it.content) : it?.content;
                            const candidates = [j?.title, j?.sectionTitle];
                            for (const t of candidates) {
                                if (typeof t === 'string' && this.slugify(t) === raw) return true;
                            }
                        } catch { /* malformed item content — skip */ }
                        return false;
                    });
                });
            });
            if (owner >= 0 && String(owner) !== this.state.activeTab) {
                this.setState({activeTab: String(owner)});
            }
        }
        // Scroll into view after the tab switch (or immediately in scroll
        // mode). `requestAnimationFrame` lets the new tab paint first.
        requestAnimationFrame(() => {
            const el = document.getElementById(raw);
            if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
        });
    }

    /** Shared with the modules' `slugifyAnchor` (kept inline to avoid an
     *  extra import roundtrip in the page bundle). Must match the
     *  `slugifyAnchor` in `shared/utils/stringFunctions.ts`. */
    private slugify(input: string): string {
        return input
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]+/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60);
    }

    /** Full re-fetch for the public shell. Typically triggered from the admin
     *  preview tab, when a mutation in an admin window is reflected in an
     *  already-open preview window via shared bus inside the same tab. */
    refreshView = async (): Promise<void> => {
        await this.initialize();
    }

    buildStateFromInitialData(data: InitialPageData): IHomeState {
        const pages: IPage[] = (data.pages ?? []).map((p: any) => ({
            // F7 — thread the canonical id through so the menu builder
            // can use it for parent-child lookup. Without it, parent
            // refs point to the page name and a child's `parent: 'sc7-nav-sakums'`
            // never finds its root.
            id: p.id,
            page: p.page,
            // F1 sub-pages — preserve parent/slug so MainMenu can render
            // nested SubMenus. Older builds without these fields fall
            // through to undefined and render flat.
            parent: p.parent,
            slug: p.slug,
            seo: p.seo,
            sections: p.sections,
        }));
        const tabProps = pages.map((p, id) => ({
            key: String(id),
            // F7 — id-based active-tab lookup keys off this field.
            id: p.id,
            page: p.page,
            seo: p.seo,
            label: (
                <Link className={'navigation-item'}
                      href={p.page.replace(/ /g, '-').toLowerCase()}>
                    {translateOrKeep(this.props.t, p.page)}
                </Link>
            ),
            children: (
                <DynamicTabsContent
                    t={this.props.t}
                    tApp={this.props.t}
                    refresh={async () => { await this.initialize(); }}
                    sections={(data.sectionsByPage?.[p.page] ?? []) as ISection[]}
                    page={p.page}
                    admin={false}
                />
            ),
        }));
        return {
            loading: false,
            activeTab: '0',
            pages,
            tabProps,
            footer: data.footer ?? {...DEFAULT_FOOTER},
            hasPosts: (data.posts?.length ?? 0) > 0,
            blogEnabled: data.blogEnabled !== false,
            layoutMode: (data as any).layoutMode === 'scroll' ? 'scroll' : 'tabs',
            themeConfig: data.themeTokens ? buildThemeConfig(data.themeTokens) : undefined,
        };
    }

    async getSectionData(pages: IPage[], id: number): Promise<ISection[]> {
        const cached = this.snapshotSectionsByPage[pages[id].page];
        if (cached) return cached;
        return await this.loadSections(pages[id].page, pages)
    }

    async getNavigationList(): Promise<IPage[]> {
        return await resolve(
            ({query}): IPage[] => {
                const list: any[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                    let itemSeo
                    if (item.seo) {
                        itemSeo = {
                            description: item.seo.description,
                            keywords: item.seo.keywords,
                            viewport: item.seo.viewport,
                            charSet: item.seo.charSet,
                            url: item.seo.url,
                            image: item.seo.image,
                            image_alt: item.seo.image_alt,
                            author: item.seo.author,
                            locale: item.seo.locale,
                        }
                    }
                    return list.push({
                        // F7 — thread `id` so the menu builder can match
                        // parent ↔ child by canonical id, not display name.
                        id: (item as any).id,
                        page: item.page,
                        parent: (item as any).parent,
                        slug: (item as any).slug,
                        seo: itemSeo,
                        sections: item.sections
                    })
                })
                return list
            },
        )
    }

    async initialize(init: boolean = false): Promise<void> {
        let cacheDataSource: any
        let newState: IHomeState = {
            loading: false,
            pages: this.state.tabProps,
            tabProps: this.state.tabProps,
            activeTab: this.state.activeTab,
            layoutMode: this.state.layoutMode,
            footer: this.state.footer,
            hasPosts: this.state.hasPosts,
            blogEnabled: this.state.blogEnabled,
        }
        if (init) {
            // eslint-disable-next-line react/no-direct-mutation-state
            this.state.loading = true
        } else {
            this.setState({loading: true})
        }
        let pages: IPage[];
        const snapshot = await this.PublishApi.getSnapshot();
        if (snapshot && snapshot.navigation?.length) {
            pages = snapshot.navigation.map((n: any) => ({
                // F7 — id flows from snapshot so the menu builder
                // matches parent refs (which are ids) to roots.
                id: n.id,
                page: n.page,
                parent: n.parent,
                slug: n.slug,
                seo: n.seo,
                sections: n.sections,
            }));
            this.snapshotSectionsByPage = {};
            for (const nav of snapshot.navigation) {
                const ids: string[] = nav.sections ?? [];
                const pageSections = ids
                    .map((id) => snapshot.sections.find((s: any) => s.id === id))
                    .filter(Boolean) as ISection[];
                this.snapshotSectionsByPage[nav.page] = pageSections;
            }
        } else {
            pages = await this.getNavigationList()
        }
        // @ts-ignore
        if (cacheDataSource) {
            // unused legacy branch
        } else {
            // pages = await this.getNavigationList()
        }
        if (pages[0]) {
            const newTabsState = []
            for (let id in pages) {
                if (pages[id]) {
                    let sectionsData: ISection[];
                    sectionsData = await this.getSectionData(pages, id as unknown as number)
                    // @ts-ignore
                    if (cacheDataSource) {
                        // unused legacy branch
                    } else {
                        // sectionsData = await this.getSectionData(pages, id as unknown as number)
                    }
                    newTabsState.push({
                        key: id,
                        // F7 — id-based active-tab lookup keys off this.
                        id: pages[id].id,
                        page: pages[id].page,
                        seo: pages[id].seo,
                        label: (
                            <Link className={'navigation-item'}
                                  href={pages[id].page.replace(/ /g, '-').toLowerCase()}>{translateOrKeep(this.props.t, pages[id].page)}</Link>
                        ),
                        children:
                            <DynamicTabsContent
                                t={this.props.t}
                                tApp={this.props.t}
                                refresh={async () => {
                                    await this.initialize();
                                }}
                                sections={sectionsData}
                                page={pages[id].page}
                                admin={false}
                            />
                    })
                }
            }
            newState.tabProps = newTabsState
        }

        this.languages = await this.MongoApi.getLanguages()
        const [footer, postCount, flags] = await Promise.all([
            this.FooterApi.get(),
            this.PostApi.list({limit: 1}).then(list => list.length).catch(() => 0),
            this.SiteFlagsApi.get(),
        ]);
        newState.footer = footer;
        newState.hasPosts = postCount > 0;
        newState.blogEnabled = flags.blogEnabled !== false;
        newState.layoutMode = (flags as any).layoutMode === 'scroll' ? 'scroll' : 'tabs';
        const activeTheme = await this.ThemeApi.getActive();
        if (activeTheme?.tokens) {
            applyThemeCssVars(activeTheme.tokens);
            newState.themeConfig = buildThemeConfig(activeTheme.tokens);
        }

        newState.pages = pages
        newState.loading = false;

        this.setState(newState)
        this.adjustDefaultLangRoute(pages)
    }

    adjustDefaultLangRoute(pages: IPage[]) {
        if (pages && pages[0] && pages[0].page && typeof window !== 'undefined') {
            // @ts-ignore
            if (this.props.i18n.options['defaultLocale']) {
                // @ts-ignore
                const defaultLocale: string = this.props.i18n.options['defaultLocale']
                if (defaultLocale && window.location.pathname === '/en') {
                    window.location.href = `${window.location.origin}/${defaultLocale}/${pages[0].page}`
                }
            }
        }
    }

    /** Build the mobile-nav link list once. Mirrors the desktop Menu's
     *  tree (root pages with children render expandable, matching F1
     *  sub-pages). Walks the same `IMenuPage[]` shape via the shared
     *  `buildMenuItems` builder so the structure can't drift. Blog is
     *  appended last as a flat row (it's a route, not a page-tree leaf). */
    buildMobileLinks(): MobileNavLink[] {
        // Lazy import to keep this method's runtime cost low for sites
        // without sub-pages.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {buildMenuItems} = require('@client/features/Navigation/menuItems') as typeof import('@client/features/Navigation/menuItems');
        const menuPages: IMenuPage[] = this.state.pages.map((p: any) => ({
            // F7 — id is the canonical match for `parent` refs. Falling
            // back to `page` lets legacy rows without an id still render
            // (they'll never have a `parent` either, so they stay flat).
            id: p.id || p.page,
            page: p.page,
            parent: p.parent,
            slug: p.slug,
        }));
        const tree = buildMenuItems(menuPages, {
            translate: (s: string) => translateOrKeep(this.props.t, s) as string,
        });
        const toMobile = (n: any): MobileNavLink => ({
            key: n.key,
            href: n.href,
            label: typeof n.label === 'string' ? n.label : String(n.label ?? ''),
            children: n.children?.length ? n.children.map(toMobile) : undefined,
        });
        const list: MobileNavLink[] = tree.map(toMobile);
        if (this.state.blogEnabled && this.state.hasPosts) {
            list.push({key: 'blog', href: '/blog', label: this.props.t('Blog') as string});
        }
        return list;
    }

    findIdForActiveTab() {
        // F7 — server already resolved which page is active and passed
        // its canonical id through SSR props. Look it up exactly,
        // no string transforms involved. Eliminates the class of bugs
        // where tab-side and props-side normalisation rules drift apart
        // (the original was: tab did `replace(/ /g,'-').toLowerCase()`,
        // props side did `encodeURIComponent(...).toLowerCase()` — they
        // didn't match for "Jaunumi un aktualitātes ").
        if (this.props.pageId) {
            const idx = this.state.tabProps.findIndex(tab => tab.id === this.props.pageId);
            if (idx >= 0) return idx;
        }
        // Fallback: legacy single-page mounts (`/`) that don't go
        // through `[...slug].tsx` and so don't carry a `pageId`. Land
        // on the first tab — preserves the pre-F7 behaviour for `/`.
        return this.state.tabProps.length > 0 ? 0 : -1;
    }

    render() {
        const activeKey = this.findIdForActiveTab()
        const seo = this.state.tabProps[activeKey] ? this.state.tabProps[activeKey].seo : undefined;
        // `languages` comes in as an array from initialData and a dict from the
        // draft/SSR paths. Normalise to the array shape here so we can safely
        // build the dropdown and look up the active locale's label.
        const languageArray: Array<{label: string; symbol: string; default?: boolean; flag?: string}> =
            Array.isArray(this.languages)
                ? this.languages
                : this.languages
                    ? Object.values(this.languages as Record<string, any>)
                    : [];
        const activeLang = languageArray.find(l => l.symbol === this.props.i18n.language);
        const currentUrl = this.props.pathname;
        const items: MenuProps['items'] = languageArray.map(l => ({
            label: (
                <a href={`/${l.symbol}${currentUrl}`} style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                    {l.flag
                        ? <span className="lang-glyph" aria-hidden>{l.flag}</span>
                        : <span className="lang-glyph lang-glyph--symbol">{l.symbol.toUpperCase()}</span>
                    }
                    <span className="lang-label">{l.label}</span>
                </a>
            ),
            key: l.symbol,
        }));
        return (
            <PostsProvider value={this.props.initialData?.posts ?? null}>
            <div>
                <Head>
                    <title>{this.state.tabProps[activeKey] ? this.state.tabProps[activeKey].page : ''}</title>
                    <meta property="og:title" content={this.props.page} key="title"/>
                    {seo && seo.description &&
                        <meta property="og:description" content={seo.description} key="description"/>
                    }
                    {seo && seo.keywords &&
                        <meta property="og:keywords" content={seo.keywords.join()} key="keywords"/>
                    }
                    {seo && seo.viewport &&
                        <meta property="og:viewport" content={seo.viewport} key="viewport"/>
                    }
                    {seo && seo.charSet &&
                        <meta property="og:charSet" content={seo.charSet} key="charSet"/>
                    }
                    {seo && seo.url &&
                        <meta property="og:url" content={seo.url} key="url"/>
                    }
                    {seo && seo.image &&
                        <meta property="og:image" content={seo.image} key="image"/>
                    }
                    {seo && seo.image_alt &&
                        <meta property="og:image_alt" content={seo.image_alt} key="image_alt"/>
                    }
                    {seo && seo.author &&
                        <meta property="og:author" content={seo.author} key="author"/>
                    }
                    {seo && seo.locale &&
                        <meta property="og:locale" content={seo.locale} key="locale"/>
                    }
                    {/* W8h SEO program — canonical + hreflang alternates +
                        JSON-LD (Organization + WebSite). Origin resolution:
                        SSR-safe via `seo.url` when set; otherwise window
                        origin (client-only). hreflang alternates use the
                        per-locale URL pattern `/<symbol><path>`. */}
                    {(() => {
                        const origin = (() => {
                            if (typeof seo?.url === 'string' && seo.url) {
                                try { return new URL(seo.url).origin; } catch { /* fallthrough */ }
                            }
                            if (typeof window !== 'undefined' && window.location?.origin) {
                                return window.location.origin;
                            }
                            return '';
                        })();
                        if (!origin) return null;
                        const path = currentUrl?.startsWith('/') ? currentUrl : `/${currentUrl ?? ''}`;
                        // Strip leading `/{lang}` from path so we can re-prefix per locale.
                        const stripped = (() => {
                            const m = path.match(/^\/(\w{2,3})(\/.*)?$/);
                            if (m && languageArray.some(l => l.symbol === m[1])) return m[2] || '/';
                            return path;
                        })();
                        const canonical = `${origin}${stripped === '/' ? '' : stripped}`;
                        const altLinks = languageArray.map(l => (
                            <link
                                key={`alt-${l.symbol}`}
                                rel="alternate"
                                hrefLang={l.symbol}
                                href={`${origin}/${l.symbol}${stripped === '/' ? '' : stripped}`}
                            />
                        ));
                        const orgLd = {
                            '@context': 'https://schema.org',
                            '@type': 'Organization',
                            name: this.props.page || origin,
                            url: origin,
                        };
                        const siteLd = {
                            '@context': 'https://schema.org',
                            '@type': 'WebSite',
                            name: this.props.page || origin,
                            url: origin,
                        };
                        return (
                            <>
                                <link rel="canonical" href={canonical} key="canonical"/>
                                {altLinks}
                                <script
                                    type="application/ld+json"
                                    key="jsonld-org-site"

                                    dangerouslySetInnerHTML={{__html: JSON.stringify([orgLd, siteLd])}}
                                />
                            </>
                        );
                    })()}
                </Head>
                <ConfigProvider theme={this.state.themeConfig ?? staticTheme}>
                    <Spin spinning={this.state.loading}>
                        {this.state.layoutMode === 'scroll' ? (
                            // Single-page scroll mode — stack every page as a
                            // `<section id="<slug>">` so hash-links work.
                            <>
                                <header className="site-tabs" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px'}}>
                                    <Logo t={this.props.t} admin={false}/>
                                    {/* ScrollNav + Blog share one flex strip so the blog link
                                        sits at the END of the nav with the same gap/uppercase
                                        treatment as section links. Blog is a real route, not
                                        an anchor — kept outside ScrollNav's IntersectionObserver. */}
                                    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                                        <ScrollNav
                                            links={this.state.tabProps.map(tp => ({
                                                key: tp.key,
                                                slug: tp.page.replace(/\s+/g, '-').toLowerCase(),
                                                label: translateOrKeep(this.props.t, tp.page),
                                            }))}
                                        />
                                        {this.state.blogEnabled && this.state.hasPosts && (
                                            <a
                                                href="/blog"
                                                className="scroll-nav-link"
                                                style={{textTransform: 'uppercase', textDecoration: 'none', fontWeight: 400, opacity: 0.7}}
                                            >
                                                {this.props.t('Blog')}
                                            </a>
                                        )}
                                    </div>
                                    <MobileNav
                                        links={[
                                            ...this.state.tabProps.map<MobileNavLink>(tp => ({
                                                key: tp.key,
                                                href: `#${tp.page.replace(/\s+/g, '-').toLowerCase()}`,
                                                label: translateOrKeep(this.props.t, tp.page),
                                            })),
                                            ...(this.state.blogEnabled && this.state.hasPosts ? [{key: 'blog', href: '/blog', label: this.props.t('Blog')}] : []),
                                        ]}
                                        activeKey={this.state.activeTab}
                                        onNavigate={(link) => {
                                            if (!link.href.startsWith('#')) {
                                                if (typeof window !== 'undefined') window.location.assign(link.href);
                                                return;
                                            }
                                            const slug = link.href.replace(/^#/, '');
                                            const el = document.getElementById(slug);
                                            if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
                                        }}
                                    />
                                    {items.length > 1 && (
                                        <Dropdown className="language-dropdown" overlayClassName="lang-popup" menu={{items}}>
                                            <Typography.Link>
                                                <Space size={6}>
                                                    {activeLang?.flag
                                                        ? <span className="lang-glyph" aria-hidden>{activeLang.flag}</span>
                                                        : <span className="lang-glyph lang-glyph--symbol">
                                                            {(activeLang?.symbol ?? this.props.i18n.language).toUpperCase()}
                                                          </span>
                                                    }
                                                    <span className="lang-label">
                                                        {activeLang?.label ?? this.props.i18n.language}
                                                    </span>
                                                </Space>
                                            </Typography.Link>
                                        </Dropdown>
                                    )}
                                </header>
                                <main id="main" tabIndex={-1} data-testid="main-landmark" style={{scrollBehavior: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}}>
                                    {this.state.tabProps.map(tp => (
                                        <section
                                            key={tp.key}
                                            id={tp.page.replace(/\s+/g, '-').toLowerCase()}
                                            aria-label={tp.page}
                                            style={{scrollMarginTop: 80}}
                                        >
                                            {tp.children}
                                        </section>
                                    ))}
                                </main>
                            </>
                        ) : (
                            // F1 sub-pages — the outer AntD `<Tabs>` was
                            // already decorative once `<Menu>` took over the
                            // nav. Render a plain header + active page content
                            // switcher instead. Tab transitions weren't doing
                            // anything visible before this either (no animation
                            // configured), so dropping them is a no-op for users.
                            (() => {
                                const menuPages: IMenuPage[] = this.state.pages.map((p: any) => ({
                                    id: p.id || p.page,
                                    page: p.page,
                                    parent: p.parent,
                                    slug: p.slug,
                                }));
                                const propsChain = this.props.slugChain ?? [];
                                const activePage: any = this.state.pages[activeKey];
                                const fallbackChain = activePage
                                    ? [(activePage.slug || activePage.page).toString().replace(/\s+/g, '-').toLowerCase()]
                                    : [];
                                const activeChain = propsChain.length > 0 ? propsChain : fallbackChain;
                                const themeName = (this.state.themeConfig as any)?.token?.themeName
                                    || (this.props.initialData?.themeTokens as any)?.themeSlug
                                    || (typeof document !== 'undefined' ? document.body.dataset.themeName : undefined);
                                const activeContent = this.state.tabProps[activeKey]?.children;
                                return (
                                    <div className="site-tabs">
                                        <div className="site-tabs-bar" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px'}}>
                                            <div className="site-tabs-left-cluster" style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                                <MobileNav
                                                    links={this.buildMobileLinks()}
                                                    activeKey={"" + activeKey}
                                                    onNavigate={(link) => {
                                                        this.setState({activeTab: link.key});
                                                        if (typeof window !== 'undefined') window.location.assign(link.href);
                                                    }}
                                                />
                                                <span className="site-tabs-left-cluster__logo">
                                                    <Logo t={this.props.t} admin={false}/>
                                                </span>
                                            </div>
                                            <div className="site-tabs-center-cluster" style={{display: 'flex', alignItems: 'center', gap: 16}}>
                                                <span className="site-tabs-center-cluster__logo">
                                                    <Logo t={this.props.t} admin={false}/>
                                                </span>
                                                <MainMenu
                                                    pages={menuPages}
                                                    activeChain={activeChain}
                                                    themeName={themeName}
                                                    translate={(s) => translateOrKeep(this.props.t, s) as string}
                                                    extraItems={
                                                        this.state.blogEnabled && this.state.hasPosts
                                                            ? [{key: 'blog', href: '/blog', label: this.props.t('Blog') as string}]
                                                            : undefined
                                                    }
                                                />
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                                <CustomerAccountDropdown/>
                                                {items.length > 1 && (
                                                    <Dropdown className="language-dropdown" overlayClassName="lang-popup" menu={{items}}>
                                                        <Typography.Link>
                                                            <Space size={6}>
                                                                {activeLang?.flag
                                                                    ? <span className="lang-glyph" aria-hidden>{activeLang.flag}</span>
                                                                    : <span className="lang-glyph lang-glyph--symbol">
                                                                        {(activeLang?.symbol ?? this.props.i18n.language).toUpperCase()}
                                                                    </span>
                                                                }
                                                                <span className="lang-label">
                                                                    {activeLang?.label ?? this.props.i18n.language}
                                                                </span>
                                                            </Space>
                                                        </Typography.Link>
                                                    </Dropdown>
                                                )}
                                            </div>
                                        </div>
                                        <div className="site-tabs-content">
                                            {activeContent}
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                        <SiteFooter
                            config={this.state.footer}
                            pages={this.state.pages.map(p => ({page: p.page}))}
                            hasPosts={this.state.hasPosts}
                            blogEnabled={this.state.blogEnabled}
                            t={this.props.t as any}
                            layoutMode={this.state.layoutMode}
                        />
                    </Spin>
                </ConfigProvider>
            </div>
            </PostsProvider>
        );
    }
}

/**
 * App-Router-shaped wrapper: pulls `t` / `i18n` / `pathname` from hooks
 * so callers (`app/page.tsx`, the future B4 `app/[...slug]/page.tsx`)
 * don't have to plumb them through props from a server component. Callers
 * pass only the data-driven props (`page`, `pageId`, `slugChain`,
 * `initialData`).
 */
export interface SiteShellPublicProps {
    page: string;
    pageId?: string;
    slugChain?: string[];
    initialData?: InitialPageData;
}

const SiteShell: React.FC<SiteShellPublicProps> = ({page, pageId, slugChain, initialData}) => {
    const {t, i18n} = useT('app');
    const pathname = usePathname();
    return (
        <LegacyAppClass
            page={page}
            pageId={pageId}
            slugChain={slugChain}
            initialData={initialData}
            t={t}
            i18n={i18n}
            pathname={pathname ?? ''}
        />
    );
};

export default SiteShell;
