"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
var express_1 = require("express");
var express_graphql_1 = require("express-graphql");
var graphql_tools_1 = require("graphql-tools");
var redisConnection_1 = require("./redisConnection");
var mongoDBConnection_1 = require("./mongoDBConnection");
// @ts-ignore
var cors_1 = require("cors");
var fs_1 = require("fs");
var red = new redisConnection_1.default();
var resolvers = {
    Query: {
        bar: function () { return red.getBar(); },
        sample: function () { return "sample"; },
        mongo: function () { return new mongoDBConnection_1.default(); }
    },
    Mutation: {
        mongo: function () { return new mongoDBConnection_1.default(); }
    }
};
var server = (0, express_1.default)();
var port = 80;
var typeDefs = (0, fs_1.readFileSync)('./src/Server/schema.graphql', { encoding: 'utf-8' });
server.use('/', (0, cors_1.default)(), (0, express_graphql_1.graphqlHTTP)({
    schema: (0, graphql_tools_1.makeExecutableSchema)({ typeDefs: typeDefs, resolvers: resolvers }),
    graphiql: true
}));
var serverStartup = function () {
    console.log("Server running at http://localhost:".concat(port));
};
server.listen(port, serverStartup);
