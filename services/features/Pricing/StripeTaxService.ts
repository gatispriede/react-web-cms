/**
 * Stripe Tax integration shim (W8g).
 *
 * Wraps `stripe.tax.calculations.create` via raw REST to avoid pulling
 * the `stripe` npm dep at this stage. When the SDK is added later, drop
 * the raw fetch in `requestCalculation` for `stripe.tax.calculations.create`
 * — the public surface here stays the same.
 *
 * Gating:
 *   - `STRIPE_SECRET_KEY` must start with `sk_test_` or `sk_live_`.
 *   - `STRIPE_TAX_ENABLED=true` opts the operator in.
 *   - When either is missing → `isAvailable()` returns false and callers
 *     fall back to the internal `VatRegimeService`.
 *
 * Test-mode safety: this file never throws at import time, never reads
 * the env at module load — only inside method calls. CI lint stays clean
 * with no Stripe creds in `.env`.
 */
import {log} from '@services/infra/logger';
import type {VatBreakdown, VatLine} from '@interfaces/IPricing';

export interface StripeTaxLineInput {
    id: string;
    amount: number;
    /** Stripe Tax product category, e.g. 'txcd_99999999'. Optional. */
    taxCategory?: string;
    /** Default 'inclusive' or 'exclusive'. Stripe uses 'inclusive'/'exclusive'. */
    taxBehavior?: 'inclusive' | 'exclusive';
}

export interface StripeTaxCalculationArgs {
    currency: string;
    customerCountry: string;
    customerPostalCode?: string;
    customerVatId?: string;
    lineItems: StripeTaxLineInput[];
}

export class StripeTaxService {
    private readonly fetchImpl: typeof fetch;
    private readonly endpoint: string;

    constructor(opts: {fetchImpl?: typeof fetch; endpoint?: string} = {}) {
        this.fetchImpl = opts.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
        this.endpoint = opts.endpoint ?? 'https://api.stripe.com/v1/tax/calculations';
    }

    /** Whether Stripe Tax should be consulted. False → caller falls back to internal regime. */
    isAvailable(): boolean {
        if (process.env.PRICING_DISABLE_STRIPE_FETCH === '1') return false;
        const key = (process.env.STRIPE_SECRET_KEY || '').trim();
        const enabled = (process.env.STRIPE_TAX_ENABLED || '').toLowerCase() === 'true';
        if (!enabled) return false;
        if (!/^sk_(test|live)_/.test(key)) return false;
        return true;
    }

    /** Public key prefix check (for admin UI badge). */
    publicKeyStatus(): {present: boolean; mode: 'test' | 'live' | 'unknown'} {
        const k = (process.env.STRIPE_PUBLIC_KEY || '').trim();
        if (!k) return {present: false, mode: 'unknown'};
        if (k.startsWith('pk_test_')) return {present: true, mode: 'test'};
        if (k.startsWith('pk_live_')) return {present: true, mode: 'live'};
        return {present: true, mode: 'unknown'};
    }

    /**
     * Calculate tax on a set of line items. Returns a `VatBreakdown` in
     * the same shape the internal calculator produces (so checkout sees a
     * uniform interface). On error / non-availability → throws, caller
     * decides whether to fall back.
     */
    async calculate(args: StripeTaxCalculationArgs): Promise<VatBreakdown> {
        if (!this.isAvailable()) throw new Error('STRIPE_TAX_UNAVAILABLE');
        const key = (process.env.STRIPE_SECRET_KEY || '').trim();
        if (!this.fetchImpl) throw new Error('fetch unavailable');

        // Stripe's Tax Calculations endpoint speaks form-encoded params.
        const body = new URLSearchParams();
        body.set('currency', args.currency.toLowerCase());
        body.set('customer_details[address][country]', args.customerCountry);
        if (args.customerPostalCode) body.set('customer_details[address][postal_code]', args.customerPostalCode);
        body.set('customer_details[address_source]', 'billing');
        if (args.customerVatId) {
            body.set('customer_details[tax_ids][0][type]', 'eu_vat');
            body.set('customer_details[tax_ids][0][value]', args.customerVatId);
        }
        args.lineItems.forEach((ln, i) => {
            body.set(`line_items[${i}][amount]`, String(ln.amount));
            body.set(`line_items[${i}][reference]`, ln.id);
            body.set(`line_items[${i}][tax_behavior]`, ln.taxBehavior ?? 'exclusive');
            if (ln.taxCategory) body.set(`line_items[${i}][tax_code]`, ln.taxCategory);
        });

        const res = await this.fetchImpl(this.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Stripe-Version': '2024-06-20',
            },
            body: body.toString(),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            log.error({scope: 'pricing.stripeTax', status: res.status, text}, 'Stripe Tax call failed');
            throw new Error(`Stripe Tax HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
            tax_amount_exclusive?: number;
            amount_total?: number;
            line_items?: {data?: Array<{reference?: string; amount?: number; amount_tax?: number}>};
        };
        const data = json.line_items?.data ?? [];
        const lines: VatLine[] = data.map(d => {
            const net = d.amount ?? 0;
            const tax = d.amount_tax ?? 0;
            return {
                id: d.reference || '',
                net,
                tax,
                gross: net + tax,
                rate: net > 0 ? tax / net : 0,
            };
        });
        const totalNet = lines.reduce((s, l) => s + l.net, 0);
        const totalTax = json.tax_amount_exclusive ?? lines.reduce((s, l) => s + l.tax, 0);
        return {
            // Caller is responsible for filling regime metadata; Stripe
            // doesn't expose the same regime taxonomy.
            regime: {
                kind: 'b2c-eu',
                vatRate: totalNet > 0 ? totalTax / totalNet : 0,
                buyerCountry: args.customerCountry.toUpperCase(),
                sellerCountry: (process.env.SITE_SELLER_COUNTRY || 'LV').toUpperCase(),
                note: 'Calculated by Stripe Tax.',
            },
            lines,
            totals: {net: totalNet, tax: totalTax, gross: totalNet + totalTax},
            currency: args.currency.toUpperCase(),
            provider: 'stripe-tax',
        };
    }
}

let cached: StripeTaxService | null = null;
export function getStripeTaxService(): StripeTaxService {
    if (!cached) cached = new StripeTaxService();
    return cached;
}
export function _resetStripeTaxForTests(): void { cached = null; }
