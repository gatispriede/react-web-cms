import express from 'express';
import {graphqlHTTP} from 'express-graphql';
import {makeExecutableSchema} from 'graphql-tools';
import redisConnection from "./redisConnection";
import MongoDBConnection from "./mongoDBConnection";
import { readFileSync } from 'fs';

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
const server: express.Application = express();
const port = 9000;

const typeDefs = readFileSync('./src/Server/schema.graphql', { encoding: 'utf-8' });

server.use(
    '/',
    graphqlHTTP({
        schema: makeExecutableSchema({typeDefs, resolvers}),
        graphiql: true
    })
);
server.listen(port,() => console.log(`Server running at ${port}`));