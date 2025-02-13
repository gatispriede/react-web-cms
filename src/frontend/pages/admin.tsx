import React from 'react'
import {INavigation, resolve} from "../gqty";
import {Spin, Tabs} from 'antd';
import AddNewDialogNavigation from "../components/common/Dialogs/AddNewDialogNavigation";
import DynamicTabsContent from "../components/DynamicTabsContent";
import EditWrapper from "../components/common/EditWrapper";
import {IPage} from "../../Interfaces/IPage";
import theme from '../theme/themeConfig';
import {ConfigProvider} from 'antd';
import {IMongo} from "../../Interfaces/IMongo";
import MongoApi from '../api/MongoApi';

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

interface IHomeState {
    loading: boolean,
    addNewDialogOpen: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[]
}

class admin extends React.Component {
    sections: any[] = []
    admin: boolean = true
    private MongoApi = new MongoApi()

    state: IHomeState = {
        loading: false,
        addNewDialogOpen: false,
        pages: [],
        tabProps: [],
        activeTab: '0'
    }

    constructor(props: {}) {
        super(props);
        this.state.loading = true
        void this.initialize(true)
    }

    onEdit = async (targetKey: TargetKey, action: 'add' | 'remove') => {
        if (action === 'add') {
            this.setState({addNewDialogOpen: true})
        } else {
            let page
            const newItems = this.state.tabProps.filter((item) => {
                if(item.key === targetKey){
                    page = item.page
                }
                return item.key !== targetKey
            });
            if(page){
                await this.MongoApi.deleteNavigation(page)
                this.setState({tabProps: newItems, activeTab: 1, loading: false})
            }
        }
    }

    async initialize(init: boolean = false): Promise<void> {
        let newState: IHomeState = {
            loading: false,
            addNewDialogOpen: false,
            pages: this.state.tabProps,
            tabProps: this.state.tabProps,
            activeTab: this.state.activeTab
        }
        if (init) {
            // this.state.loading = true
        } else {
            // this.setState({loading: true})
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
            }
        )
        const newTabsState = []
        if (pages[0]) {
            for (let id in pages) {
                if (pages[id]) {
                    const sectionsData: any[] = await this.MongoApi.loadSections(pages[id].page, pages)
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
                        label:
                            <div className={'navigation-container'}>
                                {pages[id].page}
                            </div>,
                        children: (
                            <DynamicTabsContent
                                page={pages[id].page}
                                admin={this.admin}
                                sections={sectionsData}
                                refresh={async () => {
                                    await this.initialize()
                                }}
                            />
                        )
                    })
                }
            }

        }
        newState.tabProps = newTabsState
        newState.pages = pages
        newState.loading = false
        this.setState(newState)
    }

    render() {
        console.log('here')
        return (
            <ConfigProvider theme={theme}>
                {/*<Spin spinning={this.state.loading}>*/}
                    <AddNewDialogNavigation
                        close={() => {
                            this.setState({addNewDialogOpen: false})
                        }}
                        open={this.state.addNewDialogOpen}
                        refresh={async () => {
                            await this.initialize()
                        }}
                    />
                    <Tabs
                        type="editable-card"
                        tabBarStyle={{
                            display: "flex",
                            justifyContent: "space-between",
                            textTransform: "uppercase"
                        }}
                        onEdit={this.onEdit}
                        onChange={(value) => {
                            this.setState({activeTab: value})
                        }}
                        activeKey={this.state.activeTab}
                        defaultActiveKey={"0"}
                        items={this.state.tabProps}/>
                {/*</Spin>*/}
            </ConfigProvider>
        );
    }
};

export default admin;