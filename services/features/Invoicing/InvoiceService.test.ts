/**
 * InvoiceService — issue / void-with-credit-note / export / numbering.
 *
 * Standalone Mongo (mongodb-memory-server) so the
 * sequential-with-compensation path is the one under test.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, type Db} from 'mongodb';
import {InvoiceService} from './InvoiceService';
import {InvoiceSequence} from './InvoiceSequence';
import type {IOrder} from '@interfaces/IOrder';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let svc: InvoiceService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`invoices_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    svc = new InvoiceService(db, client);
});

function makeOrder(over: Partial<IOrder> = {}): IOrder {
    const now = new Date().toISOString();
    return {
        id: over.id ?? 'order-1',
        orderNumber: over.orderNumber ?? 'A-001',
        customerId: over.customerId,
        lineItems: over.lineItems ?? [{
            productId: 'p-1', sku: 'SKU-1', title: 'Widget',
            quantity: 2, unitPrice: 1000, lineTotal: 2000,
        }],
        subtotal: 2000,
        shippingTotal: 0,
        taxTotal: 420,
        discountTotal: 0,
        total: 2420,
        currency: 'EUR',
        shippingAddress: {
            name: 'Buyer', line1: '1 High St', city: 'Riga', region: 'Riga',
            postalCode: 'LV-1001', country: 'LV',
        },
        billingAddress: undefined,
        paymentRef: {provider: 'mock', captureId: 'cap_1'},
        idempotencyKeys: {},
        status: 'paid',
        statusHistory: [{status: 'paid', at: now}],
        vatRegime: {
            kind: 'b2c-eu', vatRate: 0.21, buyerCountry: 'LV', sellerCountry: 'LV',
        },
        createdAt: now,
        updatedAt: now,
        version: 2,
        ...over,
    };
}

describe('InvoiceService.issueForOrder', () => {
    it('issues a complete invoice; totals reconcile to the order', async () => {
        const order = makeOrder();
        const inv = await svc.issueForOrder(order);
        expect(inv.number).toMatch(/^INV-\d{4}-\d{6}$/);
        expect(inv.orderId).toBe(order.id);
        expect(inv.subtotalNet).toBe(2000);
        expect(inv.vatTotal).toBe(420);
        expect(inv.grandTotal).toBe(2420);
        expect(inv.status).toBe('issued');
        expect(inv.customer.address.country).toBe('LV');
        expect(inv.operator.address.country).toBeDefined();
        expect(inv.vatBreakdown['21']).toBe(420);
    });

    it('is idempotent on (orderId) — second call returns the existing invoice', async () => {
        const order = makeOrder();
        const a = await svc.issueForOrder(order);
        const b = await svc.issueForOrder(order);
        expect(b.id).toBe(a.id);
        expect(b.number).toBe(a.number);
    });

    it('captures the reverse-charge legal note for B2B-EU regime', async () => {
        const order = makeOrder({
            customerVatId: 'DE123456789',
            businessBuyer: true,
            vatRegime: {kind: 'b2b-eu-reverse-charge', vatRate: 0, buyerCountry: 'DE', sellerCountry: 'LV', vatNumber: 'DE123456789'},
            taxTotal: 0,
            total: 2000,
        });
        const inv = await svc.issueForOrder(order);
        expect(inv.reverseChargeNote).toBeDefined();
        expect(inv.reverseChargeNote).toMatch(/Reverse charge/i);
        expect(inv.vatTotal).toBe(0);
    });

    it('captures wholesale cost when a dropship adapter is supplied + configured', async () => {
        const order = makeOrder();
        const fakeAdapter: any = {
            isConfigured: () => true,
            quoteWholesale: async (i: any) => ({
                productId: i.productId, qty: i.qty,
                unitWholesale: {amount: 600, currency: 'EUR'},
                lineTotal: {amount: 1200, currency: 'EUR'},
                quotedAt: new Date(), validUntil: new Date(),
            }),
        };
        const inv = await svc.issueForOrder(order, {dropship: fakeAdapter, dropshipAdapterId: 'tme'});
        expect(inv.lines[0].wholesaleCost).toBe(1200);
        expect(inv.cogs?.totalWholesale).toBe(1200);
        expect(inv.cogs?.sourceAdapter).toBe('tme');
        expect(inv.cogs?.grossMargin).toBe(2420 - 1200);
    });

    it('omits wholesaleCost (rather than zero) when the adapter is not configured', async () => {
        const order = makeOrder();
        const fakeAdapter: any = {isConfigured: () => false, quoteWholesale: async () => ({})};
        const inv = await svc.issueForOrder(order, {dropship: fakeAdapter});
        expect(inv.lines[0].wholesaleCost).toBeUndefined();
        expect(inv.cogs).toBeUndefined();
    });
});

describe('InvoiceService.voidWithCreditNote', () => {
    it('flips invoice to voided + emits a mirrored-negative credit note that sums to 0', async () => {
        const order = makeOrder();
        const inv = await svc.issueForOrder(order);
        const {invoice: voided, creditNote} = await svc.voidWithCreditNote(inv.id, {reason: 'refund'});
        expect(voided.status).toBe('voided');
        expect(voided.voidedByCreditNoteId).toBe(creditNote.id);
        expect(creditNote.grandTotal).toBe(-inv.grandTotal);
        expect(creditNote.lines[0].qty).toBe(-inv.lines[0].qty);
        expect(creditNote.subtotalNet + inv.subtotalNet).toBe(0);
        expect(creditNote.vatTotal + inv.vatTotal).toBe(0);
        expect(creditNote.grandTotal + inv.grandTotal).toBe(0);
    });

    it('is idempotent on (invoiceId) when invoice is already voided', async () => {
        const inv = await svc.issueForOrder(makeOrder());
        const a = await svc.voidWithCreditNote(inv.id, {reason: 'refund'});
        const b = await svc.voidWithCreditNote(inv.id, {reason: 'refund'});
        expect(b.creditNote.id).toBe(a.creditNote.id);
    });
});

describe('InvoiceService.exportRange (CSV)', () => {
    it('emits header + invoice + credit-note rows in ascending date order', async () => {
        const a = await svc.issueForOrder(makeOrder({id: 'o-a'}));
        await svc.issueForOrder(makeOrder({id: 'o-b'}));
        await svc.voidWithCreditNote(a.id, {reason: 'cancellation'});
        const today = new Date().toISOString().slice(0, 10);
        const csv = await svc.exportRangeCsv('2000-01-01', '2999-12-31');
        const lines = csv.trim().split('\n');
        expect(lines[0]).toContain('number,docType,issueDate');
        // Should have 3 rows (2 invoices + 1 credit note).
        expect(lines.length).toBe(4);
        expect(csv).toContain(today);
    });
});

describe('InvoiceSequence — concurrent gap-free numbering', () => {
    it('produces 100 contiguous unique numbers under parallel firing', async () => {
        // Fresh db so the seq starts at 0.
        const localDb = client.db(`seqconcurrent_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
        const seq = new InvoiceSequence(localDb, {prefix: 'INV', pad: 6});
        const results = await Promise.all(Array.from({length: 100}, () => seq.next()));
        const uniq = new Set(results);
        expect(uniq.size).toBe(100);
        // Extract numeric suffixes; they should span 1..100 contiguously.
        const nums = results.map(s => Number(s.split('-')[2])).sort((a, b) => a - b);
        expect(nums[0]).toBe(1);
        expect(nums[99]).toBe(100);
        for (let i = 1; i < nums.length; i++) expect(nums[i]).toBe(nums[i - 1] + 1);
    });
});
