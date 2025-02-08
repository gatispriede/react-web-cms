import {readFileSync} from "node:fs";
import { ApolloServer } from "apollo-server-micro";
import Cors from "micro-cors";
import MongoDBConnection from "../../../Server/mongoDBConnection";
import { MicroRequest } from "apollo-server-micro/dist/types";
import { ServerResponse, IncomingMessage } from "http";

const typeDefs = readFileSync('src/Server/schema.graphql', {encoding: 'utf-8'});
const resolvers = {
    Query: {
        sample: () => "sample",
        mongo: () => new MongoDBConnection()
    },
    Mutation: {
        mongo: () => new MongoDBConnection()
    }

};

export const config = {
    api: {
        bodyParser: false,
    },
};
const cors = Cors();
const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => {
    },
    introspection: true,
    // playground: true,
});
const serverStart = apolloServer.start();
export default cors(async (req: MicroRequest, res: ServerResponse<IncomingMessage>) => {
    if (req.method === "OPTIONS") {
        res.end();
        return false;
    }
    await serverStart;
    await apolloServer.createHandler({ path: "/api/graphql" })(req, res);
});