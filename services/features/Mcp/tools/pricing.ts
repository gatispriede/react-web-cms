/**
 * Pricing MCP tools (W8g).
 *
 *   - `pricing.previewVat`   — what-if calculation: resolve regime + tax
 *     for a hypothetical buyer × line set. Used by AI-authoring agents
 *     and invoice preview.
 *   - `pricing.fxRate`       — read the current ECB rate.
 *   - `pricing.fxRefresh`    — manual refresh trigger for operators.
 *   - `pricing.viesValidate` — proxy to VIES with the service's 24h
 *     cache; safe for AI to call.
 *
 * All four are read-only or idempotent + format-only side effects (the
 * cache writes are intentional and bounded).
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import {getEcbFxService} from '@services/features/Pricing/EcbFxService';
import {getViesService} from '@services/features/Pricing/ViesService';
import {getVatRegimeService} from '@services/features/Pricing/VatRegimeService';
import {getStripeTaxService} from '@services/features/Pricing/StripeTaxService';
import {SUPPORTED_CURRENCIES} from '@interfaces/IPricing';

export const pricingPreviewVat: McpTool = defineTool({
    // SAFE: pure computation + cached VIES lookup. No state changes.
    name: 'pricing.previewVat',
    description: 'Preview VAT for a hypothetical buyer + line set. Returns regime + per-line tax. AI-authoring + invoice preview.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['customerCountry', 'businessType', 'currency', 'lines'],
        properties: {
            customerCountry: {type: 'string', minLength: 2, maxLength: 2},
            customerVatId: {type: 'string'},
            businessType: {type: 'string', enum: ['b2c', 'b2b']},
            sellerCountry: {type: 'string', minLength: 2, maxLength: 2},
            currency: {type: 'string', enum: [...SUPPORTED_CURRENCIES]},
            lines: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'net'],
                    properties: {
                        id: {type: 'string', minLength: 1},
                        net: {type: 'integer', minimum: 0},
                    },
                },
            },
            useStripeTax: {type: 'boolean'},
        },
    },
}, async (args) => {
    const vies = getViesService();
    const regime = getVatRegimeService(vies);
    const stripe = getStripeTaxService();
    const seller = (args.sellerCountry || process.env.SITE_SELLER_COUNTRY || 'LV').toUpperCase();
    if (args.useStripeTax && stripe.isAvailable()) {
        try {
            return await stripe.calculate({
                currency: args.currency,
                customerCountry: args.customerCountry,
                customerVatId: args.customerVatId,
                lineItems: args.lines.map((ln: {id: string; net: number}) => ({id: ln.id, amount: ln.net})),
            });
        } catch {
            // fall through to internal
        }
    }
    const resolved = await regime.resolve({
        customerCountry: args.customerCountry,
        customerVatId: args.customerVatId,
        businessType: args.businessType,
        sellerCountry: seller,
    });
    return regime.computeBreakdown(resolved, args.lines, args.currency);
});

export const pricingFxRate: McpTool = defineTool({
    name: 'pricing.fxRate',
    description: 'Current ECB FX rate `from → to`. Refreshes lazily if cache is stale.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
            from: {type: 'string', minLength: 3, maxLength: 3},
            to: {type: 'string', minLength: 3, maxLength: 3},
        },
    },
}, async (args) => {
    const fx = getEcbFxService();
    const rate = await fx.getRate(args.from, args.to);
    const snap = await fx.getSnapshot();
    return {from: args.from.toUpperCase(), to: args.to.toUpperCase(), rate, source: snap.source, date: snap.date};
});

export const pricingFxRefresh: McpTool = defineTool({
    name: 'pricing.fxRefresh',
    description: 'Force a refresh of the ECB FX cache. Operator-level trigger.',
    scopes: ['write:content'],
    idempotent: true,
    rateLimit: {maxPerMinute: 4},
    inputSchema: {
        type: 'object',
        properties: {idempotencyKey: {type: 'string'}},
    },
}, async () => {
    const fx = getEcbFxService();
    try {
        const snap = await fx.refresh();
        return {ok: true, date: snap.date, source: snap.source, count: Object.keys(snap.rates).length};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const pricingViesValidate: McpTool = defineTool({
    name: 'pricing.viesValidate',
    description: 'Validate an EU VAT-ID via VIES. Returns format + verification status. 24h cached.',
    scopes: ['read:content'],
    rateLimit: {maxPerMinute: 30},
    inputSchema: {
        type: 'object',
        required: ['vatId'],
        properties: {vatId: {type: 'string', minLength: 6, maxLength: 20}},
    },
}, async (args) => {
    const vies = getViesService();
    return vies.validate(args.vatId);
});

export const PRICING_TOOLS: McpTool[] = [
    pricingPreviewVat,
    pricingFxRate,
    pricingFxRefresh,
    pricingViesValidate,
];
