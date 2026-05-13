/**
 * Commerce feature flag registrations — Phase 1.B sub-jump B.
 *
 * Importing this module registers all `commerce.*` site-flags via
 * `defineFlag()`. Mirrors `services/features/Auth/authFlags.ts` (Phase
 * 1.A pattern). The flag namespace is `commerce.*`; the matching
 * `ICommerceFlags` sub-record on `ISiteFlags` already exists in
 * `services/features/Seo/SiteFlagsService.ts` (reserved by Phase 0c).
 *
 * `commerce.checkoutEnabled` is the master switch:
 *
 *  - OFF (default) → `/checkout/*` routes 404 via middleware, no cart
 *    drawer, Product modules render catalogue-only (Buy CTAs early-
 *    return null), sitemap omits checkout entries.
 *  - ON → cart drawer mounts, Buy CTAs render per per-instance
 *    `showBuyCta`, checkout flow lives.
 *
 * Audience `public-readable` — safe to embed in SSR `InitialPageData`
 * so the storefront can decide what to render without an extra
 * roundtrip per page view.
 */
import {defineFlag, isBoolean, isOneOf, isFiniteNumber, isString, type FlagPath} from '@services/features/Seo/siteFlagDefinitions';

/** Stable list of `commerce.*` flag paths — used by MCP
 *  `commerce.config.get` + admin Commerce-settings pane to enumerate
 *  flags in deterministic order. Append-only. */
export const COMMERCE_FLAG_PATHS: readonly FlagPath[] = [
    'commerce.checkoutEnabled',
    'commerce.warehouseAutoSync',
    'commerce.defaultProductAudience',
    'commerce.abandonedCartEnabled',
    'commerce.abandonedCartDelayMinutes',
    'commerce.abandonedCartDiscountCode',
    // Phase 1.B-c — checkout-customization
    'commerce.checkout.flow',
    'commerce.checkout.requireAccount',
    'commerce.checkout.fields',
    'commerce.checkout.orderSummaryTemplate',
    'commerce.checkout.postPurchaseRedirect',
    'commerce.checkout.providers.stripe',
    'commerce.checkout.providers.bankTransfer',
    'commerce.checkout.providers.cashOnDelivery',
    'commerce.checkout.providers.paypal',
    'commerce.checkout.providers.klarna',
] as const;

defineFlag<boolean>({
    path: 'commerce.checkoutEnabled',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Master switch — when off, /checkout/* 404s + no cart drawer + Product modules render catalogue-only.',
});

/**
 * Phase 1.C — products-as-composable-page sub-jump B.
 *
 * Controls the `WarehousePageSyncWorker` cron loop. When OFF, the worker's
 * `setInterval` short-circuits (returns early per tick); operators can
 * still invoke a manual sync via MCP `pages.warehouseSync.run`. Default ON
 * so a fresh warehouse-adapter install starts populating the page tree
 * without further admin steps. Audience `public-readable` is fine — the
 * setting itself doesn't leak product data.
 */
defineFlag<boolean>({
    path: 'commerce.warehouseAutoSync',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'When on, WarehousePageSyncWorker runs every 5 min and keeps warehouse-derived page tree in sync. When off, operator must trigger sync manually via MCP.',
});

/**
 * Phase 1.F — product-display-templates.
 *
 * Default audience filter for the per-product template picker. When set
 * to `b2c` / `b2b` the picker narrows to templates with matching
 * audience + the `either` catch-all; `either` (default) imposes no
 * filter. Public-readable since the storefront's `<ProductContext>`
 * may consume the same flag for audience-aware microcopy down the road.
 */
defineFlag<'b2c' | 'b2b' | 'either'>({
    path: 'commerce.defaultProductAudience',
    defaultValue: 'either',
    typeGuard: isOneOf(['b2c', 'b2b', 'either'] as const),
    audience: 'public-readable',
    description: 'Default audience filter for the per-product template picker. b2c / b2b narrows the option list; either imposes no filter.',
});

/**
 * Phase 1.B-d — abandoned-cart recovery.
 *
 * Three flags drive the `AbandonedCartWorker`:
 *  - `commerce.abandonedCartEnabled`        master switch (default off)
 *  - `commerce.abandonedCartDelayMinutes`   stale-threshold per spec (60 min default)
 *  - `commerce.abandonedCartDiscountCode`   operator-supplied promo code,
 *                                           embedded in the recovery email
 *                                           when non-empty; no discount
 *                                           block rendered when empty.
 *
 * All admin-only — the cart-status decision shouldn't leak into the
 * public bundle, and the discount code is sensitive enough that we don't
 * embed it in SSR.
 */
defineFlag<boolean>({
    path: 'commerce.abandonedCartEnabled',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'admin-only',
    description: 'Master switch — when on, AbandonedCartWorker fires recovery emails for stale customer carts. Default off so operators opt in.',
});

defineFlag<number>({
    path: 'commerce.abandonedCartDelayMinutes',
    defaultValue: 60,
    typeGuard: isFiniteNumber,
    audience: 'admin-only',
    description: 'Minutes after the last cart update before the recovery email fires. Default 60 (operator spec). Admin pane offers 30 / 60 / 120 / 240 / 1440 presets.',
});

defineFlag<string>({
    path: 'commerce.abandonedCartDiscountCode',
    defaultValue: '',
    typeGuard: isString,
    audience: 'admin-only',
    description: 'Operator-supplied promo code embedded in the recovery email. Empty string = no discount block rendered. The platform never generates codes — it only includes the operator-pasted one.',
});

/**
 * Phase 1.B-c — checkout customization.
 *
 * Operator decisions (binding):
 *   - Default flow:           single-step
 *   - Payment providers:      Stripe + BankTransfer + CashOnDelivery
 *                             (PayPal + Klarna defined but off — not wired)
 *   - Field defaults:         customer-type-driven
 *                             client  → phone optional, company/vatId hidden
 *                             company → phone required, company required, vatId optional
 *
 * Public-readable across the board: the storefront `/checkout` route needs the
 * full config at SSR time (form layout, provider list, post-purchase redirect)
 * to render a single self-contained page without a roundtrip per field. None
 * of these values leak commercially-sensitive data.
 */
defineFlag<'single-step' | 'multi-step'>({
    path: 'commerce.checkout.flow',
    defaultValue: 'single-step',
    typeGuard: isOneOf(['single-step', 'multi-step'] as const),
    audience: 'public-readable',
    description: 'Checkout flow shape. single-step stacks address + shipping + payment + place-order on /checkout; multi-step routes through /checkout/{address,shipping,payment}.',
});

defineFlag<boolean>({
    path: 'commerce.checkout.requireAccount',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'When on, guests are forced to register/login before checkout. When off (default), guest checkout is allowed and a magic-link upgrade prompt fires post-purchase.',
});

/**
 * Per-customer-type field config. Encoded as a single JSON sub-record
 * so the operator can edit all 8 settings in one round-trip. Field
 * states:
 *   - 'required' — shown + required
 *   - 'optional' — shown + optional
 *   - 'hidden'   — not rendered at all
 *
 * Per operator decisions:
 *   client:  phone optional, company hidden, vatId hidden, shippingNotes optional
 *   company: phone required, company required, vatId optional, shippingNotes optional
 */
export interface ICheckoutFieldsConfig {
    client: {phone: 'required' | 'optional' | 'hidden'; company: 'required' | 'optional' | 'hidden'; vatId: 'required' | 'optional' | 'hidden'; shippingNotes: 'required' | 'optional' | 'hidden'};
    company: {phone: 'required' | 'optional' | 'hidden'; company: 'required' | 'optional' | 'hidden'; vatId: 'required' | 'optional' | 'hidden'; shippingNotes: 'required' | 'optional' | 'hidden'};
}

export const DEFAULT_CHECKOUT_FIELDS: ICheckoutFieldsConfig = {
    client: {phone: 'optional', company: 'hidden', vatId: 'hidden', shippingNotes: 'optional'},
    company: {phone: 'required', company: 'required', vatId: 'optional', shippingNotes: 'optional'},
};

function isFieldsConfig(v: unknown): v is ICheckoutFieldsConfig {
    if (!v || typeof v !== 'object') return false;
    const states = new Set(['required', 'optional', 'hidden']);
    const keys: Array<keyof ICheckoutFieldsConfig['client']> = ['phone', 'company', 'vatId', 'shippingNotes'];
    for (const ct of ['client', 'company'] as const) {
        const sub = (v as Record<string, unknown>)[ct];
        if (!sub || typeof sub !== 'object') return false;
        for (const k of keys) {
            if (!states.has(String((sub as Record<string, unknown>)[k]))) return false;
        }
    }
    return true;
}

defineFlag<ICheckoutFieldsConfig>({
    path: 'commerce.checkout.fields',
    defaultValue: DEFAULT_CHECKOUT_FIELDS,
    typeGuard: isFieldsConfig,
    audience: 'public-readable',
    description: 'Per-customer-type field state for the checkout address form. Each field is required | optional | hidden. Defaults: client → phone optional + company/vatId hidden; company → phone+company required + vatId optional.',
});

defineFlag<'compact' | 'detailed'>({
    path: 'commerce.checkout.orderSummaryTemplate',
    defaultValue: 'detailed',
    typeGuard: isOneOf(['compact', 'detailed'] as const),
    audience: 'public-readable',
    description: 'CheckoutCartSummary template. compact = line totals only. detailed (default) = line items + subtotal + tax + shipping + total.',
});

defineFlag<'order-confirmation' | 'custom-thank-you' | 'magic-link-signup'>({
    path: 'commerce.checkout.postPurchaseRedirect',
    defaultValue: 'magic-link-signup',
    typeGuard: isOneOf(['order-confirmation', 'custom-thank-you', 'magic-link-signup'] as const),
    audience: 'public-readable',
    description: 'Where the storefront redirects after a successful order. magic-link-signup (default) shows the upgrade prompt; order-confirmation skips it.',
});

defineFlag<boolean>({
    path: 'commerce.checkout.providers.stripe',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Stripe card-payment provider. Effective only when STRIPE_SECRET_KEY env var is set; the registry double-gates on env presence.',
});

defineFlag<boolean>({
    path: 'commerce.checkout.providers.bankTransfer',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Bank-transfer (offline) payment provider. Orders enter status=pending-payment; admin marks paid manually once IBAN settles.',
});

defineFlag<boolean>({
    path: 'commerce.checkout.providers.cashOnDelivery',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Cash-on-delivery (offline) payment provider. Orders enter status=pending-delivery; admin records payment on operator mark-paid.',
});

defineFlag<boolean>({
    path: 'commerce.checkout.providers.paypal',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'PayPal provider flag — defined but NOT wired in this jump (off by default).',
});

defineFlag<boolean>({
    path: 'commerce.checkout.providers.klarna',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Klarna provider flag — defined but NOT wired in this jump (off by default).',
});
