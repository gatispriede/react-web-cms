/**
 * IInvoice / ICreditNote — JSON round-trip + REVERSE_CHARGE_NOTE constant.
 * Catches accidental field drift (Date instead of string, etc.) before it
 * blows up the persisted-shape contract.
 */
import {describe, expect, it} from 'vitest';
import {REVERSE_CHARGE_NOTE, type IInvoice} from './IInvoice';
import type {ICreditNote} from './ICreditNote';

describe('IInvoice', () => {
    it('round-trips through JSON without losing fields', () => {
        const inv: IInvoice = {
            id: 'inv-1',
            number: 'INV-2026-000001',
            issueDate: '2026-05-16',
            dueDate: '2026-05-16',
            orderId: 'order-1',
            customerId: 'cust-1',
            operator: {
                name: 'Op',
                address: {line1: 'a', city: 'b', postalCode: 'c', country: 'LV'},
                vatId: 'LV1',
                registrationNumber: 'REG-1',
                email: 'op@x.com',
            },
            customer: {
                name: 'Cust',
                address: {line1: 'd', city: 'e', postalCode: 'f', country: 'DE'},
                vatId: 'DE1',
            },
            lines: [{
                productId: 'p', description: 'desc', qty: 1, unitNet: 100,
                lineNet: 100, vatRatePct: 21, vatAmount: 21, lineGross: 121,
                wholesaleCost: 50,
            }],
            vatBreakdown: {'21': 21},
            subtotalNet: 100,
            vatTotal: 21,
            grandTotal: 121,
            currency: 'EUR',
            fxSnapshot: {transactionCurrency: 'USD', rate: 1.07, capturedAt: '2026-05-16T10:00:00.000Z'},
            vatRegime: {kind: 'b2c-eu', vatRate: 0.21, buyerCountry: 'DE', sellerCountry: 'LV'},
            reverseChargeNote: REVERSE_CHARGE_NOTE,
            payment: {method: 'stripe', transactionRef: 'ch_1', paidAt: '2026-05-16T10:00:00.000Z', paidAmount: 121},
            cogs: {totalWholesale: 50, grossMargin: 71, sourceAdapter: 'tme', capturedAt: '2026-05-16T10:00:00.000Z'},
            status: 'issued',
            createdAt: '2026-05-16T10:00:00.000Z',
            createdBy: 'system',
            version: 1,
        };
        const decoded = JSON.parse(JSON.stringify(inv)) as IInvoice;
        expect(decoded).toEqual(inv);
        expect(decoded.cogs?.totalWholesale).toBe(50);
        expect(decoded.lines[0].wholesaleCost).toBe(50);
    });

    it('REVERSE_CHARGE_NOTE references the EU VAT directive', () => {
        expect(REVERSE_CHARGE_NOTE).toMatch(/2006\/112\/EC|Directive/);
    });
});

describe('ICreditNote', () => {
    it('round-trips with negative totals', () => {
        const cn: ICreditNote = {
            id: 'cn-1',
            number: 'CN-2026-000001',
            issueDate: '2026-05-16',
            referencesInvoiceId: 'inv-1',
            operator: {name: 'Op', address: {line1: 'a', city: 'b', postalCode: 'c', country: 'LV'}},
            customer: {name: 'C', address: {line1: 'd', city: 'e', postalCode: 'f', country: 'DE'}},
            lines: [{description: 'x', qty: -1, unitNet: 100, lineNet: -100, vatRatePct: 21, vatAmount: -21, lineGross: -121}],
            reason: 'refund',
            vatBreakdown: {'21': -21},
            subtotalNet: -100,
            vatTotal: -21,
            grandTotal: -121,
            currency: 'EUR',
            createdAt: '2026-05-16T10:00:00.000Z',
            createdBy: 'system',
            version: 1,
        };
        expect(JSON.parse(JSON.stringify(cn))).toEqual(cn);
    });
});
