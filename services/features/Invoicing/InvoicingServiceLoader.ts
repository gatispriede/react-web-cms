import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {InvoiceService} from './InvoiceService';

/**
 * Invoicing Loader — see `docs/roadmap/storefront/invoicing-and-bookkeeping.md`.
 *
 * Owns `InvoiceService` + the gap-free `InvoiceSequence` numbering. Hooks
 * into `OrderService.finalize` (called from the Orders feature) via the
 * service map — Orders reads `ctx.services.invoices` after this feature
 * has booted. The dependency edge is declared via `requires` so the
 * registry topo-sort runs Orders AFTER Invoicing.
 */
export class InvoicingServiceLoader extends ServiceLoader {
    readonly id = 'invoicing';
    readonly displayName = 'Invoicing & bookkeeping';
    readonly coreInfrastructure = true;
    // No `requires` — Invoicing doesn't depend on other features at
    // construction time. Orders depends on Invoicing implicitly by
    // looking up `ctx.services.invoices` at finalize time; that lookup
    // is null-safe so the boot order doesn't matter.

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        // Same MongoClient handle the Releases loader uses for transactions.
        const client = (ctx.db as any).s?.client ?? (ctx.db as any).client;
        return {invoices: new InvoiceService(ctx.db, client)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'Invoices', spec: {id: 1}, options: {unique: true, name: 'invoices_id_unique'}},
        {collection: 'Invoices', spec: {number: 1}, options: {unique: true, name: 'invoices_number_unique'}},
        {collection: 'Invoices', spec: {orderId: 1}, options: {name: 'invoices_orderId'}},
        {collection: 'Invoices', spec: {customerId: 1, issueDate: -1}, options: {name: 'invoices_customer_issue'}},
        {collection: 'Invoices', spec: {status: 1, issueDate: -1}, options: {name: 'invoices_status_issue'}},
        {collection: 'CreditNotes', spec: {id: 1}, options: {unique: true, name: 'creditNotes_id_unique'}},
        {collection: 'CreditNotes', spec: {number: 1}, options: {unique: true, name: 'creditNotes_number_unique'}},
        {collection: 'CreditNotes', spec: {referencesInvoiceId: 1}, options: {name: 'creditNotes_ref'}},
        {collection: 'InvoiceSequences', spec: {prefix: 1, year: 1}, options: {unique: true, name: 'invoiceSeq_prefix_year_unique'}},
    ];
}
