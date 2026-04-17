import {readFileSync} from "node:fs";
import { ApolloServer } from "apollo-server-micro";
import Cors from "micro-cors";
import {getMongoConnection} from "../../../Server/mongoDBConnection";
import {guardMethods, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES, QUERY_REQUIREMENTS, sessionFromReq, GraphqlSession} from "../../../Server/authz";
import { MicroRequest } from "apollo-server-micro/dist/types";
import { ServerResponse, IncomingMessage } from "http";
// import { InMemoryLRUCache } from '@apollo/utils.keyvaluecache';

const typeDefs = readFileSync('src/Server/schema.graphql', {encoding: 'utf-8'});
const resolvers = {
    Query: {
        sample: () => "sample",
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, QUERY_REQUIREMENTS),
    },
    Mutation: {
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES),
    }

};

export const config = {
    api: {
        bodyParser: false,
    },
};
const cors = Cors();
const apolloServer = new ApolloServer({
    // cache: new InMemoryLRUCache(),
    typeDefs,
    resolvers,
    context: async ({req, res}) => {
        const session = await sessionFromReq(req, res);
        return {session};
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