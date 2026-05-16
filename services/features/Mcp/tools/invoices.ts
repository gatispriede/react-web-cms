/**
 * Invoicing MCP tools — see `docs/roadmap/storefront/invoicing-and-bookkeeping.md`.
 *
 * Surface:
 *   - `invoice.list`        — paginated list with date / status / regime filters
 *   - `invoice.get`         — single lookup by id or number
 *   - `invoice.export`      — CSV bookkeeping export over a date range
 *   - `creditNote.create`   — void an invoice with a credit note
 *   - `creditNote.list`     — paginated credit-note list
 *   - `creditNote.get`      — single credit-note lookup
 *
 * No `invoice.create` — invoices are auto-issued by `OrderService.finalize`.
 */
import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';
import type {InvoiceService} from '@services/features/Invoicing/InvoiceService';
import type {CreditNoteReason} from '@interfaces/ICreditNote';

function svc(): InvoiceService {
    const conn: any = getMongoConnection();
    const s = conn?.featureServices?.invoices as InvoiceService | undefined;
    if (!s) throw new Error('InvoiceService not booted');
    return s;
}

export const invoiceList: McpTool = defineTool({
    name: 'invoice.list',
    description: 'List invoices. Filters: status, regime kind, currency, customerId, date range (issueDate). Paginated.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            status: {type: 'string', enum: ['issued', 'voided']},
            regime: {type: 'string'},
            currency: {type: 'string'},
            customerId: {type: 'string'},
            from: {type: 'string', description: 'ISO date YYYY-MM-DD'},
            to: {type: 'string', description: 'ISO date YYYY-MM-DD'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
            offset: {type: 'integer', minimum: 0},
        },
    },
}, async (args) => svc().list(args));

export const invoiceGet: McpTool = defineTool({
    name: 'invoice.get',
    description: 'Lookup a single invoice by id, number, or orderId. Provide one of `id`, `number`, `orderId`.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            id: {type: 'string'},
            number: {type: 'string'},
            orderId: {type: 'string'},
        },
    },
}, async (args) => {
    const s = svc();
    if (args.id) return s.get(args.id);
    if (args.number) return s.getByNumber(args.number);
    if (args.orderId) return s.getByOrderId(args.orderId);
    throw new Error('invoice.get requires one of {id, number, orderId}');
});

export const invoiceExport: McpTool = defineTool({
    name: 'invoice.export',
    description: 'Bookkeeping export for [from, to] inclusive. Returns CSV string + row count. Credit notes appear as negative rows.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
            from: {type: 'string', description: 'ISO date YYYY-MM-DD (inclusive)'},
            to: {type: 'string', description: 'ISO date YYYY-MM-DD (inclusive)'},
            format: {type: 'string', enum: ['csv'], description: 'CSV only for v1; XLSX is a follow-up.'},
        },
    },
}, async (args) => {
    const csv = await svc().exportRangeCsv(args.from, args.to);
    const rows = await svc().buildExportRows(args.from, args.to);
    return {format: 'csv' as const, from: args.from, to: args.to, rowCount: rows.length, csv};
});

export const creditNoteCreate: McpTool = defineTool({
    name: 'creditNote.create',
    description: 'Issue a credit note that voids an invoice. Idempotent on (invoiceId): second call returns the existing pair.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['invoiceId', 'reason'],
        properties: {
            invoiceId: {type: 'string'},
            reason: {type: 'string', enum: ['refund', 'cancellation', 'correction']},
            reasonDetail: {type: 'string'},
            refundTransactionRef: {type: 'string'},
            refundedAt: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    return await svc().voidWithCreditNote(args.invoiceId, {
        reason: args.reason as CreditNoteReason,
        reasonDetail: args.reasonDetail,
        refundTransactionRef: args.refundTransactionRef,
        refundedAt: args.refundedAt,
        actor: ctx.actor,
    });
});

export const creditNoteList: McpTool = defineTool({
    name: 'creditNote.list',
    description: 'List credit notes by date range. Paginated.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            from: {type: 'string'},
            to: {type: 'string'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
            offset: {type: 'integer', minimum: 0},
        },
    },
}, async (args) => svc().listCreditNotes(args));

export const creditNoteGet: McpTool = defineTool({
    name: 'creditNote.get',
    description: 'Lookup a single credit note by id.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string'}},
    },
}, async (args) => svc().getCreditNote(args.id));

export const INVOICE_TOOLS: McpTool[] = [
    invoiceList,
    invoiceGet,
    invoiceExport,
    creditNoteCreate,
    creditNoteList,
    creditNoteGet,
];
