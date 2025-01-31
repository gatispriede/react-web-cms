import React from 'react'
import {Tabs} from "@chakra-ui/react"
import {Provider} from "../components/ui/provider";
import DynamicTabsContent from "../components/DynamicTabsContent";
import AddNewDialogNavigation from "../components/common/AddNewDialog";
import EditWrapper from "../components/common/EditWrapper";
import {resolve} from "../gqty";

class Home extends React.Component {
    private _activeTab = 'home'

    url: string = 'http://localhost:9000'
    pages: any[] = []
    sections: any[] = []

    state = {
        loading: false
    }

    constructor(props) {
        super(props);
        this.initialize()
    }

    async initialize() {
        this.setState({loading: true});
        this.pages = await resolve(
            ({query}) => {
                const list = []
                query.mongo.getNavigationCollection.map(item => {
                    list.push({
                        page: item.page,
                        sections: item.sections
                    })
                })
                return list
            },
        );
        this._activeTab = this.pages[0].page || ''
        await this.loadSections(this._activeTab)
        this.setState({loading: false});
    }

    async loadSections(pageName: string) {
        const page = this.pages.find(p => p.page === pageName)
        this._activeTab = pageName
        if (page) {
            const sectionIds = page.sections
            if (sectionIds) {
                this.setState({loading: true});
                this.sections = await resolve(
                    ({query, mutation}) => {
                        const list = []
                        query.mongo.getSections({ids: sectionIds}).map(item => {
                            let content = []
                            content = item.content.map(value => {
                                return {
                                    type: value.type,
                                    content: value.content,
                                    name: value.name
                                }
                            })
                            list.push({
                                name: item.name,
                                content: content,
                                type: item.type,
                            })
                        })
                        return list
                    },
                );
                this.setState({loading: false});
            }
        }
    }

    render() {
        return (
            <Provider>
                <Tabs.Root
                    key={"root"}
                    value={this._activeTab}
                    onValueChange={
                        (e) => {
                            this.loadSections(e.value)
                        }
                    }
                    defaultValue={this._activeTab}>
                    <Tabs.List>
                        {
                            this.pages.map(item => {
                                    return (
                                        <Tabs.Trigger key={`tab-${item.page}`} value={item.page}>
                                            <EditWrapper>
                                                <h1>{item.page}</h1>
                                            </EditWrapper>
                                        </Tabs.Trigger>
                                    )
                                }
                            )
                        }
                        {
                            <div>
                                <AddNewDialogNavigation/>
                            </div>
                        }
                    </Tabs.List>
                    {this.pages.map((item: { page: string; sections: any[]; }) => {
                        return (
                            <Tabs.Content key={`content-${item.page}`} value={item.page}>
                                <DynamicTabsContent sections={this.sections}/>
                            </Tabs.Content>
                        )
                    })
                    }
                </Tabs.Root>
            </Provider>

        );
    }
};

export default Home;