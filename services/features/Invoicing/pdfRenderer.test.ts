/**
 * PDF renderer — determinism check. Re-rendering the same `IInvoice`
 * produces a byte-identical buffer, which is what enables the
 * "no stored binaries" + audit-verifiable retention strategy.
 */
import {describe, expect, it} from 'vitest';
import {renderInvoicePdf} from './pdfRenderer';
import type {IInvoice} from '@interfaces/IInvoice';

function makeInvoice(): IInvoice {
    return {
        id: 'inv-1',
        number: 'INV-2026-000001',
        issueDate: '2026-05-16',
        dueDate: '2026-05-16',
        orderId: 'order-1',
        operator: {
            name: 'Operator Ltd',
            address: {line1: '1 Main St', city: 'Riga', postalCode: 'LV-1001', country: 'LV'},
            vatId: 'LV12345678901',
        },
        customer: {
            name: 'Customer',
            address: {line1: '2 Side St', city: 'Berlin', postalCode: '10115', country: 'DE'},
        },
        lines: [{
            productId: 'p-1', description: 'Widget (SKU-1)', qty: 2,
            unitNet: 1000, lineNet: 2000, vatRatePct: 21, vatAmount: 420, lineGross: 2420,
        }],
        vatBreakdown: {'21': 420},
        subtotalNet: 2000, vatTotal: 420, grandTotal: 2420,
        currency: 'EUR',
        vatRegime: {kind: 'b2c-eu', vatRate: 0.21, buyerCountry: 'DE', sellerCountry: 'LV', note: 'VAT 21% — LV.'},
        payment: {method: 'stripe', transactionRef: 'ch_abc123', paidAt: '2026-05-16T10:00:00.000Z', paidAmount: 2420},
        status: 'issued',
        createdAt: '2026-05-16T10:00:00.000Z',
        createdBy: 'system',
        version: 1,
    };
}

describe('renderInvoicePdf', () => {
    it('renders a non-empty PDF', async () => {
        const buf = await renderInvoicePdf(makeInvoice());
        expect(buf.length).toBeGreaterThan(500);
        expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('is deterministic — same invoice produces byte-identical output', async () => {
        const inv = makeInvoice();
        const [a, b] = await Promise.all([renderInvoicePdf(inv), renderInvoicePdf(inv)]);
        expect(a.equals(b)).toBe(true);
    });
});
