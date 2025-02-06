import {MongoClient} from 'mongodb'
import guid from "../helpers/guid";
import {ISection} from "../Interfaces/ISection";
import {INavigation} from "../Interfaces/INavigation";

interface ISettings {
    apiKey: string;
    username: string;
    password: string;
    DB: string;
    mongodb: string;
    mongodbUser: string;
    mongodbPassword: string;
    mongoDBClusterUrl: string;
    mongoDBDatabaseUrl: string;
}

export interface ILoadData {
    name: string
    sizeOnDisk?: number | undefined
    empty?: boolean | undefined
}

class MongoDBConnection {
    private _settings: ISettings = {
        apiKey: '',
        DB: 'MAIN-DB',
        username: 'Admin',
        password: 'b[ua25cJW2PF',
        mongodb: 'Cluster',
        mongodbUser: 'admin',
        mongodbPassword: 'AMd011wAQNN3eWwP',
        mongoDBClusterUrl: 'cluster.0fmyz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster',
        mongoDBDatabaseUrl: ''
    }
    private client: MongoClient | undefined

    constructor() {
        this.connectToDB()
    }

    async connectToDB() {
        this._settings.mongoDBDatabaseUrl = `mongodb+srv://${this._settings.mongodbUser}:${this._settings.mongodbPassword}@${this._settings.mongoDBClusterUrl}`;
        const newClient = new MongoClient(this._settings.mongoDBDatabaseUrl);
        if (newClient) {
            this.client = newClient
        }
    }

    async loadData(): Promise<ILoadData[]> {
        if (!this.client) {
            return []
        }
        await this.client.connect();
        const dbs = await this.client.db().admin().listDatabases();
        const databases = dbs.databases
        return databases
    }

    public handleMongoActions(err: any, res: { insertedCount: string; }): void {
        if (err) throw err;
        console.log("Number of records inserted: " + res.insertedCount);
    }

    public async getNavigationCollection(): Promise<any> {
        if (!this.client) {
            return 0
        }
        const navigationCollection = await this.client.db('Homepage').collection('Navigation').find({type: 'navigation'}).toArray();
        await this.client.close()

        return navigationCollection
    }
    public async getSections({ids}: {ids: string[]}): Promise<any> {
        if (!this.client) {
            return 0
        }
        const sections: ISection[] = []
        const sectionsDB = await this.client.db('Homepage').collection('Sections')
        ids.map(id => {
            const section = sectionsDB.findOne({id: id}) as unknown as ISection
            sections.push(section)
        })

        return sections
    }

    public async removeSectionItem({id}: {id: string}) {
        if (!this.client) {
            console.log('no client')
            return 'no client'
        }
        const sectionItem = await this.client.db('Homepage').collection('Sections').findOne({id: id}) as unknown as ISection
        if(!sectionItem){
            return 'no item with id: ' + id
        }
        let returnResult = ''
        if(sectionItem.page){
            const navigationItem = await this.client.db('Homepage').collection('Navigation').findOne({
                    type: 'navigation',
                    page: sectionItem.page
                }
            ) as unknown as INavigation
            const indexToRemove = navigationItem.sections.findIndex(v => v === id)
            if(indexToRemove > -1){
                navigationItem.sections.splice(indexToRemove, 1)
                await this.client.db('Homepage').collection('Navigation').findOneAndUpdate({
                    type: 'navigation',
                    page: sectionItem.page
                },
                    {$set: {sections: navigationItem.sections}}
                )
                returnResult += ' removing from ' + sectionItem.page + ' ' + sectionItem.id + ' at index: ' + indexToRemove
            }
        }
        const deleteResult = await this.client.db('Homepage').collection('Sections').deleteOne({id: id})
        returnResult += "  " + JSON.stringify(deleteResult)
        return returnResult
    }

    public async addUpdateSectionItem({section, pageName}: {
        section: ISection,
        pageName?: string
    }): Promise<any> {
        if (!this.client) {
            console.log('no client')
            return 'no client'
        }
        let response = {
            updateSection: {},
            createSection: {},
            updateNavigation: {}
        }

        if (section.id) {
            const result = await this.client.db('Homepage').collection('Sections').findOneAndUpdate({id: section.id}, {$set: section})
            if(!result){
                return 'error, no section found with the ID provided'
            }
            response.updateSection = result
        } else {
            section.id = guid()
            const result = await this.client.db('Homepage').collection('Sections').insertOne(section)
            response.createSection = result
            // @ts-ignore
            response.createSection.id = section.id
        }
        if (pageName) {
            section.page = pageName
            const navigationItem = await this.client.db('Homepage').collection('Navigation').findOne({
                type: 'navigation',
                page: pageName
            }) as unknown as INavigation
            if(navigationItem){
                const found = navigationItem.sections.find(v => v === section.id)
                if (navigationItem && !found) {
                    navigationItem.sections.push(section.id)
                    const navigation = await this.client.db('Homepage').collection('Navigation').findOneAndUpdate({
                            type: 'navigation',
                            page: pageName
                        },
                        {$set: {sections: navigationItem.sections}}
                    )
                    response.updateNavigation = navigation
                }
            }

        }

        return JSON.stringify(response)

    }

    public async deleteNavigationItem({pageName}: { pageName: string }) {
        if (!this.client) {
            console.log('no client')
            return 'no client'
        }
        const navigationItem = await this.client.db('Homepage').collection('Navigation').findOne({
            type: 'navigation',
            page: pageName
        }) as unknown as INavigation
        if (!navigationItem) {
            return 'no navigation found for page:'+ pageName
        }
        const result = await this.client.db('Homepage').collection('Navigation').deleteOne({
            type: 'navigation',
            page: pageName
        })
        return JSON.stringify(result)
    }

    public async addUpdateNavigationItem({pageName, sections}: {
        pageName: string,
        sections?: string[]
    }): Promise<string> {
        if (!this.client) {
            console.log('no client')
            return 'no client'
        }
        const navigationCollection = this.client.db('Homepage').collection('Navigation')

        const navigationItemInDb = await navigationCollection.findOne({
            type: 'navigation',
            page: pageName
        })

        let navigationItem: INavigation
        if (!navigationItemInDb) {
            navigationItem = {
                id: guid(),
                type: 'navigation',
                page: pageName,
                sections: []
            }
        } else {
            navigationItem = navigationItemInDb as unknown as INavigation
        }

        if (sections) {
            navigationItem.sections = sections
        }

        if (!navigationItemInDb) {
            const result = await this.client.db('Homepage').collection('Navigation').insertOne(navigationItem)
            return JSON.stringify(result)
        } else {
            const result = await navigationCollection.findOneAndUpdate({
                type: 'navigation',
                page: pageName
            }, {$set: navigationItem})
            return JSON.stringify(result)
        }
    }

    public getMongoDBUri(): string {
        return this._settings.mongoDBDatabaseUrl
    }
}

export default MongoDBConnection