import React from 'react'
import {resolve} from "../gqty";
import {Spin, Tabs} from 'antd';
import DynamicTabsContent from "../components/DynamicTabsContent";
import {IPage} from "../../Interfaces/IPage";
import theme from '../theme/themeConfig';
import {ConfigProvider} from 'antd';
import {IMongo} from "../../Interfaces/IMongo";
import MongoApi from '../api/MongoApi';
import {ISection} from "../../Interfaces/ISection";
import Logo from "../components/common/Logo";
import Link from 'next/link'
import Head from 'next/head'
import {GetServerSideProps} from "next";
import {serverSideTranslations} from "next-i18next/serverSideTranslations";
import {TFunction} from "i18next";
import {INavigation} from "../gqty/schema.generated";
interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[]
}

class App extends React.Component<{ page: string, t: TFunction<string, undefined> }> {
    sections: any[] = []
    private MongoApi = new MongoApi()
    loadSections: any
    getNavigationListCache: any
    page: string
    state: IHomeState = {
        loading: false,
        pages: [],
        tabProps: [],
        activeTab: '0'
    }

    constructor(props: { page: string, t: TFunction<string, undefined> }) {
        super(props);
        this.page = props.page
        this.state.loading = true
        this.loadSections = this.MongoApi.loadSections
        this.getNavigationListCache = this.getNavigationList
        void this.initialize(true)
    }

    async getSectionData(pages: IPage[], id: number): Promise<ISection[]> {
        return await this.loadSections(pages[id].page, pages)
    }

    async getNavigationList(): Promise<IPage[]> {
        return await resolve(
            ({query}): IPage[] => {
                const list: any[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                    let itemSeo
                    if(item.seo){
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
                    list.push({
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
            activeTab: this.state.activeTab
        }
        if (init) {
            // eslint-disable-next-line react/no-direct-mutation-state
            this.state.loading = true
        } else {
            this.setState({loading: true})
        }
        let pages: IPage[];
        pages = await this.getNavigationList()
        // @ts-ignore
        if(cacheDataSource){
            // @ts-ignore
            // pages = cacheDataSource.pages
        }else{
            // pages = await this.getNavigationList()
        }
        if (pages[0]) {
            const newTabsState = []
            for (let id in pages) {
                if (pages[id]) {
                    let sectionsData: ISection[];
                    sectionsData = await this.getSectionData(pages, id as unknown as number)
                    // @ts-ignore
                    if(cacheDataSource){
                        // @ts-ignore
                        // sectionsData = cacheDataSource.sectionsData[id]
                    }else{
                        // sectionsData = await this.getSectionData(pages, id as unknown as number)
                    }
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
                        seo: pages[id].seo,
                        label: (
                            <Link href={pages[id].page.replace(/ /g,'-').toLowerCase()}>{pages[id].page}</Link>
                        ),
                        children:
                            <DynamicTabsContent
                                t={this.props.t}
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

        newState.pages = pages
        newState.loading = false
        this.setState(newState)
    }
    findIdForActiveTab(){
        const firstTab = this.state.tabProps[0] ? this.state.tabProps[0].page.replace(/ /g,'-').toLowerCase() : ''
        const propsPage = this.props.page !== '/' ? this.props.page : firstTab
        return this.state.tabProps.findIndex((tab) => {
            const tabUrl = encodeURIComponent(tab.page.replace(/ /g,'-')).toLowerCase()
            const propsUrl = encodeURIComponent(propsPage).toLowerCase()
            return tabUrl === propsUrl
        })
    }

    render() {
        const activeKey = this.findIdForActiveTab()
        const seo = this.state.tabProps[activeKey] ? this.state.tabProps[activeKey].seo : undefined
        return (
            <div>
                <Head>
                    <title>{this.state.tabProps[activeKey] ? this.state.tabProps[activeKey].page : ''}</title>
                    <meta property="og:title" content={this.props.page} key="title" />
                    {seo && seo.description &&
                        <meta property="og:description" content={seo.description} key="description" />
                    }
                    {seo && seo.keywords &&
                        <meta property="og:keywords" content={seo.keywords.join()} key="keywords" />
                    }
                    {seo && seo.viewport &&
                        <meta property="og:viewport" content={seo.viewport} key="viewport" />
                    }
                    {seo && seo.charSet &&
                        <meta property="og:charSet" content={seo.charSet} key="charSet" />
                    }
                    {seo && seo.url &&
                        <meta property="og:url" content={seo.url} key="url" />
                    }
                    {seo && seo.image &&
                        <meta property="og:image" content={seo.image} key="image" />
                    }
                    {seo && seo.image_alt &&
                        <meta property="og:image_alt" content={seo.image_alt} key="image_alt" />
                    }
                    {seo && seo.author &&
                        <meta property="og:author" content={seo.author} key="author" />
                    }
                    {seo && seo.locale &&
                        <meta property="og:locale" content={seo.locale} key="locale" />
                    }
                </Head>
                <ConfigProvider theme={theme}>
                    <Spin spinning={this.state.loading}>
                        <Logo t={this.props.t} admin={false}/>
                        <Tabs onChange={(value) => {
                            this.setState({activeTab: value})
                        }} activeKey={"" + activeKey} defaultActiveKey={"0"} items={this.state.tabProps}/>
                    </Spin>
                </ConfigProvider>
            </div>
        );
    }
};
export const getServerSideProps: GetServerSideProps<{ }> = async ({locale,}) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'en', [
            'common',
        ])),
    },
})
export default App;