/**
 * Phase 1.B-c — payment-adapter registry.
 *
 * Boot-time collection of every payment adapter shipped this jump. The
 * `CheckoutPaymentForm` module + `checkout.providers.list` MCP tool
 * consume `listEnabledAdapters()` to render and enumerate options.
 *
 * Registration is module-load static: importing this module imports
 * every adapter, which means the set is fixed at build time. Per-site
 * enable/disable lives behind `commerce.checkout.providers.<id>`
 * flags — the registry filters by both flag state and `isEnabled()`
 * (which double-gates Stripe on `STRIPE_SECRET_KEY`).
 */
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {IPaymentAdapter} from './IPaymentAdapter';
import {stripeAdapter} from './stripeAdapter';
import {bankTransferAdapter} from './bankTransferAdapter';
import {cashOnDeliveryAdapter} from './cashOnDeliveryAdapter';

/** Stable adapter list — append-only. PayPal + Klarna stubs land in
 *  a follow-up jump. */
const ADAPTERS: IPaymentAdapter[] = [
    stripeAdapter,
    bankTransferAdapter,
    cashOnDeliveryAdapter,
];

export function listAllAdapters(): readonly IPaymentAdapter[] {
    return ADAPTERS;
}

export function getAdapter(id: string): IPaymentAdapter | undefined {
    return ADAPTERS.find(a => a.id === id);
}

/** Read the live commerce flags + filter to flag+env-enabled adapters.
 *  Swallows Mongo errors — returns a conservative empty list so the
 *  storefront never crashes mid-render. */
export async function listEnabledAdapters(): Promise<IPaymentAdapter[]> {
    let flags: Record<string, unknown> = {};
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const parsed = JSON.parse(raw);
        flags = ((parsed?.commerce?.checkout?.providers as Record<string, unknown>) ?? {});
    } catch {
        // Fall through with empty flags — every adapter's isEnabled()
        // will see `flagEnabled: false` and reject itself.
    }
    return ADAPTERS.filter(a => a.isEnabled({flagEnabled: flags[a.id] !== false}));
}

/** Sync read for callers that already have the flag record (e.g. SSR). */
export function listEnabledAdaptersSync(providerFlags: Record<string, boolean | undefined>): IPaymentAdapter[] {
    return ADAPTERS.filter(a => a.isEnabled({flagEnabled: providerFlags[a.id] !== false}));
}
