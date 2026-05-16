---
name: invoicing-and-bookkeeping
description: Every paid order produces a regulator-grade invoice (sequential number, full operator + customer details, line-level VAT breakdown, regime tagging) persisted as a first-class IInvoice document. Credit notes for refunds. PDF generation. Bookkeeping exports (monthly/quarterly) for tax filing. Wholesale-cost capture from the dropship adapter for COGS / margin tracking. Customer self-service download from /account/orders/[id]. Operator-grade audit trail.
---

# Invoicing + bookkeeping

## Goal

Every paid order on the storefront produces a **regulator-compliant invoice**
persisted as a first-class `IInvoice` document, available to the customer
(download from `/account/orders/[id]`) and to the operator (admin pane +
MCP + bookkeeping export). Refunds produce a **credit note** that
references the original invoice. The operator can pull a monthly /
quarterly export of every invoice + credit note for tax filing without
touching code.

The data captured matches what an EU tax authority + accountant would
look at on inspection:

- Sequential invoice number (gap-free, configurable prefix)
- Issue date + due date (B2B net terms)
- Operator legal entity (name, address, registration, VAT ID)
- Customer (name, billing address, VAT ID for B2B)
- Per-line: description, qty, unit price, line subtotal, VAT rate, VAT amount
- Totals: subtotal net, VAT total per rate, grand total
- Currency + transaction currency (with FX snapshot if multi-currency)
- Payment method + transaction reference (Stripe charge id, manual entry, etc.)
- VAT regime tag (b2c-eu / b2c-uk / b2b-eu-reverse-charge / b2b-non-eu / OSS)
- Reverse-charge legal text where applicable
- Wholesale cost per line (from the dropship adapter's `quoteWholesale`) — operator-only field, NOT printed on the customer invoice, used for COGS / margin reporting
- Linked order id (so the audit trail walks orders ↔ invoices ↔ credit notes bidirectionally)

## Why now

- **Regulatory pressure.** EU VAT compliance + 10-year invoice retention
  is non-negotiable for any storefront that processes payments. Every
  one of the four pre-public-deploy gates (a11y / GDPR / email
  deliverability / backup) assumes this exists.
- **Bookkeeping is a permanent monthly tax.** Without exports the
  operator hand-types numbers into their accountant's spreadsheet.
  Auto-export trims that to minutes.
- **Dropship margin tracking depends on it.** The
  [pc-parts-dropshipping-integration](pc-parts-dropshipping-integration.md)
  spec assumes COGS = wholesale price + shipping. Without recording
  the wholesale snapshot at order-finalize time, COGS drifts when
  distributor prices move and the operator can't compute real margin
  after the fact. Capture-at-time-of-sale is the only honest path.
- **Customer trust.** Letting a customer download a proper invoice from
  their account page (not waiting on operator email reply) is what
  every prospect compares against Shopify on. Indie storefronts
  without this look amateur.

## Scope

**In scope:**

- `IInvoice` + `IInvoiceLine` + `ICreditNote` schema
- `InvoiceService` — issue, void (via credit note), list, get, export
- Sequential numbering with per-year reset + configurable prefix
- Post-payment hook in `OrderService.finalize` issues the invoice atomically with the order state transition
- VAT regime tagging via existing `VatRegimeService` (W8g)
- Wholesale cost snapshot — captures the dropship adapter's `quoteWholesale` result at finalize-time, stored on the invoice line
- PDF generation (server-side, reuses W6a / W8g rendering primitives)
- Email attachment — invoice PDF goes out with the W6a `receipt` template
- Customer self-service — `/account/orders/[id]` shows invoice download link
- Admin pane — list / filter / search invoices + credit notes
- Bookkeeping export — CSV or XLSX, configurable date range, columns match what the accountant needs (invoice nr, date, customer, net, VAT, gross, currency, regime, COGS)
- MCP coverage — `invoice.list`, `invoice.get`, `invoice.export`, `creditNote.create`
- Audit — every issue / void / export logged via existing `AuditService`
- Retention — Mongo TTL set to 10 years; backup integration uses existing W8e restic plumbing

**Out of scope:**

- Multi-entity (operator running multiple legal entities under one storefront) — single-entity v1
- e-Invoicing standards (PEPPOL, EN 16931 XML) — separate jump, comes after b2b traction warrants it
- ZUGFeRD / Factur-X (PDF-A/3 with embedded XML) — same
- VIES validation re-check on the invoice — already handled by W8g at order-place time; invoice trusts that result
- Per-line discount accounting — covered by line-level pricing already; no separate discount column
- Cryptographic-signed invoices (KSeF Poland, French e-invoicing reform) — country-specific, separate jumps
- Multi-language invoice copy — single language per storefront for v1; localised invoice templates is a follow-up

## Design

### Schema

```ts
// shared/types/IInvoice.ts

export interface IInvoice {
    id: string;
    /** Gap-free sequential number; per-year reset; prefix configurable. */
    number: string;                  // e.g. 'INV-2026-000001'
    /** ISO date (YYYY-MM-DD); when it appears on the invoice. */
    issueDate: string;
    /** ISO date; B2B net-N terms; equal to issueDate for B2C. */
    dueDate: string;
    /** Order this invoice was issued for. */
    orderId: string;
    /** Customer-id if signed-in; null for guest checkout (use snapshot). */
    customerId?: string;
    /** Locked snapshot — operator legal entity at time of issue. */
    operator: IInvoiceParty;
    /** Locked snapshot — customer's billing party at time of issue. */
    customer: IInvoiceParty;
    lines: IInvoiceLine[];
    /** Per-rate VAT subtotals, e.g. {'21': 8400, '0': 0} (minor units). */
    vatBreakdown: Record<string, IMoneyMinor>;
    subtotalNet: IMoneyMinor;
    vatTotal: IMoneyMinor;
    grandTotal: IMoneyMinor;
    currency: string;                // ISO 4217
    /** When invoice currency != transaction currency, snapshot FX. */
    fxSnapshot?: {
        transactionCurrency: string;
        rate: number;
        capturedAt: string;
    };
    /** VAT regime resolved by W8g VatRegimeService at order-place time. */
    vatRegime: VatRegime;
    /** Standard reverse-charge text when applicable; null otherwise. */
    reverseChargeNote?: string;
    payment: IInvoicePayment;
    /** Operator-only — NOT printed on the customer-facing PDF. */
    cogs: ICogsSnapshot;
    status: 'issued' | 'voided';
    /** When voided, points at the credit note that voids it. */
    voidedByCreditNoteId?: string;
    createdAt: string;
    createdBy: string;               // 'system' for auto-issued; admin email for manual
    version: number;                 // OCC
}

export interface IInvoiceParty {
    name: string;
    address: IAddress;
    /** Required for operator + for B2B customers. */
    vatId?: string;
    /** Operator's business registration (NACE / KRS / similar). */
    registrationNumber?: string;
    email?: string;
}

export interface IInvoiceLine {
    productId?: string;              // null for shipping line / manual adjustment
    description: string;
    qty: number;
    unitNet: IMoneyMinor;
    lineNet: IMoneyMinor;            // qty × unitNet (pre-rounding capture)
    vatRatePct: number;              // 0 / 9 / 21 / etc.
    vatAmount: IMoneyMinor;
    lineGross: IMoneyMinor;
    /** Per-line wholesale cost — captured at finalize-time. */
    wholesaleCost?: IMoneyMinor;
}

export interface IInvoicePayment {
    method: 'stripe' | 'bank-transfer' | 'manual';
    transactionRef: string;
    paidAt: string;
    paidAmount: IMoneyMinor;
}

export interface ICogsSnapshot {
    /** Sum of all line.wholesaleCost. Operator-only. */
    totalWholesale: IMoneyMinor;
    /** Operator paid distributor — typically wholesale + distributor shipping. */
    distributorShipping?: IMoneyMinor;
    /** Margin in minor units = grandTotal - totalWholesale - distributorShipping. */
    grossMargin: IMoneyMinor;
    /** Source adapter id, e.g. 'tme', 'td-synnex-stream-one'. */
    sourceAdapter: string;
    capturedAt: string;
}

export interface ICreditNote {
    id: string;
    number: string;                  // 'CN-2026-000001'
    issueDate: string;
    /** The invoice this credit note voids (fully) or partially refunds. */
    referencesInvoiceId: string;
    /** Subset of lines being credited; full void = all lines mirrored negative. */
    lines: IInvoiceLine[];
    reason: 'refund' | 'cancellation' | 'correction';
    reasonDetail?: string;
    vatBreakdown: Record<string, IMoneyMinor>;
    subtotalNet: IMoneyMinor;        // negative
    vatTotal: IMoneyMinor;           // negative
    grandTotal: IMoneyMinor;         // negative
    currency: string;
    refundedAt?: string;             // when the customer's card was refunded
    refundTransactionRef?: string;
    createdAt: string;
    createdBy: string;
    version: number;
}

export type IMoneyMinor = number;    // integer minor units; existing convention
```

### Numbering

Two configurable prefixes — invoices (`INV-`) and credit notes (`CN-`).
Per-year reset on Jan 1. Sequence stored in a dedicated Mongo doc
with optimistic-concurrency increment (existing OCC pattern). No gaps
— voiding produces a credit note, never deletes an issued number.

Spec on the legal mandate to keep numbers gap-free: EU invoicing
directive 2010/45/EU + national equivalents.

### Generation flow

```
1. Customer pays → Stripe webhook (or manual payment marker)
2. OrderService.finalize() — atomic transaction:
   a. Order state moves to 'paid'
   b. InvoiceService.issueForOrder(order, paymentRef)
   c. If dropship enabled: capture adapter.quoteWholesale() snapshot
      into invoice.lines[*].wholesaleCost
   d. Persist IInvoice + bump sequence + log audit row
3. EmailService.send('receipt') with PDF attachment via the existing
   W6a template path
4. (Background) DropshipAdapter.placeOrder() — separate flow per
   pc-parts-dropshipping-integration spec
```

If any step in `(2)` fails, the whole transaction rolls back — order
stays in 'pending-payment' state and the customer can retry. No
silent half-states.

### PDF rendering

Reuse the W8g VAT-compliant invoice rendering primitives already used
for receipts. Renders server-side via the existing PDF pipeline; the
output is a tax-authority-acceptable PDF/A. Single template per
operator (locale-aware copy via `i18n`).

Attachment storage: PDFs are regenerated on-demand from the `IInvoice`
doc (deterministic; no stored binary). Faster + cheaper than blob
storage + future template changes can re-issue without touching old
data.

### Bookkeeping export

`InvoiceService.exportRange(startDate, endDate, format)` returns:

- CSV / XLSX (operator choice; CSV ships first, XLSX is a follow-up)
- Columns: `number`, `issueDate`, `customer.name`, `customer.vatId`,
  `subtotalNet`, `vatBreakdown.21` (per rate column), `vatTotal`,
  `grandTotal`, `currency`, `vatRegime`, `wholesaleCost`, `grossMargin`,
  `orderId`, `paymentMethod`, `transactionRef`
- Includes credit notes as negative rows so the accountant sees
  the full net picture

Triggered from:
- Admin pane button ("Export period")
- MCP tool `invoice.export`
- Scheduled cron (operator-configurable) — drops the CSV to a
  preconfigured backup bucket via the existing W8e restic
  plumbing for offsite retention

### MCP coverage

- `invoice.list` — filter by date range / status / regime; paginated
- `invoice.get` — single invoice by id or number
- `invoice.export` — date range + format → returns a download URL or
  inline CSV blob
- `creditNote.create` — refund / cancellation flow; references the
  voided invoice id + lines being credited
- `creditNote.list` / `creditNote.get`
- (No `invoice.create` — invoices are auto-issued, never hand-created.
  Operator who needs a manual invoice issues a "manual" order instead.)

### Admin UI

New admin pane under `Commerce → Invoices`:

- List view: invoice number, date, customer name, total, regime,
  status, paid-marker
- Filter chips: status, date range, regime, currency, customer
- Detail view: full invoice render (HTML preview) + "Download PDF"
  + "Issue credit note" + audit-trail footer
- Export button (top-right of list) → date range modal → CSV download
- COGS column toggleable (off by default — operator hides on screenshots)

### Audit + retention

Every `IInvoice` + `ICreditNote` write produces an `IAuditEntry`
(`editedBy`, `editedAt`, `version`) — same pattern as every other
mutable doc. The Mongo TTL on these collections is **10 years**
(EU invoicing-retention statute, 7 years US; default 10 to cover
the longest regime).

Backups: existing W8e restic pipeline already snapshots all Mongo
collections nightly + restic verifies — invoice retention is covered
when that ships.

## Files to touch (rough)

- `shared/types/IInvoice.ts` — schema (new)
- `shared/types/ICreditNote.ts` — schema (new)
- `services/features/Invoicing/InvoiceService.ts` — service (new)
- `services/features/Invoicing/InvoiceSequence.ts` — numbering (new)
- `services/features/Invoicing/InvoiceServiceLoader.ts` — boot wire (new)
- `services/features/Invoicing/pdfRenderer.ts` — extracts the W8g PDF primitives into a reusable helper (refactor — keeps backwards-compat for W8g)
- `services/features/Orders/OrderService.ts` — `finalize()` hook (modify)
- `services/features/Mcp/tools/invoices.ts` — MCP tools (new)
- `services/features/Mcp/tools/index.ts` — register (modify)
- `ui/admin/features/Invoices/InvoicesListPane.tsx` — admin list (new)
- `ui/admin/features/Invoices/InvoiceDetailPane.tsx` — admin detail (new)
- `ui/admin/features/Invoices/ExportRangeDialog.tsx` — admin export (new)
- `ui/client/app/account/orders/[id]/page.tsx` — add invoice download link (modify)
- `services/features/Releases/EntityPublisher.ts` — invoices are publish-irrelevant; no wiring needed but flag so admin-content-releases doesn't trip
- Test files mirroring each above

## Dependencies

- **Phase 1.A auth-split** — customer signed-in path needs `customerId` linkage; guest path falls through to the snapshot. Both shipped.
- **Phase 1.D checkout** — `OrderService.finalize` is the issue point. Shipped.
- **W8g multi-currency + VAT** — `VatRegimeService.resolve` produces the regime tag + line-level VAT rates. Shipped.
- **W6a transactional emails** — receipt template gets the PDF attachment. Shipped.
- **W8e backup-DR** — invoice docs covered by the existing nightly restic snapshot. Operator-action gates it.
- **dropship adapter `quoteWholesale`** — feeds `wholesaleCost` per line. Scaffold shipped; real-call wired behind isConfigured guard.
- **`admin-content-releases`** — invoices are not subject to releases (they're emitted, not published). Just need to make sure `EntityPublisher` doesn't accidentally try to publish them.

All dependencies are shipped or scaffolded — this jump is fully unblocked.

## Out of scope (carry to follow-ups)

- e-Invoicing standards (PEPPOL / EN 16931 XML / ZUGFeRD)
- Country-specific cryptographic regimes (KSeF Poland, French Factur-X, Italian FatturaPA)
- Multi-entity (operator running >1 legal entity from one storefront)
- Operator-customisable invoice template (layout + branding) — single template per operator v1
- Localised invoice copy (multi-language invoice rendering) — single language v1
- Per-line discount accounting beyond what `unitNet` + `qty` capture today
- Auto-VIES re-check at invoice time (trusts W8g's order-place result)
- B2B credit-line / net-30 invoicing — separate jump
- Customer-portal "request a copy" form — they have the PDF self-service download; no separate form needed v1
- Recurring / subscription invoicing — not in the product surface v1

## Acceptance

- [ ] `IInvoice` schema lands in `shared/types/`; `IInvoice.test.ts` covers every field's serialisation round-trip
- [ ] `InvoiceService.issueForOrder` produces a complete invoice for every test order — shape matches the schema, totals reconcile to the order, VAT regime is captured correctly across all five regimes from W8g
- [ ] Gap-free numbering — concurrent test fires 100 parallel `issueForOrder` calls; sequence has 100 contiguous numbers, no duplicates, no gaps
- [ ] Voiding via credit note: original `IInvoice.status` flips to `'voided'`; `voidedByCreditNoteId` points at the new credit note; sum-with-credit-note = 0
- [ ] Wholesale cost: when the dropship adapter is credentialed, `invoice.lines[*].wholesaleCost` is populated from `quoteWholesale`; when not, it's omitted (not zero) so the export can distinguish "not tracked" from "zero cost"
- [ ] PDF render: deterministic output (same `IInvoice` → byte-identical PDF) so audits can verify retention
- [ ] Customer download link visible at `/account/orders/[id]` and produces the right PDF
- [ ] Admin pane: list / detail / export, every interactive element has a `data-testid`
- [ ] MCP tools: `invoice.list` / `invoice.get` / `invoice.export` / `creditNote.create` / `creditNote.list` / `creditNote.get`
- [ ] Bookkeeping export columns match the spec; opens in LibreOffice + Excel cleanly
- [ ] e2e: a customer completes checkout → receipt email arrives with PDF → customer opens `/account/orders/[id]` and re-downloads the same PDF → admin sees the invoice in the list → operator exports the month and the row is present
- [ ] Audit log: every issue + void + export records `editedBy` + `editedAt`

## Effort

L (1-3 days AI). The schema + service + MCP + admin pane work is mostly boilerplate over the established patterns (Orders, Releases, Pricing). The non-trivial parts are: gap-free numbering under concurrency (1-2h), PDF rendering reuse (1-2h depending on how clean the W8g primitives are), and the export format (1h for CSV, +follow-up for XLSX). Dropship-cost snapshot capture is 30 min once the adapter's `quoteWholesale` is verified live.

## Operator post-merge ops

1. Set operator legal-entity fields in `Settings → Operator profile`:
   business name, registered address, VAT ID, registration number,
   bank IBAN (for offline-payment invoices), invoice-prefix override
   if not using `INV-`.
2. Pick the invoice template language + locale.
3. Choose the export cadence (manual / monthly / quarterly) + the
   bookkeeping email address that gets the export drop.
4. Verify with one round-trip — place a €1 test order, confirm
   invoice arrives + downloads + has all fields.
