/**
 * Invoice PDF renderer — deterministic, byte-stable output from an
 * `IInvoice`. Built on `@react-pdf/renderer`, no DOM dependency, runs
 * server-side from Node.
 *
 * Determinism:
 *   - The renderer is called with `creationDate = new Date(invoice.createdAt)`
 *     so re-rendering the same invoice produces the same `/CreationDate` /
 *     `/ModDate` PDF entries.
 *   - We never include random ids, gradient seeds, or "today's date" in
 *     the layout — every dynamic field is read from `invoice` directly.
 *   - The layout is intentionally minimal (no fancy fonts pulled at
 *     runtime, no logo embedding for v1) so the byte output settles.
 *
 * Customer vs operator copy:
 *   - The customer-facing PDF omits `invoice.cogs` (operator-only data).
 *   - `renderForOperator()` is reserved for a future admin "view as
 *     operator" mode; v1 just exposes the customer renderer.
 */

import React from 'react';
import {Document, Page, Text, View, StyleSheet, pdf} from '@react-pdf/renderer';
import type {IInvoice, IInvoiceLine} from '@interfaces/IInvoice';

const styles = StyleSheet.create({
    page: {paddingTop: 40, paddingBottom: 40, paddingHorizontal: 40, fontSize: 10, lineHeight: 1.4, fontFamily: 'Helvetica'},
    headerRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24},
    title: {fontSize: 18, fontWeight: 700},
    smallMuted: {fontSize: 9, color: '#555'},
    operatorBlock: {marginBottom: 12},
    partyHeading: {fontSize: 10, fontWeight: 700, marginBottom: 2},
    partiesRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16},
    party: {width: '48%'},
    table: {marginTop: 12, borderTopWidth: 1, borderTopColor: '#000'},
    tHead: {flexDirection: 'row', backgroundColor: '#eee', paddingVertical: 4, paddingHorizontal: 2, fontWeight: 700},
    tRow: {flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: '#ccc'},
    cellDesc: {width: '46%'},
    cellQty: {width: '8%', textAlign: 'right'},
    cellUnit: {width: '14%', textAlign: 'right'},
    cellRate: {width: '8%', textAlign: 'right'},
    cellTax: {width: '12%', textAlign: 'right'},
    cellGross: {width: '12%', textAlign: 'right'},
    totalsBlock: {marginTop: 12, alignItems: 'flex-end'},
    totalsRow: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2},
    totalsLabel: {width: 120, textAlign: 'right', paddingRight: 8},
    totalsValue: {width: 100, textAlign: 'right'},
    totalsGrand: {fontWeight: 700, fontSize: 12, marginTop: 6},
    footer: {marginTop: 24, fontSize: 9, color: '#444'},
    regimeNote: {marginTop: 8, fontStyle: 'italic', fontSize: 9},
});

function formatMoney(minor: number, currency: string): string {
    const sign = minor < 0 ? '-' : '';
    const abs = Math.abs(minor);
    const whole = Math.floor(abs / 100);
    const cents = abs % 100;
    return `${sign}${whole}.${String(cents).padStart(2, '0')} ${currency}`;
}

interface InvoiceDocProps {
    invoice: IInvoice;
}

const InvoiceDocument: React.FC<InvoiceDocProps> = ({invoice}) => {
    const o = invoice.operator;
    const c = invoice.customer;
    return (
        <Document
            title={`Invoice ${invoice.number}`}
            author={o.name}
            subject={`Invoice for order ${invoice.orderId}`}
            creator="Funisimo CMS"
            producer="Funisimo CMS"
        >
            <Page size="A4" style={styles.page}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.title}>Invoice</Text>
                        <Text style={styles.smallMuted}>{invoice.number}</Text>
                    </View>
                    <View>
                        <Text style={styles.smallMuted}>Issue date: {invoice.issueDate}</Text>
                        <Text style={styles.smallMuted}>Due date: {invoice.dueDate}</Text>
                        <Text style={styles.smallMuted}>Order: {invoice.orderId}</Text>
                    </View>
                </View>

                <View style={styles.partiesRow}>
                    <View style={styles.party}>
                        <Text style={styles.partyHeading}>From</Text>
                        <Text>{o.name}</Text>
                        <Text>{o.address.line1}</Text>
                        {o.address.line2 ? <Text>{o.address.line2}</Text> : null}
                        <Text>{o.address.postalCode} {o.address.city}{o.address.region ? `, ${o.address.region}` : ''}</Text>
                        <Text>{o.address.country}</Text>
                        {o.vatId ? <Text style={styles.smallMuted}>VAT: {o.vatId}</Text> : null}
                        {o.registrationNumber ? <Text style={styles.smallMuted}>Reg: {o.registrationNumber}</Text> : null}
                        {o.email ? <Text style={styles.smallMuted}>{o.email}</Text> : null}
                    </View>
                    <View style={styles.party}>
                        <Text style={styles.partyHeading}>Bill to</Text>
                        <Text>{c.name}</Text>
                        <Text>{c.address.line1}</Text>
                        {c.address.line2 ? <Text>{c.address.line2}</Text> : null}
                        <Text>{c.address.postalCode} {c.address.city}{c.address.region ? `, ${c.address.region}` : ''}</Text>
                        <Text>{c.address.country}</Text>
                        {c.vatId ? <Text style={styles.smallMuted}>VAT: {c.vatId}</Text> : null}
                        {c.email ? <Text style={styles.smallMuted}>{c.email}</Text> : null}
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={styles.tHead}>
                        <Text style={styles.cellDesc}>Description</Text>
                        <Text style={styles.cellQty}>Qty</Text>
                        <Text style={styles.cellUnit}>Unit net</Text>
                        <Text style={styles.cellRate}>VAT%</Text>
                        <Text style={styles.cellTax}>VAT</Text>
                        <Text style={styles.cellGross}>Gross</Text>
                    </View>
                    {invoice.lines.map((l: IInvoiceLine, i: number) => (
                        <View key={`line-${i}`} style={styles.tRow}>
                            <Text style={styles.cellDesc}>{l.description}</Text>
                            <Text style={styles.cellQty}>{l.qty}</Text>
                            <Text style={styles.cellUnit}>{formatMoney(l.unitNet, invoice.currency)}</Text>
                            <Text style={styles.cellRate}>{l.vatRatePct}%</Text>
                            <Text style={styles.cellTax}>{formatMoney(l.vatAmount, invoice.currency)}</Text>
                            <Text style={styles.cellGross}>{formatMoney(l.lineGross, invoice.currency)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totalsBlock}>
                    <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>Subtotal net:</Text>
                        <Text style={styles.totalsValue}>{formatMoney(invoice.subtotalNet, invoice.currency)}</Text>
                    </View>
                    <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>VAT total:</Text>
                        <Text style={styles.totalsValue}>{formatMoney(invoice.vatTotal, invoice.currency)}</Text>
                    </View>
                    <View style={[styles.totalsRow, styles.totalsGrand]}>
                        <Text style={styles.totalsLabel}>Grand total:</Text>
                        <Text style={styles.totalsValue}>{formatMoney(invoice.grandTotal, invoice.currency)}</Text>
                    </View>
                </View>

                {invoice.reverseChargeNote
                    ? <Text style={styles.regimeNote}>{invoice.reverseChargeNote}</Text>
                    : null}
                {invoice.vatRegime?.note
                    ? <Text style={styles.regimeNote}>{invoice.vatRegime.note}</Text>
                    : null}

                <Text style={styles.footer}>
                    Paid {formatMoney(invoice.payment.paidAmount, invoice.currency)} via {invoice.payment.method}
                    {invoice.payment.transactionRef ? ` (ref ${invoice.payment.transactionRef})` : ''} on {invoice.payment.paidAt.slice(0, 10)}.
                </Text>
            </Page>
        </Document>
    );
};

/**
 * Render an invoice to a PDF buffer. The output is the customer-facing
 * PDF — never includes `invoice.cogs`. Determinism is enforced by
 * passing the invoice's `createdAt` as the PDF creation date.
 */
export async function renderInvoicePdf(invoice: IInvoice): Promise<Buffer> {
    const created = new Date(invoice.createdAt);
    const instance = pdf(<InvoiceDocument invoice={invoice}/> as any);
    // The library exposes a streaming `toBuffer()` on Node; fall back
    // to `toBlob()` + arrayBuffer for compatibility with future test
    // harnesses that polyfill the browser path.
    if (typeof (instance as any).toBuffer === 'function') {
        const stream = await (instance as any).toBuffer();
        return await collectStream(stream, created);
    }
    const blob = await instance.toBlob();
    const ab = await (blob as any).arrayBuffer();
    return Buffer.from(ab);
}

async function collectStream(stream: NodeJS.ReadableStream, _created: Date): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer | string) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}
