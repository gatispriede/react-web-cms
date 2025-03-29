import {Collection, Db, Document, MongoClient, WithId} from 'mongodb'
import guid from "../helpers/guid";
import {ISection} from "../Interfaces/ISection";
import {INavigation} from "../Interfaces/INavigation";
import IImage from "../Interfaces/IImage";
import fs from 'fs'
import {ILogo} from "../Interfaces/ILogo";
import {IUser} from "../Interfaces/IUser";
import {hash} from "bcrypt";
import {INewLanguage} from "../frontend/components/interfaces/INewLanguage";

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
    private _adminName = 'Admin'
    private _adminPassword = 'b[ua25cJW2PF'
    private _adminPasswordHash = '$2b$10$M57z68x.otaoDBIgn3J16OXnaISuGLBca6dFsH2RB3ggr6OUBzDJ2'
    private _hashSaltRounds = 10

    private client!: MongoClient;
    private db: Db | undefined;
    private sectionsDB!: Collection<Document>;
    private navigationsDB!: Collection<Document>;
    private imagesDB!: Collection<Document>;
    private entitiesDB!: Collection<Document>;
    private usersDB!: Collection<Document>;

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
            this.entitiesDB = this.db.collection('Entities')
            this.usersDB = this.db.collection('Users')
        }
    }

    async setupAdmin(): Promise<IUser | undefined> {
        try {
            const user: IUser = await this.usersDB.findOne({name: this._adminName}) as unknown as IUser
            if (!user) {
                await this.usersDB.insertOne({
                    id: guid(),
                    name: this._adminName,
                    email: 'admin@admin.com',
                    password: this._adminPasswordHash
                })
            }
            return user
        } catch (err) {
            console.error('Error getting user:', err)
            await this.setupClient()
            return undefined
        }
    }

    async addUser({user}: { user: IUser }): Promise<IUser | undefined> {
        user.password = await hash(user.password, this._hashSaltRounds)
        try {
            return await this.usersDB.insertOne(user) as unknown as IUser
        } catch (err) {
            console.error('Error getting user:', err)
            await this.setupClient()
            return undefined
        }
    }

    async getLanguages(): Promise<INewLanguage[] | string> {
        let error: any;
        try {
            const languages: any = await this.entitiesDB.findOne({type: 'languages'})
            const returnData: INewLanguage[] = []
            if (languages && languages.content){
                const keys = Object.keys(languages.content);
                keys.map(key => {
                    if (languages.content[key])
                        returnData.push(languages.content[key])
                })
            }
            console.log(returnData)
            return returnData
        } catch (err) {
            console.error('Error saving language:', err)
            await this.setupClient()
            error = err
        }
        return JSON.stringify({error: error})
    }

    async addUpdateLanguage({language}: { language: INewLanguage }): Promise<string> {
        let res: any
        let error: any;
        try {
            let languages: any = await this.entitiesDB.findOne({type: 'languages'}) as unknown as INewLanguage
            if (languages === null) {
                languages = {
                    type: 'languages',
                    content: {language}
                }
                languages[language.symbol] = language
                res = await this.entitiesDB.insertOne(languages)
            } else {
                languages.content[language.symbol] = language
                res = await this.entitiesDB.updateOne({type: 'languages'}, {$set: {content: languages.content}})
            }
        } catch (err) {
            console.error('Error saving language:', err)
            await this.setupClient()
            error = err
        }
        return JSON.stringify({success: res, error: error})
    }

    async getUser({email}: { email: string }): Promise<IUser | undefined> {
        try {
            return await this.usersDB.findOne({email: email}) as unknown as IUser
        } catch (err) {
            console.error('Error getting user:', err)
            await this.setupClient()
            return undefined
        }
    }

    async saveLogo({content}: { content: string }) {
        let res, error;
        try {
            res = await this.entitiesDB.findOneAndUpdate({type: 'logo'}, {$set: {content: content}})
        } catch (err) {
            console.error('Error saving logo:', err)
            await this.setupClient()
            error = err
        }
        return JSON.stringify({success: res, error: error})
    }

    async getLogo() {
        try {
            const logoInDB: ILogo = await this.entitiesDB.findOne({type: 'logo'}) as unknown as ILogo
            if (logoInDB) {
                return logoInDB
            }
            const content = {
                src: '',
                alt: '',
                type: 'logo',
                width: '40',
                height: '40'
            }
            const newLogo = {
                id: guid(),
                type: 'logo',
                content: JSON.stringify(content)
            }
            await this.entitiesDB.insertOne(newLogo)
            return await this.entitiesDB.findOne({type: 'logo'})
        } catch (err) {
            console.error('Error getting logo:', err)
            await this.setupClient()
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

    public async createNavigation({navigation}: { navigation: INavigation }) {
        try {
            const existingNavigation = await this.navigationsDB.findOne({
                page: navigation.page
            })
            if (!existingNavigation) {
                const result = await this.navigationsDB.insertOne(navigation)
                return JSON.stringify(result)
            }
            return JSON.stringify(existingNavigation)
        } catch (err) {
            console.log(err)
            await this.setupClient()
            return 'Error while fetching navigation data'
        }
    }

    public async replaceUpdateNavigation({oldPageName, navigation}: {
        oldPageName: string,
        navigation: INavigation
    }): Promise<string> {
        try {
            let result: { navigation: any, sections: any } = {
                navigation: undefined,
                sections: undefined
            }
            if (oldPageName === navigation.page) {
                result.navigation = await this.navigationsDB.findOneAndUpdate({
                    type: 'navigation',
                    id: navigation.id
                }, {$set: navigation});
            } else {
                result.sections = await this.navigationsDB.updateMany({
                    page: oldPageName
                }, {$set: {page: navigation.page}});

                result.navigation = await this.navigationsDB.findOneAndUpdate({
                    type: 'navigation',
                    id: navigation.id
                }, {$set: navigation});
            }
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
            for (let id in ids) {
                const section = await this.sectionsDB.findOne({id: ids[id]}) as unknown as ISection
                //@todo remove for update
                if (section && section.content && section.content.map) {
                    section.content = section.content.map(item => {
                        if (!item.style) {
                            item.style = 'default'
                        }
                        return item
                    })
                }
                if (section) sections.push(section)
            }
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
                    seo: {},
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