// @ts-ignore
import express from 'express';
import {createHandler} from 'graphql-http/lib/use/express';
import {makeExecutableSchema} from '@graphql-tools/schema';
// @ts-ignore
import cors from "cors";
import {readFileSync} from 'fs';
import * as http from "node:http";
import {standaloneResolvers} from "./api/graphqlResolvers";

/**
 * Standalone GraphQL server used at SSG build time (before Next is up) and
 * for on-box admin work inside Docker. It bypasses the Next-route authz
 * Proxy — so we never want it reachable from the public internet. Bind to
 * 127.0.0.1 by default (Docker's `NODE_SERVER_PORT` flag switches to
 * 0.0.0.0:3000 for the container network). Requests from non-loopback IPs
 * are also rejected inline so a mis-configured reverse proxy can't open the
 * door by accident.
 */
// @ts-ignore
// `STANDALONE_PORT` overrides everything — used by the e2e build helper
// (`tools/e2e-build.js`) so it can pick a free port and run alongside any
// existing dev server on :80 / docker on :3000.
const port = process.env.STANDALONE_PORT
    ? Number(process.env.STANDALONE_PORT)
    : (process.env.NODE_SERVER_PORT ? 3000 : 80);
const bindHost = process.env.NODE_SERVER_PORT ? '0.0.0.0' : '127.0.0.1';
const allowRemote = process.env.STANDALONE_ALLOW_REMOTE === '1';

const typeDefs = readFileSync('./services/api/schema.graphql', {encoding: 'utf-8'});
const app: express.Application = express();

app.use((req: any, res: any, next: () => void) => {
    if (allowRemote) return next();
    const ip = (req.socket?.remoteAddress ?? '').replace('::ffff:', '');
    const forwarded = (req.headers['x-forwarded-for'] ?? '') as string;
    const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '' || ip.startsWith('172.') || ip.startsWith('10.');
    const hasForwardedHop = Boolean(forwarded);
    if (!isLoopback || hasForwardedHop) {
        res.statusCode = 403;
        res.end('standalone server refuses remote requests; set STANDALONE_ALLOW_REMOTE=1 to override');
        return;
    }
    next();
});

// Migrated off the deprecated `express-graphql` (which pinned graphql@<=15)
// to `graphql-http` so the project can ship graphql@16 without
// `--legacy-peer-deps`. `graphql-http` doesn't bundle GraphiQL — the
// admin GUI debugging surface is the Apollo Server route, not this
// standalone process. Standalone is build-time + Docker-internal only.
const schema = makeExecutableSchema({typeDefs, resolvers: standaloneResolvers});
app.use(express.json());
// Serve at both `/` (Docker container-internal: http://server:3000/) and
// `/api/graphql` (build-time SSG via gqlFetch: http://localhost/api/graphql).
// Pre-refactor the SSG path went through `next dev`; post-refactor `next build`
// runs without Next serving routes, so the standalone server must answer both
// URL shapes for the build to find resolvers.
const gqlHandler = createHandler({schema});
app.all('/', cors(), gqlHandler);
app.all('/api/graphql', cors(), gqlHandler);

const server = http.createServer(app);
server.listen(port, bindHost, () => console.log(`Server running at http://${bindHost}:${port}`));
