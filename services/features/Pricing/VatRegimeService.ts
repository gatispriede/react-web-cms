/**
 * VAT regime resolver (W8g).
 *
 * Resolves the right VAT treatment for a buyer × seller pair. Pure
 * function on top of a static EU country table — no I/O. Encodes:
 *
 *   - Seller-domestic VAT for B2C inside the seller's country.
 *   - B2C-EU cross-border → still seller-domestic rate (post-2021 OSS
 *     destination shift is operator wall-clock; v1 keeps it simple +
 *     non-wrong by treating low-value digital + goods at seller rate).
 *   - B2B-EU intra-Community → reverse-charge zero-rate when the buyer
 *     supplied a VIES-verified VAT number.
 *   - B2C / B2B non-EU → zero-rate (export); buyer's local jurisdiction
 *     handles import.
 *
 * The resolver is intentionally insensitive to product category (no
 * reduced-rate matrix in v1) — Stripe Tax takes over for the granular
 * cases when it's enabled. The internal calculator's job is to be
 * "correct enough for invoices / display when Stripe is off".
 */
import {
    EU_COUNTRY_CODES,
    EU_STANDARD_VAT_RATES,
    type EuCountryCode,
    type VatRegime,
    type VatBreakdown,
    type VatLine,
} from '@interfaces/IPricing';
import type {ViesService} from './ViesService';

export type BusinessType = 'b2c' | 'b2b';

export interface ResolveRegimeArgs {
    /** Buyer's tax-residence country (uppercase alpha-2). */
    customerCountry: string;
    /** Optional VAT id provided by the customer (B2B). */
    customerVatId?: string;
    businessType: BusinessType;
    /** Seller's tax-residence country. Defaults to the site default if unset. */
    sellerCountry: string;
}

export interface VatRateOverrides {
    /** Operator-overridden per-country VAT rates (decimal). Merged over the static table. */
    [country: string]: number;
}

export class VatRegimeService {
    private overrides: VatRateOverrides;

    constructor(private readonly vies?: ViesService, overrides: VatRateOverrides = {}) {
        this.overrides = {...overrides};
    }

    setOverride(country: string, rate: number): void {
        if (!country) return;
        this.overrides[country.toUpperCase()] = rate;
    }

    /** True iff `country` (uppercase) is an EU member state. */
    isEu(country: string | undefined | null): boolean {
        if (!country) return false;
        return (EU_COUNTRY_CODES as readonly string[]).includes(country.toUpperCase());
    }

    rateFor(country: string | undefined | null): number {
        if (!country) return 0;
        const c = country.toUpperCase();
        if (this.overrides[c] !== undefined) return this.overrides[c];
        if ((EU_COUNTRY_CODES as readonly string[]).includes(c)) {
            return EU_STANDARD_VAT_RATES[c as EuCountryCode];
        }
        return 0;
    }

    /**
     * Resolve the regime. Returns synchronously when no VIES check is
     * needed (B2C, non-EU, or no VAT id supplied). For B2B-EU with a VAT
     * id, awaits VIES (with the service's 24h cache) to set the
     * `viesVerified` flag — falls back to "format-valid but unverified"
     * if VIES is unavailable.
     */
    async resolve(args: ResolveRegimeArgs): Promise<VatRegime> {
        const buyer = (args.customerCountry || '').toUpperCase();
        const seller = (args.sellerCountry || '').toUpperCase();
        const buyerInEu = this.isEu(buyer);
        const sellerInEu = this.isEu(seller);

        // Non-EU buyer → zero-rate (export). Same for B2C and B2B.
        if (!buyerInEu) {
            return {
                kind: args.businessType === 'b2b' ? 'b2b-non-eu' : 'b2c-non-eu',
                vatRate: 0,
                buyerCountry: buyer,
                sellerCountry: seller,
                note: 'Export — VAT not charged; buyer may owe import duties/VAT locally.',
            };
        }

        // EU buyer, B2B with VAT id, intra-EU → reverse-charge candidate.
        if (
            args.businessType === 'b2b' &&
            args.customerVatId &&
            buyerInEu &&
            sellerInEu &&
            buyer !== seller
        ) {
            const check = this.vies
                ? await this.vies.validate(args.customerVatId)
                : {valid: true, viesVerified: false, error: 'NO_VIES_CLIENT'} as const;
            // Format-valid OR VIES-confirmed both unlock reverse-charge.
            // VIES being down can't block checkout; we record the
            // verification status on the invoice so audits can see which
            // path was taken.
            if (check.valid) {
                return {
                    kind: 'b2b-eu-reverse-charge',
                    vatRate: 0,
                    buyerCountry: buyer,
                    sellerCountry: seller,
                    vatNumber: args.customerVatId,
                    viesVerified: 'viesVerified' in check ? check.viesVerified : false,
                    note: ('viesVerified' in check && check.viesVerified)
                        ? `Reverse charge B2B — VIES-verified VAT-ID ${args.customerVatId}.`
                        : `Reverse charge B2B — VAT-ID ${args.customerVatId} (VIES unverified, format valid).`,
                };
            }
            // Format invalid → fall through to standard B2C-EU rate.
        }

        // EU buyer (B2C or B2B without a valid VAT number).
        // Same-country vs cross-EU are both invoiced at seller-domestic
        // standard rate; the regime kind distinguishes them for audit.
        const rate = this.rateFor(seller);
        const sameCountry = buyer === seller;
        return {
            kind: sameCountry ? 'b2c-eu' : 'b2c-eu-cross',
            vatRate: rate,
            buyerCountry: buyer,
            sellerCountry: seller,
            note: sameCountry
                ? `VAT ${(rate * 100).toFixed(0)}% — ${seller}.`
                : `VAT ${(rate * 100).toFixed(0)}% — ${seller} (seller domestic, OSS).`,
        };
    }

    /**
     * Apply a regime to a set of `{id, net}` line items in minor units.
     * Returns the breakdown shape the checkout + invoice paths consume.
     */
    computeBreakdown(regime: VatRegime, lines: Array<{id: string; net: number}>, currency: string): VatBreakdown {
        const out: VatLine[] = [];
        let totalNet = 0;
        let totalTax = 0;
        for (const ln of lines) {
            const net = Math.max(0, Math.round(ln.net));
            const tax = Math.round(net * regime.vatRate);
            out.push({
                id: ln.id,
                net,
                tax,
                gross: net + tax,
                rate: regime.vatRate,
            });
            totalNet += net;
            totalTax += tax;
        }
        return {
            regime,
            lines: out,
            totals: {net: totalNet, tax: totalTax, gross: totalNet + totalTax},
            currency,
            provider: 'internal',
        };
    }
}

let cached: VatRegimeService | null = null;
export function getVatRegimeService(vies?: ViesService): VatRegimeService {
    if (!cached) cached = new VatRegimeService(vies);
    return cached;
}
export function _resetVatRegimeForTests(): void { cached = null; }
