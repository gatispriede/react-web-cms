import React from 'react'
import {INavigation, resolve} from "../gqty";
import {Spin, Tabs} from 'antd';
import DynamicTabsContent from "../components/DynamicTabsContent";
import {IPage} from "../../Interfaces/IPage";
import theme from '../theme/themeConfig';
import {ConfigProvider} from 'antd';
import {IMongo} from "../../Interfaces/IMongo";
import MongoApi from '../api/MongoApi';

interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[]
}

class App extends React.Component<{}> {
    sections: any[] = []
    private MongoApi = new MongoApi()
    state: IHomeState = {
        loading: false,
        pages: [],
        tabProps: [],
        activeTab: '0'
    }

    constructor(props: {}) {
        super(props);
        this.state.loading = true
        void this.initialize(true)
    }

    async initialize(init: boolean = false): Promise<void> {
        let newState: IHomeState = {
            loading: false,
            pages: this.state.tabProps,
            tabProps: this.state.tabProps,
            activeTab: this.state.activeTab
        }
        if (init) {
            this.state.loading = true
        } else {
            this.setState({loading: true})
        }
        const pages = await resolve(
            ({query}) => {
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
        if (pages[0]) {
            const newTabsState = []
            for (let id in pages) {
                if (pages[id]) {
                    const sectionsData: any[] = await this.MongoApi.loadSections(pages[id].page, pages)
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
            <ConfigProvider theme={theme}>
                <Spin spinning={this.state.loading}>
                    <Tabs onChange={(value) => {
                        this.setState({activeTab: value})
                    }} activeKey={this.state.activeTab} defaultActiveKey={"0"} items={this.state.tabProps}/>
                </Spin>
            </ConfigProvider>
        );
    }
};

export default App;