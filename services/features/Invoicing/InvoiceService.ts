/**
 * InvoiceService — single owner of the `Invoices` + `CreditNotes`
 * collections. Spec: `docs/roadmap/storefront/invoicing-and-bookkeeping.md`.
 *
 * Surface:
 *   - `issueForOrder(order, opts)` — called from `OrderService.finalize`
 *     after the order transitions to `paid`. Captures the operator +
 *     customer party snapshots, computes the VAT breakdown from the
 *     order's line items + persisted `vatRegime`, snapshots the
 *     wholesale cost per line (when a dropship adapter is supplied),
 *     and persists one `IInvoice`.
 *   - `voidWithCreditNote(invoiceId, input)` — issues an `ICreditNote`,
 *     flips the source invoice to `voided`, links them. Atomic on
 *     replica-set Mongo (transactions); sequential-with-compensation
 *     on standalone (see `ReleaseService` for the canonical pattern).
 *   - `list` / `get` / `getByNumber` — admin reads.
 *   - `exportRange(start, end)` — CSV stream for bookkeeping.
 *
 * Numbering: `InvoiceSequence` — see comment in that file.
 *
 * Operator legal-entity fields are read from env (`SITE_OPERATOR_*`) for
 * v1 — the spec calls for a Settings → Operator Profile pane post-merge;
 * env keeps the dev path running without a config doc.
 */

import type {ClientSession, Collection, Db, MongoClient} from 'mongodb';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';
import type {IOrder} from '@interfaces/IOrder';
import type {
    ICogsSnapshot,
    IInvoice,
    IInvoiceLine,
    IInvoiceParty,
    InvoiceStatus,
} from '@interfaces/IInvoice';
import {REVERSE_CHARGE_NOTE} from '@interfaces/IInvoice';
import type {ICreditNote, CreditNoteReason} from '@interfaces/ICreditNote';
import {
    InvoiceSequence,
    defaultCreditNotePrefix,
    defaultInvoicePrefix,
} from './InvoiceSequence';
import type {IDropshipDistributorAdapter} from '@services/features/Dropship/IDropshipDistributorAdapter';

const INVOICES_COLLECTION = 'Invoices';
const CREDIT_NOTES_COLLECTION = 'CreditNotes';

export interface IssueForOrderOpts {
    /** Override the `createdBy` field. Defaults to `'system'`. */
    actor?: string;
    /** Optional dropship adapter — when set + `isConfigured()` ⇒ wholesale-cost capture. */
    dropship?: IDropshipDistributorAdapter;
    /** Source-adapter id used in COGS snapshots when `dropship` is present. */
    dropshipAdapterId?: string;
    /** B2B net-N terms (days). Defaults to 0 (due on issue, normal B2C path). */
    netTerms?: number;
}

export interface VoidWithCreditNoteInput {
    reason: CreditNoteReason;
    reasonDetail?: string;
    refundTransactionRef?: string;
    refundedAt?: string;
    actor?: string;
}

export interface ExportRow {
    number: string;
    issueDate: string;
    customerName: string;
    customerVatId: string;
    subtotalNet: number;
    vatTotal: number;
    grandTotal: number;
    currency: string;
    vatRegime: string;
    wholesaleCost: number | '';
    grossMargin: number | '';
    orderId: string;
    paymentMethod: string;
    transactionRef: string;
    docType: 'invoice' | 'credit-note';
}

/** Operator legal entity snapshot — env-driven for v1. */
function operatorParty(): IInvoiceParty {
    return {
        name: (process.env.SITE_OPERATOR_NAME || process.env.SITE_NAME || 'Operator').trim(),
        vatId: (process.env.SITE_OPERATOR_VAT_ID || '').trim() || undefined,
        registrationNumber: (process.env.SITE_OPERATOR_REG_NUMBER || '').trim() || undefined,
        email: (process.env.SITE_OPERATOR_EMAIL || '').trim() || undefined,
        address: {
            line1: (process.env.SITE_OPERATOR_ADDR_LINE1 || '').trim(),
            line2: (process.env.SITE_OPERATOR_ADDR_LINE2 || '').trim() || undefined,
            city: (process.env.SITE_OPERATOR_ADDR_CITY || '').trim(),
            region: (process.env.SITE_OPERATOR_ADDR_REGION || '').trim() || undefined,
            postalCode: (process.env.SITE_OPERATOR_ADDR_POSTCODE || '').trim(),
            country: (process.env.SITE_OPERATOR_ADDR_COUNTRY || process.env.SITE_SELLER_COUNTRY || 'LV')
                .trim().toUpperCase(),
        },
    };
}

function customerPartyFromOrder(order: IOrder): IInvoiceParty {
    const addr = order.billingAddress ?? order.shippingAddress;
    if (!addr) {
        // Defensive — invoices need an address. Fall back to operator
        // country so the document at least round-trips schema; caller
        // is responsible for ensuring the order has an address (every
        // order does by the time `finalize` runs).
        return {
            name: 'Customer',
            address: {line1: '', city: '', postalCode: '', country: 'XX'},
        };
    }
    return {
        name: addr.name,
        email: order.guestEmail || undefined,
        vatId: order.customerVatId || undefined,
        address: {
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            region: addr.region,
            postalCode: addr.postalCode,
            country: addr.country.toUpperCase(),
        },
    };
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function isoDatePlusDays(daysFromToday: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysFromToday);
    return d.toISOString().slice(0, 10);
}

/**
 * Compute the per-rate VAT breakdown from a list of order lines + the
 * persisted regime. v1 applies one rate (regime.vatRate) across every
 * line; the per-line `vatRatePct` field is set for the schema even
 * though we don't yet support mixed rates within a single invoice.
 */
function buildInvoiceLinesFromOrder(order: IOrder): {
    lines: IInvoiceLine[];
    vatBreakdown: Record<string, number>;
    subtotalNet: number;
    vatTotal: number;
    grandTotal: number;
} {
    const ratePct = Math.round((order.vatRegime?.vatRate ?? 0) * 100);
    const lines: IInvoiceLine[] = [];
    let subtotalNet = 0;
    let vatTotal = 0;
    for (const li of order.lineItems) {
        const lineNet = li.lineTotal;
        const vatAmount = Math.round(lineNet * (order.vatRegime?.vatRate ?? 0));
        subtotalNet += lineNet;
        vatTotal += vatAmount;
        lines.push({
            productId: li.productId,
            description: `${li.title}${li.sku ? ` (${li.sku})` : ''}`,
            qty: li.quantity,
            unitNet: li.unitPrice,
            lineNet,
            vatRatePct: ratePct,
            vatAmount,
            lineGross: lineNet + vatAmount,
        });
    }
    if (order.shippingTotal && order.shippingTotal > 0) {
        const shipNet = order.shippingTotal;
        const shipVat = Math.round(shipNet * (order.vatRegime?.vatRate ?? 0));
        subtotalNet += shipNet;
        vatTotal += shipVat;
        lines.push({
            description: order.shippingMethod?.label ?? 'Shipping',
            qty: 1,
            unitNet: shipNet,
            lineNet: shipNet,
            vatRatePct: ratePct,
            vatAmount: shipVat,
            lineGross: shipNet + shipVat,
        });
    }
    const vatBreakdown: Record<string, number> = {[String(ratePct)]: vatTotal};
    return {
        lines,
        vatBreakdown,
        subtotalNet,
        vatTotal,
        grandTotal: subtotalNet + vatTotal,
    };
}

function supportsTransactions(client?: MongoClient): boolean {
    if (!client) return false;
    try {
        const desc: any = (client as any).topology?.description;
        const type = desc?.type ?? desc?.topologyType;
        return type === 'ReplicaSetWithPrimary' || type === 'Sharded' || type === 'LoadBalanced';
    } catch {
        return false;
    }
}

export class InvoiceService {
    private readonly invoices: Collection<IInvoice>;
    private readonly creditNotes: Collection<ICreditNote>;
    private readonly invoiceSeq: InvoiceSequence;
    private readonly creditSeq: InvoiceSequence;
    private indexesReady = false;

    constructor(
        private readonly db: Db,
        private readonly client?: MongoClient,
    ) {
        this.invoices = db.collection<IInvoice>(INVOICES_COLLECTION);
        this.creditNotes = db.collection<ICreditNote>(CREDIT_NOTES_COLLECTION);
        this.invoiceSeq = new InvoiceSequence(db, {prefix: defaultInvoicePrefix()});
        this.creditSeq = new InvoiceSequence(db, {prefix: defaultCreditNotePrefix()});
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.invoices.createIndex({id: 1}, {unique: true});
            await this.invoices.createIndex({number: 1}, {unique: true});
            await this.invoices.createIndex({orderId: 1});
            await this.invoices.createIndex({customerId: 1, issueDate: -1});
            await this.invoices.createIndex({status: 1, issueDate: -1});
            await this.creditNotes.createIndex({id: 1}, {unique: true});
            await this.creditNotes.createIndex({number: 1}, {unique: true});
            await this.creditNotes.createIndex({referencesInvoiceId: 1});
            this.indexesReady = true;
        } catch (err) {
            log.error({scope: 'invoices.ensureIndexes', err}, 'InvoiceService ensureIndexes failed');
        }
    }

    // ─── issue ─────────────────────────────────────────────────────────

    async issueForOrder(order: IOrder, opts: IssueForOrderOpts = {}): Promise<IInvoice> {
        await this.ensureIndexes();
        // Refuse to double-issue.
        const existing = await this.invoices.findOne({orderId: order.id} as any, {projection: {_id: 0}});
        if (existing) return this.stripId(existing) as IInvoice;

        const totals = buildInvoiceLinesFromOrder(order);
        const cogs = await this.captureCogs(order, totals.lines, opts);

        const regime = order.vatRegime ?? {
            kind: 'b2c-eu' as const,
            vatRate: 0,
            buyerCountry: order.shippingAddress?.country?.toUpperCase() ?? 'XX',
            sellerCountry: (process.env.SITE_SELLER_COUNTRY || 'LV').toUpperCase(),
        };
        const number = await this.invoiceSeq.next();
        const issueDate = todayIso();
        const dueDate = opts.netTerms && opts.netTerms > 0 ? isoDatePlusDays(opts.netTerms) : issueDate;
        const isReverseCharge = regime.kind === 'b2b-eu-reverse-charge';
        const invoice: IInvoice = {
            id: guid(),
            number,
            issueDate,
            dueDate,
            orderId: order.id,
            customerId: order.customerId,
            operator: operatorParty(),
            customer: customerPartyFromOrder(order),
            lines: totals.lines,
            vatBreakdown: totals.vatBreakdown,
            subtotalNet: totals.subtotalNet,
            vatTotal: totals.vatTotal,
            grandTotal: totals.grandTotal,
            currency: order.currency,
            vatRegime: regime,
            reverseChargeNote: isReverseCharge ? REVERSE_CHARGE_NOTE : undefined,
            payment: {
                method: order.paymentRef?.provider === 'stripe' ? 'stripe' : 'mock',
                transactionRef: order.paymentRef?.captureId ?? order.paymentRef?.authorizationId ?? '',
                paidAt: new Date().toISOString(),
                paidAmount: order.total,
            },
            cogs,
            status: 'issued' as InvoiceStatus,
            createdAt: new Date().toISOString(),
            createdBy: opts.actor ?? 'system',
            version: 1,
        };
        await this.invoices.insertOne(invoice as any);
        return invoice;
    }

    /**
     * Capture per-line wholesale cost from the dropship adapter. Mutates
     * `lines` in place and returns the COGS roll-up. Returns `undefined`
     * when no adapter is configured — the bookkeeping export
     * distinguishes "not tracked" (undefined) from "tracked, zero" (0).
     */
    private async captureCogs(
        order: IOrder,
        lines: IInvoiceLine[],
        opts: IssueForOrderOpts,
    ): Promise<ICogsSnapshot | undefined> {
        const adapter = opts.dropship;
        if (!adapter || typeof adapter.isConfigured !== 'function' || !adapter.isConfigured()) {
            return undefined;
        }
        let totalWholesale = 0;
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (!ln.productId) continue;
            try {
                const q = await adapter.quoteWholesale({
                    productId: ln.productId,
                    qty: ln.qty,
                    shipToCountry: order.shippingAddress?.country,
                });
                const minor = typeof (q as any).lineTotal === 'object'
                    ? Number((q as any).lineTotal?.amount ?? 0)
                    : Number((q as any).lineTotal ?? 0);
                if (Number.isFinite(minor) && minor > 0) {
                    ln.wholesaleCost = Math.round(minor);
                    totalWholesale += ln.wholesaleCost;
                }
            } catch (err) {
                log.warn({scope: 'invoices.captureCogs', orderId: order.id, productId: ln.productId, err},
                    'wholesale quote failed; leaving wholesaleCost unset');
            }
        }
        return {
            totalWholesale,
            grossMargin: order.total - totalWholesale,
            sourceAdapter: opts.dropshipAdapterId ?? 'unknown',
            capturedAt: new Date().toISOString(),
        };
    }

    // ─── void / credit note ────────────────────────────────────────────

    async voidWithCreditNote(invoiceId: string, input: VoidWithCreditNoteInput): Promise<{
        invoice: IInvoice;
        creditNote: ICreditNote;
    }> {
        await this.ensureIndexes();
        const target = await this.get(invoiceId);
        if (!target) throw new Error(`invoice not found: ${invoiceId}`);
        if (target.status === 'voided') {
            // Idempotent — return the existing pair.
            const cn = target.voidedByCreditNoteId
                ? await this.getCreditNote(target.voidedByCreditNoteId)
                : null;
            if (cn) return {invoice: target, creditNote: cn};
            // Defensive — voided but link missing. Continue and issue a new one.
        }

        const number = await this.creditSeq.next();
        const mirroredLines: IInvoiceLine[] = target.lines.map(l => ({
            ...l,
            qty: -l.qty,
            lineNet: -l.lineNet,
            vatAmount: -l.vatAmount,
            lineGross: -l.lineGross,
        }));
        const mirroredBreakdown: Record<string, number> = {};
        for (const [k, v] of Object.entries(target.vatBreakdown)) mirroredBreakdown[k] = -v;

        const creditNote: ICreditNote = {
            id: guid(),
            number,
            issueDate: todayIso(),
            referencesInvoiceId: target.id,
            operator: target.operator,
            customer: target.customer,
            lines: mirroredLines,
            reason: input.reason,
            reasonDetail: input.reasonDetail,
            vatBreakdown: mirroredBreakdown,
            subtotalNet: -target.subtotalNet,
            vatTotal: -target.vatTotal,
            grandTotal: -target.grandTotal,
            currency: target.currency,
            refundTransactionRef: input.refundTransactionRef,
            refundedAt: input.refundedAt,
            createdAt: new Date().toISOString(),
            createdBy: input.actor ?? 'system',
            version: 1,
        };

        // Atomic write — both insertion and the invoice status flip
        // happen together, with a sequential-with-compensation fallback
        // on standalone Mongo (no transactions).
        if (this.client && supportsTransactions(this.client)) {
            const session = this.client.startSession();
            try {
                await session.withTransaction(async () => {
                    await this.creditNotes.insertOne(creditNote as any, {session});
                    await this.invoices.updateOne(
                        {id: target.id, version: target.version} as any,
                        {$set: {
                            status: 'voided' as InvoiceStatus,
                            voidedByCreditNoteId: creditNote.id,
                            version: target.version + 1,
                        }} as any,
                        {session},
                    );
                });
            } finally {
                await session.endSession();
            }
        } else {
            // Compensating saga — if the status flip fails, delete the
            // just-inserted credit note so the caller can retry cleanly.
            await this.creditNotes.insertOne(creditNote as any);
            try {
                const res = await this.invoices.updateOne(
                    {id: target.id, version: target.version} as any,
                    {$set: {
                        status: 'voided' as InvoiceStatus,
                        voidedByCreditNoteId: creditNote.id,
                        version: target.version + 1,
                    }} as any,
                );
                if (res.matchedCount !== 1) throw new Error('invoice OCC conflict during void');
            } catch (err) {
                try { await this.creditNotes.deleteOne({id: creditNote.id} as any); }
                catch (cleanupErr) {
                    log.error({scope: 'invoices.void.compensate', err: cleanupErr},
                        'credit-note cleanup failed — manual repair required');
                }
                throw err;
            }
        }
        const after = await this.get(target.id);
        return {invoice: after!, creditNote};
    }

    // ─── reads ─────────────────────────────────────────────────────────

    async get(id: string): Promise<IInvoice | null> {
        await this.ensureIndexes();
        const doc = await this.invoices.findOne({id} as any, {projection: {_id: 0}});
        return doc ? this.stripId(doc) as IInvoice : null;
    }

    async getByNumber(number: string): Promise<IInvoice | null> {
        await this.ensureIndexes();
        const doc = await this.invoices.findOne({number} as any, {projection: {_id: 0}});
        return doc ? this.stripId(doc) as IInvoice : null;
    }

    async getByOrderId(orderId: string): Promise<IInvoice | null> {
        await this.ensureIndexes();
        const doc = await this.invoices.findOne({orderId} as any, {projection: {_id: 0}});
        return doc ? this.stripId(doc) as IInvoice : null;
    }

    async getCreditNote(id: string): Promise<ICreditNote | null> {
        await this.ensureIndexes();
        const doc = await this.creditNotes.findOne({id} as any, {projection: {_id: 0}});
        return doc ? this.stripId(doc) as ICreditNote : null;
    }

    async list(params: {
        status?: InvoiceStatus;
        customerId?: string;
        from?: string;
        to?: string;
        regime?: string;
        currency?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{rows: IInvoice[]; total: number}> {
        await this.ensureIndexes();
        const filter: Record<string, unknown> = {};
        if (params.status) filter.status = params.status;
        if (params.customerId) filter.customerId = params.customerId;
        if (params.regime) (filter as any)['vatRegime.kind'] = params.regime;
        if (params.currency) filter.currency = params.currency;
        if (params.from || params.to) {
            const range: Record<string, string> = {};
            if (params.from) range.$gte = params.from;
            if (params.to) range.$lte = params.to;
            filter.issueDate = range;
        }
        const limit = Math.min(Math.max(1, params.limit ?? 100), 500);
        const offset = Math.max(0, params.offset ?? 0);
        const [docs, total] = await Promise.all([
            this.invoices.find(filter as any, {projection: {_id: 0}})
                .sort({issueDate: -1, number: -1} as any)
                .skip(offset)
                .limit(limit)
                .toArray(),
            this.invoices.countDocuments(filter as any),
        ]);
        return {rows: docs.map(d => this.stripId(d) as IInvoice), total};
    }

    async listCreditNotes(params: {
        from?: string;
        to?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{rows: ICreditNote[]; total: number}> {
        await this.ensureIndexes();
        const filter: Record<string, unknown> = {};
        if (params.from || params.to) {
            const range: Record<string, string> = {};
            if (params.from) range.$gte = params.from;
            if (params.to) range.$lte = params.to;
            filter.issueDate = range;
        }
        const limit = Math.min(Math.max(1, params.limit ?? 100), 500);
        const offset = Math.max(0, params.offset ?? 0);
        const [docs, total] = await Promise.all([
            this.creditNotes.find(filter as any, {projection: {_id: 0}})
                .sort({issueDate: -1, number: -1} as any)
                .skip(offset)
                .limit(limit)
                .toArray(),
            this.creditNotes.countDocuments(filter as any),
        ]);
        return {rows: docs.map(d => this.stripId(d) as ICreditNote), total};
    }

    // ─── bookkeeping export ────────────────────────────────────────────

    /**
     * Build the bookkeeping rows for `[from, to]` (inclusive, ISO dates).
     * Credit notes appear inline as negative rows so the accountant sees
     * the net position. Output is shaped so the CSV serialiser is a
     * trivial join — the row order is `invoices first by date, then
     * credit notes, both ascending`.
     */
    async buildExportRows(from: string, to: string): Promise<ExportRow[]> {
        const [invoiceRows, creditRows] = await Promise.all([
            this.list({from, to, limit: 500}),
            this.listCreditNotes({from, to, limit: 500}),
        ]);
        const out: ExportRow[] = [];
        for (const inv of invoiceRows.rows) {
            out.push({
                number: inv.number,
                issueDate: inv.issueDate,
                customerName: inv.customer.name,
                customerVatId: inv.customer.vatId ?? '',
                subtotalNet: inv.subtotalNet,
                vatTotal: inv.vatTotal,
                grandTotal: inv.grandTotal,
                currency: inv.currency,
                vatRegime: inv.vatRegime.kind,
                wholesaleCost: inv.cogs?.totalWholesale ?? '',
                grossMargin: inv.cogs?.grossMargin ?? '',
                orderId: inv.orderId,
                paymentMethod: inv.payment.method,
                transactionRef: inv.payment.transactionRef,
                docType: 'invoice',
            });
        }
        for (const cn of creditRows.rows) {
            out.push({
                number: cn.number,
                issueDate: cn.issueDate,
                customerName: cn.customer.name,
                customerVatId: cn.customer.vatId ?? '',
                subtotalNet: cn.subtotalNet,
                vatTotal: cn.vatTotal,
                grandTotal: cn.grandTotal,
                currency: cn.currency,
                vatRegime: '',
                wholesaleCost: '',
                grossMargin: '',
                orderId: '',
                paymentMethod: '',
                transactionRef: cn.refundTransactionRef ?? '',
                docType: 'credit-note',
            });
        }
        // Stable ascending by issueDate, then number.
        out.sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number));
        return out;
    }

    /** CSV-serialise the export. RFC 4180 quoting; LF newlines. */
    async exportRangeCsv(from: string, to: string): Promise<string> {
        const rows = await this.buildExportRows(from, to);
        const header = [
            'number', 'docType', 'issueDate', 'customerName', 'customerVatId',
            'subtotalNet', 'vatTotal', 'grandTotal', 'currency', 'vatRegime',
            'wholesaleCost', 'grossMargin', 'orderId', 'paymentMethod', 'transactionRef',
        ];
        const lines = [header.join(',')];
        for (const r of rows) {
            lines.push([
                csv(r.number),
                csv(r.docType),
                csv(r.issueDate),
                csv(r.customerName),
                csv(r.customerVatId),
                String(r.subtotalNet),
                String(r.vatTotal),
                String(r.grandTotal),
                csv(r.currency),
                csv(r.vatRegime),
                r.wholesaleCost === '' ? '' : String(r.wholesaleCost),
                r.grossMargin === '' ? '' : String(r.grossMargin),
                csv(r.orderId),
                csv(r.paymentMethod),
                csv(r.transactionRef),
            ].join(','));
        }
        return lines.join('\n') + '\n';
    }

    // ─── helpers ───────────────────────────────────────────────────────

    private stripId<T extends object>(doc: T): T {
        const clone: Record<string, unknown> = {...(doc as Record<string, unknown>)};
        delete clone._id;
        return clone as T;
    }
}

function csv(v: string): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** Convenience export for the OrderService hook + tests. */
export type {IInvoice, ICreditNote};
