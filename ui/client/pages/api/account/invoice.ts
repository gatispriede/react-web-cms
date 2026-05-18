/**
 * Customer-facing invoice PDF download for `/account/orders/[id]`.
 *
 * GET ?orderId=<orderId>
 *   → 200 application/pdf attachment, when the caller owns the order
 *   → 401 anonymous; 403 wrong customer; 404 no invoice for the order
 *
 * Guest checkout: customers use the `/orders/<token>` link path; this
 * route only serves signed-in customers. The token path can ship its
 * own equivalent endpoint when the receipt-email PDF attachment work
 * lands (separate jump).
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '../auth/authOptions';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {InvoiceService} from '@services/features/Invoicing/InvoiceService';
import {renderInvoicePdf} from '@services/features/Invoicing/pdfRenderer';

export const config = {
    api: {responseLimit: false},
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({error: 'Method not allowed'});
        return;
    }
    const raw = (await getServerSession(req, res, authOptions as never)) as
        | {user?: {kind?: string; id?: string; email?: string}}
        | null;
    const user = raw?.user ?? null;
    if (!user || user.kind !== 'customer' || !user.id) {
        res.status(401).json({error: 'unauthorized'});
        return;
    }
    const orderId = String(req.query.orderId ?? '').trim();
    if (!orderId) {
        res.status(400).json({error: 'orderId required'});
        return;
    }
    try {
        const conn: any = getMongoConnection();
        const order = await conn.orderService?.getForCustomer(orderId, user.id);
        if (!order) {
            res.status(404).json({error: 'order not found'});
            return;
        }
        const svc = (conn?.featureServices?.invoices as InvoiceService | undefined) ?? null;
        if (!svc) {
            res.status(503).json({error: 'invoice service not ready'});
            return;
        }
        const inv = await svc.getByOrderId(order.id);
        if (!inv) {
            res.status(404).json({error: 'no invoice yet for this order'});
            return;
        }
        const buf = await renderInvoicePdf(inv);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
        res.status(200).send(buf);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
