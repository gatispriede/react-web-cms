import {Collection, Document, MongoClient} from 'mongodb'
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
    private readonly client!: MongoClient;
    private readonly sectionsDB!: Collection<Document>;
    private readonly navigationsDB!: Collection<Document>;

    constructor() {
        this._settings.mongoDBDatabaseUrl = `mongodb+srv://${this._settings.mongodbUser}:${this._settings.mongodbPassword}@${this._settings.mongoDBClusterUrl}`;
        const newClient = new MongoClient(this._settings.mongoDBDatabaseUrl, {
            tls: true,
            connectTimeoutMS: 500,
            maxConnecting: 5,
            maxIdleTimeMS: 5000,
            waitQueueTimeoutMS: 2000,
            tlsAllowInvalidCertificates: true
        });
        if (newClient) {
            this.client = newClient
            this.sectionsDB = this.client.db('Homepage').collection('Sections')
            this.navigationsDB = this.client.db('Homepage').collection('Navigation')
        }
    }

    async loadData(): Promise<ILoadData[]> {
        if (!this.client) {
            return []
        }
        const dbs = await this.client.db().admin().listDatabases();
        const databases = dbs.databases
        return databases
    }

    public async getNavigationCollection(): Promise<any> {
        const session = this.client.startSession()
        try {

            return await this.navigationsDB.find({type: 'navigation'}).toArray();
        } finally {
            await session.endSession()
        }
    }

    public async getSections({ids}: { ids: string[] }): Promise<any> {

        const session = this.client.startSession()
        try {
            const sections: ISection[] = []
            ids.map(id => {
                const section = this.sectionsDB.findOne({id: id}) as unknown as ISection
                sections.push(section)
            })

            return sections
        } finally {
            await session.endSession()
        }
    }

    public async removeSectionItem({id}: { id: string }) {
        const session = this.client.startSession()
        try {
            const sectionItem = await this.sectionsDB.findOne({id: id}) as unknown as ISection
            if (!sectionItem) {
                return 'no item with id: ' + id
            }
            let returnResult = ''
            if (sectionItem.page) {
                const navigationItem = await this.navigationsDB.findOne({
                        type: 'navigation',
                        page: sectionItem.page
                    }
                ) as unknown as INavigation
                const indexToRemove = navigationItem.sections.findIndex(v => v === id)
                if (indexToRemove > -1) {
                    navigationItem.sections.splice(indexToRemove, 1)
                    await this.navigationsDB.findOneAndUpdate({
                            type: 'navigation',
                            page: sectionItem.page
                        },
                        {$set: {sections: navigationItem.sections}}
                    )
                    returnResult += ' removing from ' + sectionItem.page + ' ' + sectionItem.id + ' at index: ' + indexToRemove
                }
            }
            const deleteResult = await this.sectionsDB.deleteOne({id: id})
            returnResult += "  " + JSON.stringify(deleteResult)
            return returnResult
        } finally {
            await session.endSession()
        }
    }

    public async addUpdateSectionItem({section, pageName}: {
        section: ISection,
        pageName?: string
    }): Promise<any> {
        const session = this.client.startSession()
        try {
            let response = {
                updateSection: {},
                createSection: {},
                updateNavigation: {}
            }

            if (section.id) {
                const result = await this.sectionsDB.findOneAndUpdate({id: section.id}, {$set: section})
                if (!result) {
                    return 'error, no section found with the ID provided'
                }
                response.updateSection = result
            } else {
                section.id = guid()
                const result = await this.sectionsDB.insertOne(section)
                response.createSection = result
                // @ts-ignore
                response.createSection.id = section.id
            }
            if (pageName) {
                section.page = pageName
                const navigationItem = await this.navigationsDB.findOne({
                    type: 'navigation',
                    page: pageName
                }) as unknown as INavigation
                if (navigationItem) {
                    const found = navigationItem.sections.find(v => v === section.id)
                    if (navigationItem && !found) {
                        navigationItem.sections.push(section.id)
                        const navigation = await this.navigationsDB.findOneAndUpdate({
                                type: 'navigation',
                                page: pageName
                            },
                            {$set: {sections: navigationItem.sections}}
                        )
                        // @ts-ignore
                        response.updateNavigation = navigation
                    }
                }

            }

            return JSON.stringify(response)
        } finally {
            await session.endSession()
        }
    }

    public async deleteNavigationItem({pageName}: { pageName: string }) {
        const session = this.client.startSession()
        try {
            const navigationItem = await this.navigationsDB.findOne({
                type: 'navigation',
                page: pageName
            }) as unknown as INavigation
            if (!navigationItem) {
                return 'no navigation found for page:' + pageName
            }
            const result = await this.navigationsDB.deleteOne({
                type: 'navigation',
                page: pageName
            })
            return JSON.stringify(result)
        } finally {
            await session.endSession()
        }
    }

    public async addUpdateNavigationItem({pageName, sections}: {
        pageName: string,
        sections?: string[]
    }): Promise<string> {
        const session = this.client.startSession()
        try {
            const navigationCollection = this.navigationsDB

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
                const result = await this.navigationsDB.insertOne(navigationItem)
                return JSON.stringify(result)
            } else {
                const result = await navigationCollection.findOneAndUpdate({
                    type: 'navigation',
                    page: pageName
                }, {$set: navigationItem})
                return JSON.stringify(result)
            }
        } finally {
            await session.endSession()
        }
    }

    public getMongoDBUri(): string {
        return this._settings.mongoDBDatabaseUrl
    }
}

export default MongoDBConnection