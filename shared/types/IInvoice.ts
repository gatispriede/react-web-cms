/**
 * Invoice domain types — see `docs/roadmap/storefront/invoicing-and-bookkeeping.md`.
 *
 * Every paid order produces one `IInvoice`. Refunds produce an `ICreditNote`
 * (see `ICreditNote.ts`) that references the invoice it voids. Wholesale
 * cost is captured per-line at finalize time so COGS reporting doesn't
 * drift when distributor prices move post-sale.
 *
 * All monetary fields are integer minor units (cents) — the same
 * convention `IOrder` uses. We keep it loose (`type IMoneyMinor = number`)
 * rather than branding so the existing arithmetic in `OrderService`,
 * `tax.ts`, etc. composes without casts.
 */

import type {IOrderVatRegime} from './IOrder';

export type IMoneyMinor = number;

/**
 * One party on the invoice — either the seller (operator legal entity)
 * or the buyer. Snapshot at issue time so retrospective edits to the
 * operator profile or customer record don't rewrite history.
 */
export interface IInvoiceParty {
    name: string;
    address: IInvoiceAddress;
    /** Required for the operator; required for B2B customers; optional for B2C. */
    vatId?: string;
    /** Operator business registration (KRS / Companies-House / NACE / similar). */
    registrationNumber?: string;
    email?: string;
}

export interface IInvoiceAddress {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
}

export interface IInvoiceLine {
    /** `null` for shipping lines and manual adjustments. */
    productId?: string;
    description: string;
    qty: number;
    unitNet: IMoneyMinor;
    /** qty × unitNet (captured pre-rounding so tests can reconcile totals). */
    lineNet: IMoneyMinor;
    /** Whole percent — 0, 9, 21, etc. */
    vatRatePct: number;
    vatAmount: IMoneyMinor;
    lineGross: IMoneyMinor;
    /**
     * Per-line wholesale cost — snapshot at finalize time when the
     * dropship adapter is configured. Omitted (not zero) when the
     * adapter is unavailable so the bookkeeping export can distinguish
     * "not tracked" from "tracked, zero cost". */
    wholesaleCost?: IMoneyMinor;
}

export interface IInvoicePayment {
    method: 'stripe' | 'mock' | 'bank-transfer' | 'manual';
    /** Provider charge id (Stripe), capture id (mock), bank ref, etc. */
    transactionRef: string;
    paidAt: string;
    paidAmount: IMoneyMinor;
}

/**
 * Operator-only COGS snapshot. NEVER printed on the customer-facing
 * PDF — gated client-side in the admin pane via a column toggle.
 */
export interface ICogsSnapshot {
    /** Sum of every `line.wholesaleCost`. */
    totalWholesale: IMoneyMinor;
    /** What the operator paid the distributor for shipping. */
    distributorShipping?: IMoneyMinor;
    /** grandTotal − totalWholesale − distributorShipping (minor units). */
    grossMargin: IMoneyMinor;
    /** Source adapter id — e.g. `tme`, `td-synnex-stream-one`. */
    sourceAdapter: string;
    capturedAt: string;
}

/**
 * FX snapshot — only set when the invoice currency differs from the
 * captured transaction currency (e.g. operator bills EUR, Stripe
 * settled in USD).
 */
export interface IInvoiceFxSnapshot {
    transactionCurrency: string;
    rate: number;
    capturedAt: string;
}

export type InvoiceStatus = 'issued' | 'voided';

export interface IInvoice {
    id: string;
    /** Gap-free sequential number — `INV-2026-000001`. */
    number: string;
    /** ISO date (YYYY-MM-DD). */
    issueDate: string;
    /** ISO date — equals `issueDate` for B2C; net-N for B2B. */
    dueDate: string;
    orderId: string;
    /** `undefined` for guest checkout — use the `customer` snapshot. */
    customerId?: string;
    operator: IInvoiceParty;
    customer: IInvoiceParty;
    lines: IInvoiceLine[];
    /** Per-rate VAT subtotals, e.g. `{'21': 8400, '0': 0}` (minor units). */
    vatBreakdown: Record<string, IMoneyMinor>;
    subtotalNet: IMoneyMinor;
    vatTotal: IMoneyMinor;
    grandTotal: IMoneyMinor;
    currency: string;
    fxSnapshot?: IInvoiceFxSnapshot;
    /** Captured from `IOrder.vatRegime` at finalize time (W8g). */
    vatRegime: IOrderVatRegime;
    /** Standard reverse-charge legal text when applicable; `undefined` otherwise. */
    reverseChargeNote?: string;
    payment: IInvoicePayment;
    /** Operator-only — see `ICogsSnapshot`. */
    cogs?: ICogsSnapshot;
    status: InvoiceStatus;
    /** When voided, points at the credit note that voided it. */
    voidedByCreditNoteId?: string;
    createdAt: string;
    /** `'system'` for auto-issued; admin email for manual. */
    createdBy: string;
    /** OCC counter. */
    version: number;
}

/**
 * Reverse-charge legal text. Required on B2B-EU intra-Community invoices
 * by Article 226(11a) of the VAT Directive (2010/45/EU). The exact
 * wording is operator-customisable post-merge; this is the safe default.
 */
export const REVERSE_CHARGE_NOTE =
    'Reverse charge — Article 196 Council Directive 2006/112/EC. VAT to be accounted for by the recipient.';
