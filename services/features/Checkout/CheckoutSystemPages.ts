/**
 * checkout-as-composable-page (Phase 1.D) — register 8 system pages
 * on the `SystemPageRegistry`. Cargo-cult of Phase 1.E's
 * `CustomerSettingsPage.ts` pattern.
 *
 *   1. cart                    `/cart`
 *   2. checkout-address        `/checkout/address`
 *   3. checkout-shipping       `/checkout/shipping`
 *   4. checkout-payment        `/checkout/payment`
 *   5. checkout-confirmation   `/checkout/confirmation`
 *   6. order-by-token          `/orders/[token]`
 *   7. account-dashboard       `/account`
 *   8. magic-link-verify       `/account/verify`
 *
 * Each defines `defaultSections: () => ISection[]` containing the
 * locked transactional sections; operators can add operator-composable
 * trust / marketing modules between them.
 */
import guid from '@utils/guid';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';

function lockedSection(moduleType: EItemType, lockReason: string): ISection {
    return {
        id: guid(),
        type: 1,
        content: [{type: moduleType, content: ''}],
        locked: true,
        lockReason,
    };
}

/**
 * Phase 1.B-c — checkout customization.
 *
 * Adds the single-step `checkout` system page. Operator default
 * (`commerce.checkout.flow === 'single-step'`) routes /checkout
 * to this stacked layout: address + shipping + payment + place-order
 * + sticky cart summary. The existing 3 multi-step pages stay
 * registered so an operator can flip the flag back without losing
 * the route shape.
 */
systemPageRegistry.register({
    systemKey: 'checkout',
    slug: '/checkout',
    titleI18nKey: 'checkout.singleStep.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.CheckoutAddressForm, 'section.locked.checkout-address-form'),
        lockedSection(EItemType.CheckoutShippingMethod, 'section.locked.checkout-shipping-method'),
        lockedSection(EItemType.CheckoutPaymentForm, 'section.locked.checkout-payment-form'),
        lockedSection(EItemType.PlaceOrderButton, 'section.locked.place-order-button'),
        lockedSection(EItemType.CheckoutCartSummary, 'section.locked.checkout-cart-summary'),
    ],
});

systemPageRegistry.register({
    systemKey: 'cart',
    slug: '/cart',
    titleI18nKey: 'checkout.cart.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.Breadcrumb, 'section.locked.cart-breadcrumb'),
        lockedSection(EItemType.CartLineItems, 'section.locked.cart-line-items'),
        lockedSection(EItemType.CartSummary, 'section.locked.cart-summary'),
        lockedSection(EItemType.CartActions, 'section.locked.cart-actions'),
    ],
});

systemPageRegistry.register({
    systemKey: 'checkout-address',
    slug: '/checkout/address',
    titleI18nKey: 'checkout.address.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.CheckoutProgressBar, 'section.locked.checkout-progress'),
        lockedSection(EItemType.CheckoutAddressForm, 'section.locked.checkout-address-form'),
        lockedSection(EItemType.CheckoutCartSummary, 'section.locked.checkout-cart-summary'),
    ],
});

systemPageRegistry.register({
    systemKey: 'checkout-shipping',
    slug: '/checkout/shipping',
    titleI18nKey: 'checkout.shipping.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.CheckoutProgressBar, 'section.locked.checkout-progress'),
        lockedSection(EItemType.CheckoutShippingMethod, 'section.locked.checkout-shipping-method'),
        lockedSection(EItemType.CheckoutCartSummary, 'section.locked.checkout-cart-summary'),
    ],
});

systemPageRegistry.register({
    systemKey: 'checkout-payment',
    slug: '/checkout/payment',
    titleI18nKey: 'checkout.payment.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.CheckoutProgressBar, 'section.locked.checkout-progress'),
        lockedSection(EItemType.CheckoutPaymentForm, 'section.locked.checkout-payment-form'),
        lockedSection(EItemType.PlaceOrderButton, 'section.locked.place-order-button'),
        lockedSection(EItemType.CheckoutCartSummary, 'section.locked.checkout-cart-summary'),
    ],
});

systemPageRegistry.register({
    systemKey: 'checkout-confirmation',
    slug: '/checkout/confirmation',
    titleI18nKey: 'checkout.confirmation.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.OrderSummary, 'section.locked.order-summary'),
        lockedSection(EItemType.MagicLinkAccountUpgrade, 'section.locked.magic-link-upgrade'),
    ],
});

systemPageRegistry.register({
    systemKey: 'order-by-token',
    slug: '/orders/[token]',
    titleI18nKey: 'checkout.orderByToken.title',
    accessGate: 'guest-token',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.OrderSummary, 'section.locked.order-summary'),
        lockedSection(EItemType.MagicLinkAccountUpgrade, 'section.locked.magic-link-upgrade'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-dashboard',
    slug: '/account',
    titleI18nKey: 'account.dashboard.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.AccountWelcome, 'section.locked.account-welcome'),
    ],
});

systemPageRegistry.register({
    systemKey: 'magic-link-verify',
    slug: '/account/verify',
    titleI18nKey: 'account.magicLinkVerify.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.AccountWelcome, 'section.locked.magic-link-verify'),
    ],
});
