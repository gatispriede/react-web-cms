/**
 * Credit-note domain types — see `docs/roadmap/storefront/invoicing-and-bookkeeping.md`.
 *
 * A credit note voids an invoice (full void = every line mirrored
 * negative) or partially refunds it. Issuing a credit note flips the
 * referenced invoice's `status` to `voided` and stamps
 * `voidedByCreditNoteId`. Numbering is gap-free per year, separate
 * sequence from invoices (`CN-2026-000001`).
 */

import type {IInvoiceLine, IInvoiceParty, IMoneyMinor} from './IInvoice';

export type CreditNoteReason = 'refund' | 'cancellation' | 'correction';

export interface ICreditNote {
    id: string;
    number: string;
    issueDate: string;
    /** Invoice this credit note credits — required. */
    referencesInvoiceId: string;
    /** Snapshot operator + customer parties from the referenced invoice. */
    operator: IInvoiceParty;
    customer: IInvoiceParty;
    /**
     * Lines being credited — full void mirrors every invoice line with
     * negative `qty`/totals; partial credit lists only the affected lines.
     */
    lines: IInvoiceLine[];
    reason: CreditNoteReason;
    reasonDetail?: string;
    /** Per-rate VAT subtotals — negative numbers. */
    vatBreakdown: Record<string, IMoneyMinor>;
    subtotalNet: IMoneyMinor;   // negative
    vatTotal: IMoneyMinor;      // negative
    grandTotal: IMoneyMinor;    // negative
    currency: string;
    /** Stripe refund id / bank-transfer ref / manual marker. */
    refundTransactionRef?: string;
    refundedAt?: string;
    createdAt: string;
    createdBy: string;
    version: number;
}
