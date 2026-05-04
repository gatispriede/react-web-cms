/**
 * Order MCP tools — list / get / markFulfilled / refund.
 * Wraps the existing `OrderService` (Phase B / manifest-built) without
 * any new service surface. Refund is admin-only and idempotent.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';

const ORDER_STATUSES = ['pending', 'paid', 'fulfilling', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;

export const orderList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'order.list',
    description: 'Admin order list. Optional status filter and limit (1..500, default 50).',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            status: {type: 'string', enum: [...ORDER_STATUSES]},
            limit: {type: 'integer', minimum: 1, maximum: 500},
        },
    },
}, async (args) => {
    const conn: any = getMongoConnection();
    const orders = await conn.orderService.listAll({status: args.status, limit: args.limit});
    return orders;
});

export const orderGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'order.get',
    description: 'Lookup a single admin-side order by id.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string', minLength: 1}},
    },
}, async (args) => {
    const conn: any = getMongoConnection();
    return await conn.orderService.getById(args.id);
});

export const orderMarkFulfilled: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct OrderService call
    name: 'order.markFulfilled',
    description: 'Transition an order to `fulfilling` (or `shipped` when from=fulfilling). Mirrors the admin button.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            next: {type: 'string', enum: ['fulfilling', 'shipped', 'delivered']},
            note: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'order.markFulfilled');
    const conn: any = getMongoConnection();
    const next = args.next ?? 'fulfilling';
    const updated = await conn.orderService.transition({
        orderId: args.id, next, by: ctx.actor, note: args.note,
    });
    return {id: updated.id, status: updated.status, version: updated.version};
});

export const orderRefund: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct OrderService.refund
    name: 'order.refund',
    description: 'Refund an order (full or partial). Idempotent on (orderId, amount). Admin-only.',
    scopes: ['admin:auth'],
    idempotent: true,
    rateLimit: {maxPerMinute: 10},
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            amount: {type: 'number', minimum: 0},
            reason: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'order.refund');
    const conn: any = getMongoConnection();
    const order = await conn.orderService.refund({
        orderId: args.id, amount: args.amount, reason: args.reason, by: ctx.actor,
    });
    return {id: order.id, status: order.status, refundId: order.paymentRef?.refundId ?? null};
});

export const ORDER_TOOLS: McpTool[] = [orderList, orderGet, orderMarkFulfilled, orderRefund];
