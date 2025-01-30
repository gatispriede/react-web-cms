import {resolve} from "../gqty";

export class NavigationLoader {
    url: string = 'http://localhost:9000'
    activePage: string
    pages: any[] = []
    sections: any[] = []
    loading: any

    constructor(setLoading) {
        this.loading = setLoading
        this.initialize()
    }

    async initialize() {
        this.loading(true)
        this.pages = await resolve(
            ({ query }) => {
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
        this.activePage = this.pages[0].page || ''
        await this.loadSections(this.activePage)
        this.loading(false)
    }
    async loadSections(pageName: string){
        const page = this.pages.find(p => p.page === pageName)
        this.activePage = pageName
        if(page){
            const sectionIds = page.sections
            if(sectionIds){
                this.loading(true)
                this.sections = await resolve(
                    ({ query }) => {
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
                this.loading(false)
            }
        }
    }

}