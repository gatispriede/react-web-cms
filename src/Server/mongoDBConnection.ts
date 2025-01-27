import {MongoClient} from 'mongodb'

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

enum ELineType {
    single = "single",
    double = "double",
    tripple = "tripple",
    quadrupple = "quadrupple"
}

enum EItemType {
    Text,
    Image,
    Carousel
}

interface IItem {
    name: string;
    type: EItemType;
    content: string;
}

interface ILine {
    type: ELineType,
    content: IItem[]
}

interface ICollection {
    name: string;
    lines: ILine[]
}

interface IPage {
    name: string;
    collections: ICollection[]
}

interface INavigation {
    id: number
    name: string;
    value: string,
    page: IPage
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

        console.log(navigationCollection)

        return navigationCollection
    }

    public async addNavigationItem({pageName, collections}: { pageName: string, collections?: ICollection[] }): Promise<string> {
        if (!this.client) {
            console.log('no client')
            return 'no client'
        }
        let newCollections: ICollection[] = []
        if (collections) {
            newCollections = collections
        } else {
            newCollections = [
                {
                    name: 'Collection 1',
                    lines: [
                        {
                            type: ELineType.double,
                            content: [
                                {
                                    name: 'Item 1',
                                    type: EItemType.Text,
                                    content: 'Text content'
                                },
                                {
                                    name: 'Item 2',
                                    type: EItemType.Image,
                                    content: 'Image content'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        let nav: { type: string, page: string, content: INavigation } | undefined = undefined

        const navigationCollection = this.client.db('Homepage').collection('Navigation')

        const navigation = await navigationCollection.findOne({
            type: 'navigation',
            page: pageName
        })

        if(!collections){
            nav = {
                type: 'navigation',
                page: pageName,
                content: {
                    id: 1,
                    name: pageName,
                    value: pageName,
                    page: {
                        name: 'test',
                        collections: newCollections
                    }
                }
            }
        }else{
            nav = {
                type: 'navigation',
                page: pageName,
                content: {
                    id: 1,
                    name: pageName,
                    value: pageName,
                    page: {
                        name: 'test',
                        collections: newCollections
                    }
                }
            }
        }

        if (navigation === null) {
            const result = await this.client.db('Homepage').collection('Navigation').insertOne(nav)
            console.log('create a new entry:',result)
            return 'create a new entry:' + JSON.stringify(result)
        }else{
            const result = await navigationCollection.findOneAndUpdate({
                type: 'navigation',
                page: pageName
            }, {$set: nav})
            return 'update existing entry: ' + JSON.stringify(result)
        }
    }

    public getMongoDBUri(): string {
        return this._settings.mongoDBDatabaseUrl
    }
}

export default MongoDBConnection