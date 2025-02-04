import React from 'react'
import {INavigation, resolve} from "../gqty";
import {Tabs} from 'antd';
import AddNewDialogNavigation from "../components/common/AddNewDialogNavigation";
import DynamicTabsContent from "../components/DynamicTabsContent";
import EditWrapper from "../components/common/EditWrapper";
import {IPage} from "../Interfaces/IPage";

interface IHomeState {
    loading: boolean,
    activeTab: string,
    pages: IPage[],
    tabProps: any[]
}

class Home extends React.Component {
    url: string = 'http://localhost:9000'
    sections: any[] = []

    state: IHomeState = {
        loading: false,
        pages: [],
        tabProps: [],
        activeTab: ''
    }

    constructor(props: {}) {
        super(props);
        this.initialize()
    }

    async initialize(): Promise<void> {
        this.setState({loading: true})
        const pages = await resolve(
            ({query}) => {
                const list: any[] = []
                query.mongo.getNavigationCollection.map((item: INavigation) => {
                    list.push({
                        page: item.page,
                        sections: item.sections
                    })
                })
                return list
            },
        )
        this.setState({pages: pages});
        if (pages[0]) {
            const newTabsState = []
            for (let id in pages) {
                if (pages[id]) {
                    const sectionsData = await this.loadSections(pages[id].page, pages)
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
                        label: <EditWrapper deleteAction={() => {
                            this.deleteNavigation(pages[id].page)
                            this.initialize()
                        }}>{pages[id].page}</EditWrapper>,
                        children: <DynamicTabsContent refresh={() => {
                            this.initialize()
                        }} sections={sectionsData} page={pages[id].page}/>
                    })
                }
            }
            newTabsState.push({
                key: 'add',
                label: <AddNewDialogNavigation refresh={() => {
                    this.initialize()
                }}/>,
            })
            this.setState({tabProps: newTabsState})
        }
        this.setState({loading: false})

    }

    async loadSections(pageName: string, pages?: IPage[]) {
        let page
        if (pages) {
            page = pages.find(p => p.page === pageName)
        } else {
            page = this.state.pages.find(p => p.page === pageName)
        }
        if (page) {
            const sectionIds = page.sections
            if (sectionIds.length > 0) {
                return await resolve(
                    ({query}) => {
                        const list = query.mongo.getSections({ids: sectionIds}).map(item => {
                            let content = [];
                            if (!item) {
                                return
                            }
                            content = item.content.map(value => {
                                return {
                                    type: value.type,
                                    content: value.content,
                                    name: value.name
                                }
                            })
                            return {
                                id: item.id,
                                page: item.page,
                                content: content,
                                type: item.type,
                            }
                        })
                        return list
                    },
                );
            }
        }
        return []
    }

    async deleteNavigation(pageName: string) {
        const navigationItem = await resolve(
            ({query}) => {
                return query.mongo.getNavigationCollection.find(item => item.page === pageName)
            },
        )
        const sections = navigationItem.sections
        if (sections && sections.length > 0) {
            for (let id in sections) {
                await resolve(
                    ({mutation}) => {
                        return mutation.mongo?.removeSectionItem({id: sections[id]})
                    },
                );
            }

        }
        await resolve(
            ({mutation}) => {
                const update = {
                    pageName: pageName
                }
                return mutation.mongo.deleteNavigationItem(update)
            },
        );
        const tab = this.state.tabProps.find(tab => tab.page === pageName)
        if (tab) {
            this.state.tabProps.splice(this.state.tabProps.indexOf(tab), 1)
            this.setState({tabProps: this.state.tabProps})
        }
        this.initialize()
    }

    render() {
        return (
            <div>
                {this.state.loading ? <div>Loading...</div> :
                    <Tabs onChange={(value) => {
                        this.setState({activeTab: value})
                    }} activeKey={this.state.activeTab} defaultActiveKey={"0"} items={this.state.tabProps}/>
                }

            </div>
        );
    }
};

export default Home;