// @ts-ignore
import express from 'express';
import {graphqlHTTP} from 'express-graphql';
import {makeExecutableSchema} from 'graphql-tools';
import redisConnection from "./redisConnection";
import MongoDBConnection from "./mongoDBConnection";


// @ts-ignore
import cors from "cors";
import { readFileSync } from 'fs';
import * as fs from "node:fs";
import * as https from "node:https";

const privateKey = fs.readFileSync('certificates/localhost-key.pem', 'utf8');
const certificate = fs.readFileSync('certificates/localhost.pem', 'utf8');
const credentials = {key: privateKey, cert: certificate};

const red = new redisConnection()

const resolvers = {
    Query: {
        bar: (): Promise<string | null> => red.getBar(),
        sample: () => "sample",
        mongo: () => new MongoDBConnection()
    },
    Mutation: {
        mongo: () => new MongoDBConnection()
    }

};
const app: express.Application = express(credentials);
const port = 443;

const typeDefs = readFileSync('./src/Server/schema.graphql', { encoding: 'utf-8' });

app.use(
    '/',
    cors(),
    graphqlHTTP({
        schema: makeExecutableSchema({typeDefs, resolvers}),
        graphiql: true
    })
);

const server = https.createServer(credentials, app);

const serverStartup = () => {
    console.log(`Server running at https://localhost:${port}`)
}

server.listen(port,serverStartup);