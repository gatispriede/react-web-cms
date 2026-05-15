/**
 * Phase 1.D-c — bespoke per-module editors for the 18 checkout-family
 * modules (12 locked transactional + 6 composable). Replaces the
 * Phase 1.D `PlaceholderJsonEditor` wrappers. Each editor is a thin
 * typed form over the module's content blob.
 *
 * Cargo-cult shape (see `ui/admin/modules/Hero/HeroEditor.tsx`):
 *   1. Parse `content` JSON into the module's typed interface.
 *   2. Render typed form fields (AntD Input / Select / Switch).
 *   3. On every change, JSON-stringify and call `setContent()`.
 *
 * Locked-transactional editors only edit copy (titles, labels) — the
 * structural behaviour is wired in the module's Display component +
 * checkout hooks. Composable editors (TrustBadges, MoneyBackGuarantee,
 * etc.) edit richer content (badge list, refund policy body).
 *
 * Per `feedback_predefined_selections.md`: no free-text where a
 * registry is available — every value space we know is exhaustively
 * enumerable becomes a constrained `<Select>` with `options=…`.
 */
import React from 'react';
import {Button, Input, Space} from 'antd';
import {DeleteOutlined, PlusOutlined} from '@client/lib/icons';
import type {IInputContent} from '@interfaces/IInputContent';
import type {ICartLineItems} from '@client/modules/Checkout/CartLineItems/CartLineItems.types';
import type {ICartSummary} from '@client/modules/Checkout/CartSummary/CartSummary.types';
import type {ICartActions} from '@client/modules/Checkout/CartActions/CartActions.types';
import type {ICheckoutProgressBar} from '@client/modules/Checkout/CheckoutProgressBar/CheckoutProgressBar.types';
import type {ICheckoutAddressForm} from '@client/modules/Checkout/CheckoutAddressForm/CheckoutAddressForm.types';
import type {ICheckoutShippingMethod} from '@client/modules/Checkout/CheckoutShippingMethod/CheckoutShippingMethod.types';
import type {ICheckoutPaymentForm} from '@client/modules/Checkout/CheckoutPaymentForm/CheckoutPaymentForm.types';
import type {ICheckoutCartSummary} from '@client/modules/Checkout/CheckoutCartSummary/CheckoutCartSummary.types';
import type {IPlaceOrderButton} from '@client/modules/Checkout/PlaceOrderButton/PlaceOrderButton.types';
import type {IOrderSummary} from '@client/modules/Checkout/OrderSummary/OrderSummary.types';
import type {IMagicLinkAccountUpgrade} from '@client/modules/Checkout/MagicLinkAccountUpgrade/MagicLinkAccountUpgrade.types';
import type {IAccountWelcome} from '@client/modules/Checkout/AccountWelcome/AccountWelcome.types';
import type {IShippingCalculator} from '@client/modules/Checkout/ShippingCalculator/ShippingCalculator.types';
import type {IDownloadInvoiceButton} from '@client/modules/Checkout/DownloadInvoiceButton/DownloadInvoiceButton.types';
import type {ITrustBadges} from '@client/modules/Trust/TrustBadges/TrustBadges.types';
import type {IMoneyBackGuarantee} from '@client/modules/Trust/MoneyBackGuarantee/MoneyBackGuarantee.types';
import type {IReferAFriendCta} from '@client/modules/Marketing/ReferAFriendCta/ReferAFriendCta.types';
import type {ISocialShareButtons} from '@client/modules/Marketing/SocialShareButtons/SocialShareButtons.types';

/** Parse `content` JSON into a typed shape; tolerate malformed strings. */
function parse<T>(raw: string): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}
function stringify<T>(v: T): string {
    try { return JSON.stringify(v); } catch { return '{}'; }
}

/**
 * Tiny shared `useTypedContent` helper — wraps the parse/commit cycle
 * every editor below repeats. Returns the current typed value + a
 * patch function that JSON-stringifies and forwards to `setContent`.
 */
function useTypedContent<T>({content, setContent}: IInputContent): [T, (patch: Partial<T>) => void] {
    const data = parse<T>(content);
    const patch = (p: Partial<T>) => setContent(stringify({...data, ...p}));
    return [data, patch];
}

/** Reusable copy-field row — label above, AntD Input below. */
const Field: React.FC<{label: string; testid: string; value: string; onChange: (v: string) => void; placeholder?: string}> =
    ({label, testid, value, onChange, placeholder}) => (
        <div style={{marginBottom: 12}}>
            <label style={{display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 4}}>{label}</label>
            <Input data-testid={`editor-${testid}`} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
        </div>
    );

// ── Locked transactional (12) ────────────────────────────────────────

export const CartLineItemsEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICartLineItems>(props);
    return (
        <div className="checkout-editor checkout-editor--cart-line-items" data-testid="editor-cart-line-items">
            <Field label="Section title" testid="cart-line-items-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Cart line items"/>
            <Field label="Helper body (optional)" testid="cart-line-items-body" value={d.body ?? ''} onChange={v => patch({body: v})}/>
        </div>
    );
};

export const CartSummaryEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICartSummary>(props);
    return (
        <div className="checkout-editor checkout-editor--cart-summary" data-testid="editor-cart-summary">
            <Field label="Section title" testid="cart-summary-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Order summary"/>
            <Field label="Helper body (optional)" testid="cart-summary-body" value={d.body ?? ''} onChange={v => patch({body: v})}/>
        </div>
    );
};

export const CartActionsEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICartActions>(props);
    return (
        <div className="checkout-editor checkout-editor--cart-actions" data-testid="editor-cart-actions">
            <Field label="Section title (optional)" testid="cart-actions-title" value={d.title ?? ''} onChange={v => patch({title: v})}/>
            <Field label="Clear-cart button label" testid="cart-actions-clear" value={d.clearLabel ?? ''} onChange={v => patch({clearLabel: v})} placeholder="Clear cart"/>
            <Field label="Proceed-to-checkout button label" testid="cart-actions-proceed" value={d.proceedLabel ?? ''} onChange={v => patch({proceedLabel: v})} placeholder="Proceed to checkout"/>
        </div>
    );
};

export const CheckoutProgressBarEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICheckoutProgressBar>(props);
    return (
        <div className="checkout-editor checkout-editor--progress-bar" data-testid="editor-checkout-progress-bar">
            <Field label="Section title (optional)" testid="progress-bar-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Address → Shipping → Payment"/>
        </div>
    );
};

export const CheckoutAddressFormEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICheckoutAddressForm>(props);
    return (
        <div className="checkout-editor checkout-editor--address-form" data-testid="editor-checkout-address-form">
            <Field label="Section title" testid="address-form-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Shipping address"/>
        </div>
    );
};

export const CheckoutShippingMethodEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICheckoutShippingMethod>(props);
    return (
        <div className="checkout-editor checkout-editor--shipping-method" data-testid="editor-checkout-shipping-method">
            <Field label="Section title" testid="shipping-method-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Shipping method"/>
        </div>
    );
};

export const CheckoutPaymentFormEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICheckoutPaymentForm>(props);
    return (
        <div className="checkout-editor checkout-editor--payment-form" data-testid="editor-checkout-payment-form">
            <Field label="Section title" testid="payment-form-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Payment"/>
        </div>
    );
};

export const CheckoutCartSummaryEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ICheckoutCartSummary>(props);
    return (
        <div className="checkout-editor checkout-editor--cart-summary-mini" data-testid="editor-checkout-cart-summary">
            <Field label="Section title (optional)" testid="checkout-cart-summary-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Your order"/>
        </div>
    );
};

export const PlaceOrderButtonEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IPlaceOrderButton>(props);
    return (
        <div className="checkout-editor checkout-editor--place-order" data-testid="editor-place-order-button">
            <Field label="Button label" testid="place-order-label" value={d.label ?? ''} onChange={v => patch({label: v})} placeholder="Place order"/>
        </div>
    );
};

export const OrderSummaryEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IOrderSummary>(props);
    return (
        <div className="checkout-editor checkout-editor--order-summary" data-testid="editor-order-summary">
            <Field label="Section title" testid="order-summary-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Order summary"/>
        </div>
    );
};

export const MagicLinkAccountUpgradeEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IMagicLinkAccountUpgrade>(props);
    return (
        <div className="checkout-editor checkout-editor--magic-link" data-testid="editor-magic-link-upgrade">
            <Field label="Section title" testid="magic-link-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Save your details for next time"/>
            <Field label="Body copy" testid="magic-link-body" value={d.body ?? ''} onChange={v => patch({body: v})} placeholder="Pick a password and we will attach this order to your account."/>
            <Field label="CTA label" testid="magic-link-cta" value={d.ctaLabel ?? ''} onChange={v => patch({ctaLabel: v})} placeholder="Create an account"/>
        </div>
    );
};

export const AccountWelcomeEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IAccountWelcome>(props);
    return (
        <div className="checkout-editor checkout-editor--account-welcome" data-testid="editor-account-welcome">
            <Field label="Section title" testid="account-welcome-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Welcome back"/>
        </div>
    );
};

// ── Composable (6) ────────────────────────────────────────────────────

export const ShippingCalculatorEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IShippingCalculator>(props);
    return (
        <div className="checkout-editor checkout-editor--shipping-calc" data-testid="editor-shipping-calculator">
            <Field label="Section title" testid="shipping-calc-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Estimate shipping"/>
        </div>
    );
};

export const DownloadInvoiceButtonEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IDownloadInvoiceButton>(props);
    return (
        <div className="checkout-editor checkout-editor--invoice" data-testid="editor-download-invoice">
            <Field label="Button label" testid="download-invoice-label" value={d.label ?? ''} onChange={v => patch({label: v})} placeholder="Download VAT invoice (PDF)"/>
        </div>
    );
};

export const TrustBadgesEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ITrustBadges>(props);
    const badges: string[] = Array.isArray(d.badges) ? d.badges : [];
    const set = (next: string[]) => patch({badges: next});
    return (
        <div className="checkout-editor checkout-editor--trust-badges" data-testid="editor-trust-badges">
            <Field label="Section title" testid="trust-badges-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Trusted by buyers"/>
            <Space direction="vertical" style={{width: '100%'}}>
                {badges.map((b, i) => (
                    <Space key={i} align="start" style={{width: '100%'}}>
                        <Input
                            data-testid={`editor-trust-badge-${i}`}
                            value={b}
                            onChange={e => set(badges.map((x, j) => j === i ? e.target.value : x))}
                            placeholder="visa | mastercard | stripe | ssl"
                            style={{width: 320}}
                        />
                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => set(badges.filter((_, j) => j !== i))} data-testid={`editor-trust-badge-remove-${i}`}/>
                    </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined/>} onClick={() => set([...badges, ''])} data-testid="editor-trust-badge-add">
                    Add badge
                </Button>
            </Space>
        </div>
    );
};

export const MoneyBackGuaranteeEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IMoneyBackGuarantee>(props);
    return (
        <div className="checkout-editor checkout-editor--money-back" data-testid="editor-money-back-guarantee">
            <Field label="Section title" testid="money-back-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="30-day money-back guarantee"/>
            <div style={{marginBottom: 12}}>
                <label style={{display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 4}}>Body copy</label>
                <Input.TextArea
                    data-testid="editor-money-back-body"
                    value={d.body ?? ''}
                    onChange={e => patch({body: e.target.value})}
                    autoSize={{minRows: 3, maxRows: 8}}
                    placeholder="Return any item within 30 days for a full refund. No questions asked."
                />
            </div>
        </div>
    );
};

export const ReferAFriendCtaEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<IReferAFriendCta>(props);
    return (
        <div className="checkout-editor checkout-editor--refer" data-testid="editor-refer-a-friend">
            <Field label="Section title" testid="refer-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Refer a friend, get 10%"/>
            <Field label="Body copy" testid="refer-body" value={d.body ?? ''} onChange={v => patch({body: v})} placeholder="Share your link — both of you get a discount."/>
            <Field label="CTA label" testid="refer-cta-label" value={d.ctaLabel ?? ''} onChange={v => patch({ctaLabel: v})} placeholder="Get your link"/>
            <Field label="CTA href" testid="refer-cta-href" value={d.ctaHref ?? ''} onChange={v => patch({ctaHref: v})} placeholder="/account/referrals"/>
        </div>
    );
};

export const SocialShareButtonsEditor: React.FC<IInputContent> = (props) => {
    const [d, patch] = useTypedContent<ISocialShareButtons>(props);
    return (
        <div className="checkout-editor checkout-editor--social-share" data-testid="editor-social-share">
            <Field label="Section title" testid="social-share-title" value={d.title ?? ''} onChange={v => patch({title: v})} placeholder="Tell your friends"/>
            <Field label="Share URL (defaults to current order)" testid="social-share-url" value={d.url ?? ''} onChange={v => patch({url: v})} placeholder="https://your-site.example/orders/…"/>
        </div>
    );
};
