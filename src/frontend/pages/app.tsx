import React from 'react'
import {resolve} from "../gqty";
import {ConfigProvider, Dropdown, MenuProps, Space, Spin, Tabs, Typography} from 'antd';
import DynamicTabsContent from "../components/DynamicTabsContent";
import {IPage} from "../../Interfaces/IPage";
import staticTheme from '../theme/themeConfig';
import {buildThemeConfig} from '../theme/buildThemeConfig';
import {applyThemeCssVars} from '../theme/applyThemeCssVars';
import ThemeApi from '../api/ThemeApi';
import type {ThemeConfig} from 'antd';
import {IMongo} from "../../Interfaces/IMongo";
import MongoApi from '../api/MongoApi';
import {ISection} from "../../Interfaces/ISection";
import Logo from "../components/common/Logo";
import Link from 'next/link'
import Head from 'next/head'
import {i18n, TFunction} from "i18next";
import {INavigation} from "../gqty/schema.generated";
import {sanitizeKey} from "../../utils/stringFunctions";
import PublishApi from "../api/PublishApi";
import PostApi from "../api/PostApi";
import FooterApi from "../api/FooterApi";
import SiteFlagsApi from "../api/SiteFlagsApi";
import SiteFooter from "../components/common/SiteFooter";
import {DEFAULT_FOOTER, IFooterConfig} from "../../Interfaces/IFooter";
import type {InitialPageData} from "../lib/gqlFetch";
import {PostsProvider} from "../lib/PostsContext";

interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[],
    themeConfig?: ThemeConfig,
    footer: IFooterConfig,
    hasPosts: boolean,
    blogEnabled: boolean,
}

interface IHomeProps {
    page: string,
    t: TFunction<string, undefined>,
    i18n: i18n,
    pathname: string,
    initialData?: InitialPageData,
}

class App extends React.Component<IHomeProps> {
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

    componentDidMount() {
        if (this.props.initialData?.themeTokens) {
            applyThemeCssVars(this.props.initialData.themeTokens);
        }
    }

    buildStateFromInitialData(data: InitialPageData): IHomeState {
        const pages: IPage[] = (data.pages ?? []).map(p => ({
            page: p.page,
            seo: p.seo,
            sections: p.sections,
        }));
        const tabProps = pages.map((p, id) => ({
            key: String(id),
            page: p.page,
            seo: p.seo,
            label: (
                <Link className={'navigation-item'}
                      href={p.page.replace(/ /g, '-').toLowerCase()}>
                    {this.props.t(sanitizeKey(p.page))}
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
                        page: item.page,
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
        // if(typeof window === 'undefined'){
        //     // @ts-ignore
        //     cacheDataSource = global.preloadedData
        // }else{
        //     // @ts-ignore
        //     cacheDataSource = window.preloadedData
        // }
        let newState: IHomeState = {
            loading: false,
            pages: this.state.tabProps,
            tabProps: this.state.tabProps,
            activeTab: this.state.activeTab,
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
                page: n.page,
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
            // @ts-ignore
            // pages = cacheDataSource.pages
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
                        // @ts-ignore
                        // sectionsData = cacheDataSource.sectionsData[id]
                    } else {
                        // sectionsData = await this.getSectionData(pages, id as unknown as number)
                    }
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
                        seo: pages[id].seo,
                        label: (
                            <Link className={'navigation-item'}
                                  href={pages[id].page.replace(/ /g, '-').toLowerCase()}>{this.props.t(sanitizeKey(pages[id].page))}</Link>
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

    findIdForActiveTab() {
        const firstTab = this.state.tabProps[0] ? this.state.tabProps[0].page.replace(/ /g, '-').toLowerCase() : ''
        const propsPage = this.props.page !== '/' ? this.props.page : firstTab
        return this.state.tabProps.findIndex((tab) => {
            const tabUrl = encodeURIComponent(tab.page.replace(/ /g, '-')).toLowerCase()
            const propsUrl = encodeURIComponent(propsPage).toLowerCase()
            return tabUrl === propsUrl
        })
    }

    render() {
        const activeKey = this.findIdForActiveTab()
        const seo = this.state.tabProps[activeKey] ? this.state.tabProps[activeKey].seo : undefined;
        let items: MenuProps['items'] = [];
        if (this.languages) {
            const keys = Object.keys(this.languages)
            let currentUrl = this.props.pathname

            items = keys.map((key) => ({
                label: <a href={`/${this.languages[key].symbol}${currentUrl}`}>{this.languages[key].label}</a>,
                key: key
            }))
        }
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
                </Head>
                <ConfigProvider theme={this.state.themeConfig ?? staticTheme}>
                    <Spin spinning={this.state.loading}>
                        <Logo t={this.props.t} admin={false}/>
                        <Tabs onChange={(value) => {
                            this.setState({activeTab: value})
                        }} activeKey={"" + activeKey} defaultActiveKey={"0"} items={this.state.tabProps}/>
                        {items.length > 1 && this.languages && this.languages[this.props.i18n.language] && <div style={{
                            position: "absolute",
                            top: 10,
                            right: 20,
                        }}>
                            <Dropdown
                                className={'language-dropdown'}
                                menu={{
                                    items
                                }}>
                                <Typography.Link>
                                    <Space>
                                        {this.languages[this.props.i18n.language].label}
                                    </Space>
                                </Typography.Link>
                            </Dropdown>
                        </div>
                        }
                        <SiteFooter
                            config={this.state.footer}
                            pages={this.state.pages.map(p => ({page: p.page}))}
                            hasPosts={this.state.hasPosts}
                            blogEnabled={this.state.blogEnabled}
                            t={this.props.t as any}
                        />
                    </Spin>
                </ConfigProvider>
            </div>
            </PostsProvider>
        );
    }
};
export default App;