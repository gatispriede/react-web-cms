import {readFileSync} from "node:fs";
import { ApolloServer } from "apollo-server-micro";
import Cors from "micro-cors";
// @ts-expect-error — no type defs published; value is `(depth: number) => ValidationRule`
import depthLimit from "graphql-depth-limit";
import {sessionFromReq} from "@services/features/Auth/authz";
import {nextResolvers as resolvers} from "@services/api/graphqlResolvers";
import {authOptions} from "./auth/authOptions";
import { MicroRequest } from "apollo-server-micro/dist/types";
import { ServerResponse, IncomingMessage } from "http";

const typeDefs = readFileSync('services/api/schema.graphql', {encoding: 'utf-8'});

export const config = {
    api: {
        bodyParser: false,
    },
};

/** Hard cap on incoming GraphQL request body — protects against multi-MB DoS payloads. */
const MAX_GRAPHQL_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

const cors = Cors();
const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(10)],
    context: async ({req, res}) => {
        const session = await sessionFromReq(req, res, authOptions);
        return {session};
    },
    introspection: true,
});
const serverStart = apolloServer.start();

export default cors(async (req: MicroRequest, res: ServerResponse<IncomingMessage>) => {
    if (req.method === "OPTIONS") {
        res.end();
        return false;
    }
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (contentLength > MAX_GRAPHQL_BODY_BYTES) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: 'GraphQL payload too large'}));
        return;
    }
    await serverStart;
    await apolloServer.createHandler({ path: "/api/graphql" })(req, res);
});