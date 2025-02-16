import * as https from "node:https";
import { readFileSync } from 'fs';
import next from 'next';
import {parse} from 'url';

const port = 443
const dev = false;
const app = next({ dev, dir: 'src/frontend' })
const handle = app.getRequestHandler()


const options = {
    key: readFileSync('./certificates/localhost-key.pem'),
    cert: readFileSync('./certificates/localhost.pem'),
    ca: [readFileSync('./certificates/localhost.pem')]
};

app.prepare().then(() => {
    https.createServer(options, async (req, res) => {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
    }).listen(port, ():void => {
        console.log(`> Ready on https://localhost:${port}`)
    })
})