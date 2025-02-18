import React from 'react'
import {INavigation, resolve} from "../gqty";
import {Spin, Tabs} from 'antd';
import DynamicTabsContent from "../components/DynamicTabsContent";
import {IPage} from "../../Interfaces/IPage";
import theme from '../theme/themeConfig';
import {ConfigProvider} from 'antd';
import {IMongo} from "../../Interfaces/IMongo";
import MongoApi from '../api/MongoApi';
import {ISection} from "../../Interfaces/ISection";

interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[]
}

class App extends React.Component<{}> {
    sections: any[] = []
    private MongoApi = new MongoApi()
    loadSections: any
    getNavigationListCache: any
    state: IHomeState = {
        loading: false,
        pages: [],
        tabProps: [],
        activeTab: '0'
    }

    constructor(props: {}) {
        super(props);
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
                    list.push({
                        page: item.page,
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
                        label: pages[id].page,
                        children:
                            <DynamicTabsContent
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

    render() {
        return (
            <div>
                <ConfigProvider theme={theme}>
                    <Spin spinning={this.state.loading}>
                        <Tabs onChange={(value) => {
                            this.setState({activeTab: value})
                        }} activeKey={this.state.activeTab} defaultActiveKey={"0"} items={this.state.tabProps}/>
                    </Spin>
                </ConfigProvider>
            </div>
        );
    }
};

export default App;