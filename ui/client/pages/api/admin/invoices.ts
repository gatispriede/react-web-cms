/**
 * Admin invoices API — list / detail / export CSV / void-with-credit-note.
 *
 * GET   ?view=list&status&from&to&limit&offset                → list invoices
 * GET   ?view=get&id=...                                      → invoice detail
 * GET   ?view=pdf&id=...                                      → invoice PDF binary
 * GET   ?view=export-csv&from=YYYY-MM-DD&to=YYYY-MM-DD        → CSV download
 * POST  {action: 'void', invoiceId, reason, reasonDetail?}    → emit credit note
 *
 * Admin-only. Anonymous 401, customer 403. The MCP surface mirrors
 * every operation for AI-side authoring (`invoice.list` / `invoice.get`
 * / `invoice.export` / `creditNote.create`).
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from '../auth/authOptions';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {InvoiceService} from '@services/features/Invoicing/InvoiceService';
import {renderInvoicePdf} from '@services/features/Invoicing/pdfRenderer';

function svc(): InvoiceService | null {
    const conn: any = getMongoConnection();
    return (conn?.featureServices?.invoices as InvoiceService | undefined) ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const session = await sessionFromReq(req, res, authOptions as never);
        if (!session || session.kind === 'anonymous') {
            res.status(401).json({error: 'unauthorized'});
            return;
        }
        if (session.kind !== 'admin') {
            res.status(403).json({error: 'admin only'});
            return;
        }
    } catch {
        res.status(401).json({error: 'unauthorized'});
        return;
    }

    const s = svc();
    if (!s) {
        res.status(503).json({error: 'invoice service not ready'});
        return;
    }

    if (req.method === 'GET') {
        const view = String(req.query.view ?? 'list');
        try {
            if (view === 'list') {
                const out = await s.list({
                    status: req.query.status as any,
                    from: req.query.from as string | undefined,
                    to: req.query.to as string | undefined,
                    limit: req.query.limit ? Number(req.query.limit) : undefined,
                    offset: req.query.offset ? Number(req.query.offset) : undefined,
                });
                res.status(200).json(out);
                return;
            }
            if (view === 'get') {
                const id = String(req.query.id ?? '');
                if (!id) { res.status(400).json({error: 'id required'}); return; }
                const inv = await s.get(id);
                if (!inv) { res.status(404).json({error: 'not found'}); return; }
                res.status(200).json(inv);
                return;
            }
            if (view === 'pdf') {
                const id = String(req.query.id ?? '');
                const inv = await s.get(id);
                if (!inv) { res.status(404).json({error: 'not found'}); return; }
                const buf = await renderInvoicePdf(inv);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
                res.status(200).send(buf);
                return;
            }
            if (view === 'export-csv') {
                const from = String(req.query.from ?? '');
                const to = String(req.query.to ?? '');
                if (!from || !to) { res.status(400).json({error: 'from + to required'}); return; }
                const csv = await s.exportRangeCsv(from, to);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="invoices-${from}_to_${to}.csv"`);
                res.status(200).send(csv);
                return;
            }
            res.status(400).json({error: 'unknown view'});
        } catch (err) {
            res.status(500).json({error: String((err as Error).message || err)});
        }
        return;
    }

    if (req.method === 'POST') {
        const body = (req.body ?? {}) as {
            action?: string;
            invoiceId?: string;
            reason?: 'refund' | 'cancellation' | 'correction';
            reasonDetail?: string;
            refundTransactionRef?: string;
        };
        try {
            if (body.action === 'void' && body.invoiceId && body.reason) {
                const result = await s.voidWithCreditNote(body.invoiceId, {
                    reason: body.reason,
                    reasonDetail: body.reasonDetail,
                    refundTransactionRef: body.refundTransactionRef,
                });
                res.status(200).json(result);
                return;
            }
            res.status(400).json({error: 'unknown action'});
        } catch (err) {
            res.status(500).json({error: String((err as Error).message || err)});
        }
        return;
    }

    res.setHeader('Allow', 'GET,POST');
    res.status(405).json({error: 'method not allowed'});
}
