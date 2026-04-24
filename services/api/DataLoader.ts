
interface ISettings {
    apiKey: string;
    username: string;
    password: string;
    DB: string;
}

class DataLoader {
    private _settings: ISettings = {
        apiKey: '',
        DB: 'MAIN-DB',
        username: 'Admin',
        password: 'b[ua25cJW2PF'
    }
    constructor() {
        this.connectToDB()
    }

    async connectToDB() {

        console.log('Value: ')
        // await client.disconnect();
    }
    loadData(){
        // Implementation for loading data
    }
}

export default DataLoader