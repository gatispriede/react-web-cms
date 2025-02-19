import {Collection, Db, Document, MongoClient, WithId} from 'mongodb'
import guid from "../helpers/guid";
import {ISection} from "../Interfaces/ISection";
import {INavigation} from "../Interfaces/INavigation";
import IImage from "../Interfaces/IImage";
import fs from 'fs'

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
    mongoDBLocalUrl: string;
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
        mongoDBLocalUrl: 'mongodb://localhost:27017',
        mongoDBDatabaseUrl: ''
    }
    private client!: MongoClient;
    private db: Db | undefined;
    private sectionsDB!: Collection<Document>;
    private navigationsDB!: Collection<Document>;
    private imagesDB!: Collection<Document>;

    constructor() {
        this._settings.mongoDBDatabaseUrl = `mongodb+srv://${this._settings.mongodbUser}:${this._settings.mongodbPassword}@${this._settings.mongoDBClusterUrl}`;
        void this.setupClient()
    }

    async setupClient() {
        if (this.db) {
            await this.client.close()
        }
        const dbUrl: string = this._settings.mongoDBLocalUrl//process.env.NODE_ENV === 'production' ? this._settings.mongoDBDatabaseUrl : this._settings.mongoDBLocalUrl
        const newClient = new MongoClient(dbUrl, {
            retryReads: true,
            connectTimeoutMS: 500,
            maxIdleTimeMS: 5000,
            maxPoolSize: 20,
        });
        if (newClient) {
            this.db = newClient.db('Homepage')
            this.client = newClient
            this.sectionsDB = this.db.collection('Sections')
            this.navigationsDB = this.db.collection('Navigation')
            this.imagesDB = this.db.collection('Images')
        }
    }

    async deleteImage({id}: { id: string }) {
        let res = ''
        try {
            const image: IImage = await this.imagesDB.findOne({id: id}) as unknown as IImage

            if (image && image.name) {
                const deleteResult = await this.imagesDB.deleteOne({id: id})
                res = JSON.stringify({success: deleteResult})

                const existingFile = fs.existsSync(`src/frontend/public/images/${image.name}`);

                if (existingFile) {
                    fs.unlinkSync(`src/frontend/public/images/${image.name}`)
                }
            }

        } catch (err) {
            res = JSON.stringify({error: err})
            await this.setupClient()
        }
        return res
    }

    async saveImage({image}: { image: IImage }) {
        let res = ''
        try {
            const result = await this.imagesDB.insertOne(image)
            res = JSON.stringify({result: result})
        } catch (err) {
            res = JSON.stringify({error: err})
            await this.setupClient()
        }
        return res
    }

    async getImages({tags}: { tags: string }): Promise<any> {
        console.log(tags)
        let images: WithId<Document>[] = []
        try {
            images = await this.imagesDB.find({
                tags: tags
            }).toArray();
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return images
    }

    async loadData(): Promise<ILoadData[]> {
        if (!this.client) {
            return []
        }
        const dbs = await this.client.db().admin().listDatabases();
        const databases = dbs.databases
        return databases
    }

    public async updateNavigation({page, sections}: { page: string, sections: string[] }): Promise<string> {
        try {
            const result = await this.navigationsDB.findOneAndUpdate({
                type: 'navigation',
                page: page
            }, {$set: {sections: sections}});
            return JSON.stringify(result)
        } catch (err) {
            console.log(err)
            await this.setupClient()
            return 'Error while fetching navigation data'
        }
    }

    public async getNavigationCollection(): Promise<any> {
        let navList: WithId<Document>[] = []
        try {
            navList = await this.navigationsDB.find({type: 'navigation'}).toArray();
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return navList
    }

    public async getSections({ids}: { ids: string[] }): Promise<any> {
        const sections: ISection[] = []
        try {
            ids.map(id => {
                const section = this.sectionsDB.findOne({id: id}) as unknown as ISection
                sections.push(section)
            })
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return sections
    }

    public async removeSectionItem({id}: { id: string }) {
        let returnResult = ''
        try {
            const sectionItem = await this.sectionsDB.findOne({id: id}) as unknown as ISection
            if (!sectionItem) {
                return 'no item with id: ' + id
            }

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
            returnResult += JSON.stringify(deleteResult)
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return returnResult
    }

    public async addUpdateSectionItem({section, pageName}: {
        section: ISection,
        pageName?: string
    }): Promise<any> {
        let response = {
            updateSection: {},
            createSection: {},
            updateNavigation: {}
        }
        try {
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
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return JSON.stringify(response)
    }

    public async deleteNavigationItem({pageName}: { pageName: string }) {
        let result
        try {
            const navigationItem = await this.navigationsDB.findOne({
                type: 'navigation',
                page: pageName
            }) as unknown as INavigation
            if (!navigationItem) {
                return 'no navigation found for page:' + pageName
            }
            result = await this.navigationsDB.deleteOne({
                type: 'navigation',
                page: pageName
            })
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return JSON.stringify(result)
    }

    public async addUpdateNavigationItem({pageName, sections}: {
        pageName: string,
        sections?: string[]
    }): Promise<string> {
        let returnResult = ''
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
                returnResult = JSON.stringify(result)
            } else {
                const result = await navigationCollection.findOneAndUpdate({
                    type: 'navigation',
                    page: pageName
                }, {$set: navigationItem})
                returnResult = JSON.stringify(result)
            }
        } catch (err) {
            console.log(err)
            await this.setupClient()
        }
        return returnResult
    }

    public getMongoDBUri(): string {
        return this._settings.mongoDBDatabaseUrl
    }
}

export default MongoDBConnection