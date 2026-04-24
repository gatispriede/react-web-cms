import redisConnection from "@services/infra/redisConnection";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {
    guardMethods,
    MUTATION_REQUIREMENTS,
    MUTATION_CAPABILITIES,
    QUERY_REQUIREMENTS,
    GraphqlSession,
} from "@services/features/Auth/authz";

/**
 * Shared GraphQL resolver shapes used by both servers:
 *  - `Next /api/graphql` (apollo-server-micro, session-aware, role-gated)
 *  - `src/Server/index.ts` standalone (express-graphql, localhost/build-time only)
 *
 * The two servers exist for different reasons: the Next route serves live
 * admin traffic behind NextAuth; the standalone server runs during SSG build
 * (before Next is up) and on-box for rare ops work. Keeping resolvers in one
 * place so they can't drift.
 */
const red = new redisConnection();

/** Resolver map for the standalone server — no auth wrapping. */
export const standaloneResolvers = {
    Query: {
        bar: (): Promise<string | null> => red.getBar(),
        sample: () => "sample",
        mongo: () => getMongoConnection(),
    },
    Mutation: {
        mongo: () => getMongoConnection(),
    },
};

/** Resolver map for the Next route — mongo proxied through `guardMethods`. */
export const nextResolvers = {
    Query: {
        sample: () => "sample",
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, QUERY_REQUIREMENTS),
    },
    Mutation: {
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES),
    },
};
