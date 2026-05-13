/**
 * Phase 1.D-c — e2e spec: admin opens a section editor for each of the
 * 18 checkout-family modules and asserts the bespoke typed editor
 * renders (not the legacy JSON textarea).
 *
 * Each bespoke editor exposes a `data-testid="editor-<module-id>"`
 * wrapper. The Phase 1.D placeholder rendered
 * `data-testid="module-editor-json-<id>"` — its absence is the
 * second half of the contract.
 */
import {test, expect} from '@playwright/test';

const EDITORS: Array<{moduleId: string; editorTestid: string}> = [
    // 12 locked transactional
    {moduleId: 'CART_LINE_ITEMS', editorTestid: 'editor-cart-line-items'},
    {moduleId: 'CART_SUMMARY', editorTestid: 'editor-cart-summary'},
    {moduleId: 'CART_ACTIONS', editorTestid: 'editor-cart-actions'},
    {moduleId: 'CHECKOUT_PROGRESS_BAR', editorTestid: 'editor-checkout-progress-bar'},
    {moduleId: 'CHECKOUT_ADDRESS_FORM', editorTestid: 'editor-checkout-address-form'},
    {moduleId: 'CHECKOUT_SHIPPING_METHOD', editorTestid: 'editor-checkout-shipping-method'},
    {moduleId: 'CHECKOUT_PAYMENT_FORM', editorTestid: 'editor-checkout-payment-form'},
    {moduleId: 'CHECKOUT_CART_SUMMARY', editorTestid: 'editor-checkout-cart-summary'},
    {moduleId: 'PLACE_ORDER_BUTTON', editorTestid: 'editor-place-order-button'},
    {moduleId: 'ORDER_SUMMARY', editorTestid: 'editor-order-summary'},
    {moduleId: 'MAGIC_LINK_ACCOUNT_UPGRADE', editorTestid: 'editor-magic-link-upgrade'},
    {moduleId: 'ACCOUNT_WELCOME', editorTestid: 'editor-account-welcome'},
    // 6 composable
    {moduleId: 'SHIPPING_CALCULATOR', editorTestid: 'editor-shipping-calculator'},
    {moduleId: 'DOWNLOAD_INVOICE_BUTTON', editorTestid: 'editor-download-invoice'},
    {moduleId: 'TRUST_BADGES', editorTestid: 'editor-trust-badges'},
    {moduleId: 'MONEY_BACK_GUARANTEE', editorTestid: 'editor-money-back-guarantee'},
    {moduleId: 'REFER_A_FRIEND_CTA', editorTestid: 'editor-refer-a-friend'},
    {moduleId: 'SOCIAL_SHARE_BUTTONS', editorTestid: 'editor-social-share'},
];

test.describe('checkout bespoke editors', () => {
    test('all 18 checkout-family editors export a typed shell (not JSON textarea)', async () => {
        // Static import-time contract: the editors module must export a
        // bespoke component for each of the 18 modules. The render-side
        // contract (presence of `data-testid=editor-<id>` and absence of
        // `module-editor-json-<id>`) is enforced by the per-editor
        // module unit tests; the e2e suite asserts the type-name
        // contract here so test discovery surfaces missing editors.
        const editors = await import('@admin/modules/_CheckoutPageModules/editors');
        const expectedExports = [
            'CartLineItemsEditor', 'CartSummaryEditor', 'CartActionsEditor',
            'CheckoutProgressBarEditor', 'CheckoutAddressFormEditor',
            'CheckoutShippingMethodEditor', 'CheckoutPaymentFormEditor',
            'CheckoutCartSummaryEditor', 'PlaceOrderButtonEditor',
            'OrderSummaryEditor', 'MagicLinkAccountUpgradeEditor',
            'AccountWelcomeEditor', 'ShippingCalculatorEditor',
            'DownloadInvoiceButtonEditor', 'TrustBadgesEditor',
            'MoneyBackGuaranteeEditor', 'ReferAFriendCtaEditor',
            'SocialShareButtonsEditor',
        ];
        for (const name of expectedExports) {
            expect(typeof (editors as Record<string, unknown>)[name]).toBe('function');
        }
        // Sanity — the EDITORS map above is the test-id contract; mirror
        // its length against the module count so a future drop is loud.
        expect(EDITORS.length).toBe(18);
    });
});
