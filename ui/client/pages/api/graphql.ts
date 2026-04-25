/**
 * Next pages-router GraphQL endpoint, migrated from `apollo-server-micro@3`
 * (EOL October 2024) to `@apollo/server@5` + the official Next integration
 * `@as-integrations/next`. The integration takes care of body parsing, the
 * landing page, and stop-on-shutdown — leaving this file responsible for
 * three things: schema wiring, the per-request body cap, and the session
 * context.
 *
 * Body parsing: under apollo-server-micro we set `bodyParser: false` and
 * let micro handle the raw stream. The Next integration for @apollo/server
 * is happiest when Next parses JSON for it — so we re-enable bodyParser
 * with a `sizeLimit` that doubles as our DoS guard. The explicit
 * `content-length` check below stays as a belt-and-braces second line in
 * case a client streams without the header.
 *
 * CORS used to come from `micro-cors`; that package is unmaintained and was
 * dropped along with `apollo-server-micro`. CORS in production is handled
 * by the Caddy reverse-proxy in front of Next, so no app-level CORS wrapper
 * is needed for the same-origin admin UI. (If a future cross-origin client
 * shows up, switch to `@as-integrations/next`'s `cors` option or wrap with
 * the `cors` package — but keep it explicit, not a magic micro-cors layer.)
 */
import {readFileSync} from 'node:fs';
import type {NextApiRequest, NextApiResponse} from 'next';
import {ApolloServer} from '@apollo/server';
import {startServerAndCreateNextHandler} from '@as-integrations/next';
// @ts-expect-error — no type defs published; value is `(depth: number) => ValidationRule`
import depthLimit from 'graphql-depth-limit';
import {sessionFromReq, type GraphqlSession} from '@services/features/Auth/authz';
import {nextResolvers as resolvers} from '@services/api/graphqlResolvers';
import {authOptions} from './auth/authOptions';

interface GqlContext {
    session: GraphqlSession;
}

const typeDefs = readFileSync('services/api/schema.graphql', {encoding: 'utf-8'});

/** Hard cap on incoming GraphQL request body — protects against multi-MB DoS payloads. */
const MAX_GRAPHQL_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};

const apolloServer = new ApolloServer<GqlContext>({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(10)],
    introspection: true,
    // Bounded LRU for the persisted-query / parse cache. Default is an
    // unbounded Map, which Apollo logs a startup warning for — under
    // adversarial load (an attacker pushing distinct queries) the
    // process slowly leaks until OOM. The default `cache: "bounded"`
    // string switches to a 30 MiB approximate ceiling, which is plenty
    // for our handful of admin / SSG queries.
    cache: 'bounded',
});

const handler = startServerAndCreateNextHandler<NextApiRequest, GqlContext>(apolloServer, {
    context: async (req, res) => {
        const session = await sessionFromReq(req, res, authOptions);
        return {session};
    },
});

export default async function gqlRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        res.end();
        return;
    }
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (contentLength > MAX_GRAPHQL_BODY_BYTES) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error: 'GraphQL payload too large'}));
        return;
    }
    return handler(req, res);
}
