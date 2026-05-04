/**
 * Inquiry-management MCP tools — list / delete / mark-read submissions
 * from the public contact form, and send an arbitrary email through the
 * existing SMTP transport.
 *
 * Inquiry storage is the `Inquiries` Mongo collection (see
 * `ui/client/pages/api/inquiry.ts`); there is no dedicated
 * `services/features/Inquiries/` feature yet — we use the connection's
 * `database` handle directly. Flagged as a follow-up in the report.
 *
 * Email send dynamic-imports `_inquiryMailer.ts` so we don't fork SMTP
 * config; the same pattern as `services/features/Orders/OrdersServiceLoader.ts`.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';

const COLLECTION = 'Inquiries';

async function inquiriesCollection() {
    const conn = getMongoConnection();
    const db = conn?.database;
    if (!db) throw new Error('Database not ready');
    return db.collection(COLLECTION);
}

export const inquiryList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'inquiry.list',
    description: 'List public contact-form submissions, newest first. Returns id/name/email/topic/preview/createdAt/read.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 200},
            offset: {type: 'integer', minimum: 0},
        },
    },
}, async (args) => {
    const col = await inquiriesCollection();
    const limit = Math.min(200, Math.max(1, Number(args.limit ?? 50)));
    const offset = Math.max(0, Number(args.offset ?? 0));
    const rows = await col
        .find({}, {projection: {_id: 0}})
        .sort({createdAt: -1})
        .skip(offset)
        .limit(limit)
        .toArray();
    return {
        rows: rows.map((r: any) => ({
            id: r.id,
            createdAt: r.createdAt,
            name: r.name,
            email: r.email,
            topic: r.topic,
            preview: typeof r.message === 'string' ? r.message.slice(0, 240) : '',
            message: r.message,
            read: r.read === true,
            recipient: r.recipient,
            mail: r.mail ?? null,
        })),
    };
});

export const inquiryDelete: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct collection write
    name: 'inquiry.delete',
    description: 'Delete one inquiry by id.',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'inquiry',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'inquiry.delete');
    const col = await inquiriesCollection();
    const res = await col.deleteOne({id: args.id});
    return {deleted: res.deletedCount ?? 0};
});

export const inquiryMarkRead: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct collection write
    name: 'inquiry.markRead',
    description: 'Mark an inquiry as read (or unread when read=false).',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'inquiry',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            read: {type: 'boolean'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    const col = await inquiriesCollection();
    const read = args.read === undefined ? true : !!args.read;
    const res = await col.updateOne({id: args.id}, {$set: {read}});
    return {matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0, read};
});

export const emailSend: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct SMTP transport
    name: 'email.send',
    description: 'Send an arbitrary email through the configured SMTP transport. Useful for replying to inquiries.',
    // SMTP is operator-grade infra; reuse the same scope as auth.resetLockouts.
    scopes: ['admin:auth'],
    idempotent: true,
    rateLimit: {maxPerMinute: 20},
    auditScope: 'email',
    inputSchema: {
        type: 'object',
        required: ['to', 'subject', 'body'],
        properties: {
            to: {type: 'string', minLength: 3},
            subject: {type: 'string', minLength: 1, maxLength: 200},
            body: {type: 'string', minLength: 1, maxLength: 20000},
            bodyHtml: {type: 'string', maxLength: 40000},
            replyTo: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'email.send');
    // Dynamic import so the services package doesn't compile-time
    // depend on Next's `pages/` path; mirrors OrdersServiceLoader.
    const mod: any = await import('@client/pages/api/_inquiryMailer').catch(() => null);
    if (!mod || typeof mod.sendInquiryEmail !== 'function') {
        return {ok: false, error: 'mailer not available (SMTP not configured or _inquiryMailer not loadable)'};
    }
    const html = typeof args.bodyHtml === 'string' && args.bodyHtml.length > 0
        ? args.bodyHtml
        : `<p style="white-space:pre-wrap">${escapeHtml(String(args.body))}</p>`;
    const result = await mod.sendInquiryEmail({
        to: String(args.to),
        subject: String(args.subject),
        text: String(args.body),
        html,
        replyTo: args.replyTo ? String(args.replyTo) : undefined,
    });
    return {ok: !!result?.ok, error: result?.error, messageId: result?.messageId};
});

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const INQUIRY_TOOLS: McpTool[] = [inquiryList, inquiryDelete, inquiryMarkRead, emailSend];
