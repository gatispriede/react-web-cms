import { createClient, RedisClientType  } from 'redis';


class redisConnection {
    private client: RedisClientType | undefined;
    constructor() {
        this.connect()
    }
    public  async connect() {
        this.client = createClient({
            username: 'Admin',
            password: '=33323fF2a84c425cbf7',
            socket: {
                host: 'redis-10962.c304.europe-west1-2.gce.redns.redis-cloud.com',
                port: 10962
            }
        });
        this.client.on('error', err => console.log('Redis Client Error', err));

        await this.client.connect();

        await this.client.disconnect();
    }
    async getBar(): Promise<string| null> {
        console.log('called getBar')
        if(!this.client){
            return ''
        }
        await this.client.connect();
        const bar = await this.client.get('foo');
        await this.client.disconnect();
        return bar;
    }
}

export default redisConnection