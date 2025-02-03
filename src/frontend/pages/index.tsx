import React from 'react'
import {INavigation, resolve} from "../gqty";
import {Tabs} from 'antd';
import AddNewDialogNavigation from "../components/common/AddNewDialogNavigation";
import DynamicTabsContent from "../components/DynamicTabsContent";
import EditWrapper from "../components/common/EditWrapper";

class Home extends React.Component {
    url: string = 'http://localhost:9000'
    pages: any[] = []
    sections: any[] = []

    state = {
        loading: false,
        tabProps: []
    }

    constructor(props: {}) {
        super(props);
        this.initialize()
    }

    async initialize(): Promise<void> {
        this.setState({loading: true});
        this.pages = await resolve(
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
        );
        if (this.pages[0]) {
            const newTabsState = []
            for (let id in this.pages) {
                if(this.pages[id]){
                    const sectionsData = await this.loadSections(this.pages[id].page)
                    newTabsState.push({
                        key: id,
                        label: <EditWrapper deleteAction={() => {
                            this.deleteNavigation(this.pages[id].page)
                            this.initialize()
                        }}>{this.pages[id].page}</EditWrapper>,
                        children: <DynamicTabsContent refresh={() => {
                            this.initialize()
                        }} sections={sectionsData} page={this.pages[id].page}/>
                    })
                }
            }
            newTabsState.push({
                key: 'add',
                label: <AddNewDialogNavigation refresh={() => {this.initialize()}}/>,
            })
            this.setState({tabProps: newTabsState})
        }

        this.setState({loading: false});
    }

    async loadSections(pageName: string) {
        const page = this.pages.find(p => p.page === pageName)
        if (page) {
            const sectionIds = page.sections
            if (sectionIds.length > 0) {
                return await resolve(
                    ({query, mutation}) => {
                        const list = []
                        query.mongo.getSections({ids: sectionIds}).map(item => {
                            let content = [];
                            if(!item){
                                return
                            }
                            content = item.content.map(value => {
                                return {
                                    type: value.type,
                                    content: value.content,
                                    name: value.name
                                }
                            })
                            list.push({
                                id: item.id,
                                content: content,
                                type: item.type,
                            })
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
            for(let id in sections) {
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
        this.initialize()
    }

    render() {
        return (
            <div>
                <Tabs defaultActiveKey={"0"} items={this.state.tabProps}/>
            </div>
        );
    }
};

export default Home;