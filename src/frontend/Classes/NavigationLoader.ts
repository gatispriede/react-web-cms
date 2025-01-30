import {resolve} from "../gqty/index";
export class NavigationLoader {
    url: string = 'http://localhost:9000'
    pages: any[] = []
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
            // Optionally override client options per query
            {
                cachePolicy: "no-cache",
                operationName: "FooBarQuery",
            }
        );
        this.loading(false)
    }

}